# Environment Configuration

Environment variables, local development prerequisites, and secrets management for [PROJECT_NAME].

## Required Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `[DATABASE_URL_VAR]` | Yes | Primary database connection string | `postgresql://user:pass@localhost:5432/db` |
| `[AUTH_SECRET_VAR]` | Yes | Authentication signing secret | `random-32-char-string` |
| `[API_URL_VAR]` | Yes | Backend API base URL | `http://localhost:[PORT]` |
| [ADDITIONAL_ENV_VARS] | | | |

<!-- TODO: Add all project-specific environment variables to the table above -->

## Local Development Setup

### Prerequisites

| Requirement | Minimum Version | Install |
|-------------|----------------|---------|
| [RUNTIME] | [RUNTIME_VERSION] | [INSTALL_URL] |
| [PACKAGE_MANAGER] | [PM_VERSION] | Included with [RUNTIME] |
| [DATABASE] | [DB_VERSION] | [DB_INSTALL_URL] |
| [ADDITIONAL_PREREQUISITES_OR_REMOVE] | | |

### Install and Run

```bash
# 1. Clone the repository
git clone [REPO_URL]
cd [PROJECT_NAME]

# 2. Install dependencies
[INSTALL_COMMAND]

# 3. Copy environment template
cp .env.example .env

# 4. Configure environment variables
# Edit .env with your local values (see table above)

# 5. Set up the database
[DB_SETUP_COMMAND]

# 6. Start the development server
[DEV_COMMAND]
```

## Dev Commands

| Command | Purpose |
|---------|---------|
| `[DEV_COMMAND]` | Start dev server with hot reload |
| `[BUILD_COMMAND]` | Build for production |
| `[TEST_COMMAND]` | Run test suite |
| `[LINT_COMMAND]` | Lint and format code |
| `[DB_MIGRATE_COMMAND]` | Run database migrations |
| `[DB_SEED_COMMAND]` | Seed database with test data |
| [ADDITIONAL_COMMANDS_OR_REMOVE] | |

## Environment Files

| File | Git Tracked | Purpose |
|------|-------------|---------|
| `.env.example` | Yes | Template with all variable names and example values |
| `.env` | **No** | Local development overrides (created from `.env.example`) |
| `.env.test` | Depends | Test-specific overrides [ENV_TEST_OR_REMOVE] |
| `.env.production` | **No** | Production values (managed via deployment platform) |

**Rules**:
- Never commit `.env` files containing real secrets
- Always update `.env.example` when adding new variables
- Use placeholder values in `.env.example`, never real credentials

## Secrets Management

| Environment | Method | Access |
|-------------|--------|--------|
| Local dev | `.env` file | Developer machine only |
| CI/CD | [CI_SECRETS_METHOD] | [CI_PLATFORM] environment variables |
| Staging | [STAGING_SECRETS_METHOD] | [STAGING_ACCESS] |
| Production | [PROD_SECRETS_METHOD] | [PROD_ACCESS] |

### Rotation Policy

- Rotate secrets [ROTATION_FREQUENCY] or immediately upon suspected compromise
- [SECRET_ROTATION_PROCEDURE]
- Update all environments when rotating shared secrets

## Deployment Environments

| Environment | URL | Branch | Auto-Deploy |
|-------------|-----|--------|-------------|
| Local | `http://localhost:[PORT]` | Any | N/A |
| [STAGING_ENV_OR_REMOVE] | [STAGING_URL] | `main` | [YES_OR_NO] |
| Production | [PRODUCTION_URL] | [PROD_BRANCH] | [YES_OR_NO] |

### Environment Parity

Keep all environments as similar as possible:
- Same [RUNTIME] version across all environments
- Same database engine and version
- Feature flags for environment-specific behavior rather than code branches

See also: `./runbook.md` for deployment and rollback procedures.
