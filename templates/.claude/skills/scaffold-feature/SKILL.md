---
name: scaffold-feature
description: |
  Scaffold a full-stack entity feature across all layers: Drizzle schema,
  Zod types, UI component, and tests. Orchestrates create-migration,
  add-zod-schema, new-component, and gen-test in sequence. Use when adding
  a new database entity with its full CRUD stack.
---

# Scaffold Feature

Orchestrate the full entity creation chain in a single workflow: database schema, shared types, UI component, and tests.

## Usage

Invoke with `/scaffold-feature <EntityName>`

Examples:
- `/scaffold-feature User`
- `/scaffold-feature Project`
- `/scaffold-feature InvoiceLineItem`

## When to Use

- Adding a new database entity that needs schema, types, UI, and tests
- Building a CRUD feature for a new domain object
- Starting a new feature that spans the full stack (db → types → ui → tests)

## Do NOT Use When

- Adding a schema-only change with no UI — use `/create-migration` directly
- Adding shared types with no database backing — use `/add-zod-schema` directly
- Creating a pure UI component — use `/new-component` directly
- Modifying an existing entity — edit files directly

## Procedure

### Step 1: Gather Requirements

Ask the user (use AskUserQuestion) for the following if not already provided:

1. **Entity name** (PascalCase, e.g., `Invoice`)
2. **Fields** — column names, types, and constraints
3. **Scope** — which layers to scaffold:
   - Database schema (Drizzle) — default: yes
   - Shared Zod types (@outputease/types) — default: yes
   - UI component — default: ask
   - Tests — default: yes for all created layers

Build a field list like:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|

### Step 2: Run `/create-migration`

Execute the create-migration skill procedure with the entity name and fields:

1. Create `packages/db/src/schema/<entity>.ts` with Drizzle table definition
2. Update `packages/db/src/schema/index.ts` barrel export
3. Typecheck the db package
4. Generate migration with `bunx drizzle-kit generate`

Track the created file paths and export names for use in later steps.

**Thread these names forward:**
- Table variable: `<entityPlural>` (e.g., `invoices`)
- Insert schema: `insert<Entity>Schema`
- Select schema: `select<Entity>Schema`
- Types: `Insert<Entity>`, `Select<Entity>`

### Step 3: Run `/add-zod-schema`

Execute the add-zod-schema skill procedure:

1. Create or extend `packages/types/src/<entity>.ts` with API-layer Zod schemas
2. The schema should mirror the Drizzle columns but be independent (for API validation)
3. Update `packages/types/src/index.ts` barrel export
4. Typecheck the types package

**Naming consistency:**
- Schema: `<Entity>Schema` (e.g., `InvoiceSchema`)
- Create variant: `Create<Entity>Schema` (omit `id`, `createdAt`, `updatedAt`)
- Update variant: `Update<Entity>Schema` (all fields optional via `.partial()`)
- Type: `<Entity>`, `Create<Entity>`, `Update<Entity>`

### Step 4: Run `/new-component` (If Requested)

If the user requested a UI component:

1. Execute the new-component skill procedure
2. Component name: `<Entity>Form` or as specified by the user
3. Import types from `@outputease/types` (NOT from db package)
4. Use brand tokens and shadcn/ui primitives

Skip this step if the user opted out or if this is an API-only entity.

### Step 5: Run `/gen-test`

Generate tests for each created artifact:

1. **Schema tests**: `packages/db/src/schema/<entity>.test.ts` — validate insert/select schemas
2. **Types tests**: `packages/types/src/<entity>.test.ts` — validate Zod parse/safeParse
3. **Component tests**: (if component created) — render test + a11y basics

Run all tests: `bun test` to verify everything passes.

### Step 6: Final Verification

Run a full check across all affected packages:

```bash
bunx tsc --noEmit --project packages/db/tsconfig.json
bunx tsc --noEmit --project packages/types/tsconfig.json
bun test
```

## Output Format

```
## Feature Scaffolded: <Entity>

### Database Layer
**Schema**: packages/db/src/schema/<entity>.ts
**Migration**: packages/db/src/migrations/<timestamp>_<name>.sql
**Exports**: <entityPlural>, insert<Entity>Schema, select<Entity>Schema

### Types Layer
**File**: packages/types/src/<entity>.ts
**Exports**: <Entity>Schema, Create<Entity>Schema, Update<Entity>Schema
**Types**: <Entity>, Create<Entity>, Update<Entity>

### UI Layer (if created)
**Component**: packages/ui/src/components/<Entity>Form.tsx
**Export**: <Entity>Form

### Tests
| File | Tests | Status |
|------|-------|--------|
| packages/db/src/schema/<entity>.test.ts | [count] | PASS |
| packages/types/src/<entity>.test.ts | [count] | PASS |
| [component test if created] | [count] | PASS |

### Checklist
- [x] Drizzle schema created
- [x] Migration generated
- [x] Zod schemas in @outputease/types
- [x] Barrel exports updated (db + types)
- [x] Tests passing
- [ ] Database push (manual — run `bunx drizzle-kit push` when ready)
```

## Related Skills

- **create-migration** — Step 2 of this workflow (standalone for schema-only changes)
- **add-zod-schema** — Step 3 of this workflow (standalone for types-only additions)
- **new-component** — Step 4 of this workflow (standalone for UI-only work)
- **gen-test** — Step 5 of this workflow (standalone for test generation)
- **a11y-review** — Run after scaffolding to audit the UI component

## Notes

- Entity names must be PascalCase (e.g., `InvoiceLineItem`, not `invoice-line-item`)
- The Drizzle schema and Zod types are intentionally independent — the Drizzle layer uses `drizzle-zod` for DB-level validation, while `@outputease/types` defines API-layer contracts
- Always import types in UI components from `@outputease/types`, never from `@outputease/db`
- The migration is generated but NOT pushed automatically — the user decides when to push
- If any step fails typecheck, fix the issue before proceeding to the next step
