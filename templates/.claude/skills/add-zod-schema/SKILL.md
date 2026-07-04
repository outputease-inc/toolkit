---
name: add-zod-schema
description: |
  Scaffold Zod schemas in @outputease/types following project conventions.
  Creates domain files and updates barrel export. Use when adding shared types,
  API contracts, form shapes, or business entities.
---

# Add Zod Schema

Scaffold Zod schemas and derived TypeScript types in `packages/types` following project conventions.

## Usage

Invoke with `/add-zod-schema <SchemaName> [domain]`

- `<SchemaName>` -- PascalCase entity name (e.g., `User`, `Project`, `InvoiceLineItem`)
- `[domain]` -- Optional grouping file name in kebab-case (e.g., `user`, `project`). Defaults to lowercase of SchemaName.

Examples:
- `/add-zod-schema User`
- `/add-zod-schema Project project`
- `/add-zod-schema InvoiceLineItem invoice`

## When to Use

- Adding a new shared entity type used across packages
- Defining an API request or response shape for shared consumption
- Adding a form validation schema that multiple packages will reference
- After creating a Drizzle table schema and needing a matching Zod shape for the API layer

## Do NOT Use When

- The schema belongs to a single package only -- define it locally in that package's `src/`
- Adding a Drizzle schema to `packages/db` -- use `/create-migration` instead
- The type is a simple primitive alias -- use TypeScript directly
- Extending an existing schema with new fields -- edit the domain file directly

## Procedure

### Step 1: Resolve Target File

Check whether a domain file already exists:

```
Glob: packages/types/src/<domain>.ts
```

- **File exists**: Read it to understand current schemas, then add the new schema at the bottom
- **File does not exist**: Create `packages/types/src/<domain>.ts`

Convention: One file per domain cluster. Related schemas (e.g., `CreateUserSchema`, `UpdateUserSchema`) live in the same domain file as `UserSchema`.

### Step 2: Write the Schema

Follow this template:

```typescript
import { z } from "zod";

/** [One-line description of what this entity represents] */
export const <Name>Schema = z.object({
  // fields
});

export type <Name> = z.infer<typeof <Name>Schema>;
```

Naming rules:
- Schema variable: `<Name>Schema` (e.g., `UserSchema`)
- Type alias: `<Name>` (drops the `Schema` suffix)
- Always export both the schema and the type
- Always add a JSDoc comment on the schema
- Use `z.string().uuid()` for IDs (matches Supabase UUID PKs)
- Use `z.string().datetime()` for timestamps from Supabase

If the file already exists, append the new schema after the last existing export.

### Step 3: Update the Barrel Export

Read `packages/types/src/index.ts` and add re-exports:

**New domain file**:
```typescript
// <Domain> types
export { <Name>Schema } from "./<domain>";
export type { <Name> } from "./<domain>";
```

**Existing domain file**: Add only the new schema and type to the existing re-export block.

### Step 4: Typecheck

```bash
bunx tsc --noEmit --project packages/types/tsconfig.json
```

Fix any errors before reporting completion.

## Output Format

```
## Schema Added: <Name>

**Domain file**: packages/types/src/<domain>.ts
**Action**: Created | Extended
**Exports added**:
  - `<Name>Schema` (Zod schema)
  - `<Name>` (TypeScript type)

### Schema Shape
[list of fields with their Zod types]

### Barrel Export
packages/types/src/index.ts -- [Created new block | Added to existing block]

### Typecheck
[PASSED | FAILED with error details]
```

## Related Skills

- **gen-test** -- Generate validation tests for the new schema (parse valid/invalid inputs)
- **create-migration** -- When the schema represents a database entity, create the Drizzle layer

## Notes

- Always use `z.infer<typeof ...>` to derive types -- never write types by hand alongside schemas
- The `packages/types/src/index.ts` is already a re-export hub (the domain `export *` lines) plus one inline `ApiResponseSchema`; keep its `import { z }` as long as that schema lives in `index.ts`.
