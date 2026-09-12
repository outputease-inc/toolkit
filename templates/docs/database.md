# Data Layer Guide

Schema design, migrations, query patterns, indexes, and data access conventions for [PROJECT_NAME].

## Overview

| Property | Value |
|----------|-------|
| Database engine | [DATABASE_ENGINE] (e.g., PostgreSQL, SQLite, MySQL) |
| ORM / Query builder | [ORM_OR_QUERY_BUILDER] |
| Schema location | [SCHEMA_PATH] |
| Migration tool | [MIGRATION_TOOL] |
| Connection pooling | [POOL_STRATEGY] |

## Schema Design

### ER Diagram

<!-- TODO: Replace with an actual ER diagram or link to a generated diagram -->

```
[ER_DIAGRAM]

  ┌──────────┐       ┌──────────────┐       ┌──────────┐
  │  [TABLE_1] │──1:N──│  [TABLE_2]     │──N:1──│ [TABLE_3]  │
  └──────────┘       └──────────────┘       └──────────┘
```

### Table Template

Each table should follow this structure:

**`[TABLE_NAME]`**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | [ID_TYPE] | No | auto-generated | Primary key |
| `created_at` | timestamp | No | `now()` | Row creation time |
| `updated_at` | timestamp | No | `now()` | Last modification time |
| `[COLUMN_NAME]` | [TYPE] | [YES_NO] | [DEFAULT] | [DESCRIPTION] |

### Design Conventions

- **Primary keys**: [ID_STRATEGY] (e.g., UUID v7, auto-increment, CUID)
- **Timestamps**: Every table includes `created_at` and `updated_at`
- **Soft deletes**: [SOFT_DELETE_STRATEGY_OR_REMOVE]
- **Naming**: Tables `snake_case` (plural), columns `snake_case` (singular), FKs `[table]_id`
- **Enums**: [ENUM_STRATEGY] (e.g., string column, database enum type)

## Migrations

### Commands

| Command | Purpose |
|---------|---------|
| `[MIGRATE_COMMAND]` | Run pending migrations |
| `[MIGRATE_CREATE_COMMAND]` | Create a new migration file |
| `[MIGRATE_ROLLBACK_COMMAND]` | Roll back the last migration |
| `[MIGRATE_STATUS_COMMAND]` | Show migration status |
| `[MIGRATE_RESET_COMMAND]` | Reset and re-run all migrations |

### Conventions

- **One change per migration**: Each migration addresses a single schema change
- **Reversible**: Every migration must include a rollback (`down`) function
- **No data loss**: Use additive migrations; deprecate columns before removal
- **Migration naming**: `[MIGRATION_NAMING_PATTERN]` (e.g., `YYYYMMDDHHMMSS_description`)
- **Test migrations**: Run against a copy of production data before deploying

## Query Patterns

All database access goes through [DATA_ACCESS_PATTERN] (e.g., repository pattern, service layer, direct ORM). Rules: no raw queries in route handlers, parameterized queries only, wrap multi-step operations in transactions.

| Pattern | Example |
|---------|---------|
| Single record by ID | `[FIND_BY_ID_EXAMPLE]` |
| Filtered list with pagination | `[PAGINATED_QUERY_EXAMPLE]` |
| Upsert | `[UPSERT_EXAMPLE]` |
| Batch insert | `[BATCH_INSERT_EXAMPLE]` |
| Transaction | `[TRANSACTION_EXAMPLE]` |

## Indexes

| Table | Column(s) | Type | Rationale |
|-------|-----------|------|-----------|
| [TABLE] | [COLUMN] | [INDEX_TYPE] | [REASON] |
| [TABLE] | [COLUMN] | unique | Enforce uniqueness |
| [TABLE] | [COLUMN], [COLUMN] | composite | Frequent filter combination |

Index on columns used in `WHERE`, `JOIN`, and `ORDER BY`. Monitor slow query logs. Avoid over-indexing (each index adds write overhead).

## Seeding

| Command | Purpose |
|---------|---------|
| `[SEED_COMMAND]` | Populate database with test/demo data |
| `[SEED_RESET_COMMAND]` | Clear and re-seed |

Seeds live in `[SEED_DIRECTORY]`, are idempotent, and use realistic but anonymized data.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `[DATABASE_URL_VAR]` | Yes | Connection string |
| `[DB_POOL_SIZE_VAR]` | No | Connection pool size (default: [DEFAULT_POOL]) |
| `[DB_SSL_VAR]` | No | Enable SSL connections |

See also: `./environment.md` for full environment configuration.

## Backup and Recovery

- **Backup frequency**: [BACKUP_FREQUENCY] (e.g., daily, hourly)
- **Backup method**: [BACKUP_METHOD] (e.g., pg_dump, managed snapshots)
- **Retention**: [BACKUP_RETENTION] (e.g., 30 days)
- **Recovery procedure**: See `./runbook.md` for step-by-step restore instructions
- **Test restores**: [RESTORE_TEST_FREQUENCY] (e.g., monthly)

## Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| Connection refused | Database not running | Start the database service |
| Connection timeout | Pool exhausted | Increase pool size or check for leaks |
| Migration failed | Schema conflict | Check migration status, resolve conflicts |
| Slow queries | Missing index | Run `EXPLAIN` and add appropriate index |
| Data integrity error | Missing foreign key constraint | Review schema constraints |

See also: `./errors.md` for database-related error codes.
