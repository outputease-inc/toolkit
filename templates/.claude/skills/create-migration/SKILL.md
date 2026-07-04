---
name: create-migration
description: |
  Create a Drizzle ORM database migration. Guides schema creation,
  migration generation, and SQL review. Use when adding tables, columns,
  indexes, or relations. Trigger when user mentions "new table", "add a field",
  "database change", or any schema modification.
---

# Create Migration

Guided workflow for Drizzle ORM schema changes and migration generation.

## Usage

Invoke with `/create-migration <entity-name>`

Examples:
- `/create-migration users`
- `/create-migration projects`
- `/create-migration invoice-line-items`

## When to Use

- Adding a new database table
- Adding columns to an existing table
- Creating or modifying indexes
- Adding relations between tables

## Do NOT Use When

- Querying or reading data — use Drizzle queries directly
- Modifying the database client config — edit `packages/db/src/client.ts` directly
- Rolling back migrations — use `drizzle-kit` CLI directly
- Seeding data — create a seed script instead

## Procedure

### Step 1: Determine Scope

If not clear from context, ask about:
1. Entity/table being created or modified
2. New table or modification to existing?
3. Columns, types, constraints, and indexes needed

Read current schema state:
```
Glob: packages/db/src/schema/*.ts
Read: packages/db/src/schema/index.ts
```

### Step 2: Check Prerequisites

Verify `drizzle-zod` is installed in `packages/db/package.json`. If missing:
```bash
bun add drizzle-zod --filter=@outputease/db
```

### Step 3: Create or Edit Schema File

**Convention**: One file per domain entity in `packages/db/src/schema/`.

**For a new entity** — create `packages/db/src/schema/<entity>.ts`:

```typescript
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const <entity> = pgTable("<entity>", {
  id: uuid("id").defaultRandom().primaryKey(),
  // ... columns based on requirements
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insert<Entity>Schema = createInsertSchema(<entity>);
export const select<Entity>Schema = createSelectSchema(<entity>);

export type Insert<Entity> = typeof insert<Entity>Schema._type;
export type Select<Entity> = typeof select<Entity>Schema._type;
```

**For an existing entity** — read the file, then edit to add new columns/indexes/relations.

**Naming**:
- File: matches table name (e.g., `users.ts`)
- Table variable: `export const users = pgTable("users", ...)`
- Schemas: `insertUserSchema`, `selectUserSchema`
- Types: `InsertUser`, `SelectUser`

### Step 4: Update Barrel Export

Edit `packages/db/src/schema/index.ts` to re-export the new entity. Maintain alphabetical ordering:

```typescript
export { users, insertUserSchema, selectUserSchema } from "./users";
export type { InsertUser, SelectUser } from "./users";
```

### Step 5: Typecheck

```bash
bunx tsc --noEmit --project packages/db/tsconfig.json
```

Fix any type errors before proceeding.

### Step 6: Generate Migration

```bash
bunx drizzle-kit generate
```

Find the newest `.sql` file:
```
Glob: packages/db/src/migrations/*.sql
```

Read and display the generated SQL with a summary of operations.

### Step 7: Push (Optional)

Ask the user whether to push to the database:
- **Yes**: Run `bunx drizzle-kit push`
- **No**: Migration saved locally for later

**Important**: Warn if `DATABASE_URL` is not set. Do NOT attempt to read `.env` files.

## Output Format

```
## Migration Created: [entity-name]

### Schema
**File**: packages/db/src/schema/[entity].ts
**Action**: Created | Modified
**Table**: [table_name]

### Columns
| Column | Type | Nullable | Default |
|--------|------|----------|---------|

### Migration
**File**: packages/db/src/migrations/[timestamp]_[name].sql

### SQL Preview
[generated SQL]

### Status
- [x] Schema file created/updated
- [x] Barrel export updated
- [x] Typecheck passed
- [x] Migration generated
- [ ] Database push (skipped / completed)
```

## Related Skills

- **gen-test** — After creating a schema, generate validation tests for Zod schemas
- **new-component** — If building a CRUD feature, scaffold UI after the schema

## Notes

- Always use `uuid` for primary keys (Supabase convention)
- Always include `created_at` and `updated_at` timestamp columns with timezone
- Use `drizzle-zod` for schema validation (Zod-first types convention)
- Migration files in `packages/db/src/migrations/` should never be manually edited
- The `drizzle.config.ts` already points to `./src/schema/index.ts` as the schema source
