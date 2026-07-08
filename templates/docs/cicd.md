# CI/CD Configuration

Build, test, and deployment workflows including environment promotion and release automation for [PROJECT_NAME].

## Overview

| Property | Value |
|----------|-------|
| CI Platform | [CI_PLATFORM] |
| Config File | [CI_CONFIG_FILE] |
| Primary Branch | `main` |
| Package Manager | [PACKAGE_MANAGER] |

## Pipeline Stages

### Build

| Step | Command | Purpose |
|------|---------|---------|
| Install dependencies | `[INSTALL_COMMAND]` | Restore packages from lockfile |
| Lint | `[LINT_COMMAND]` | Enforce code style and catch errors |
| Type check | `[TYPECHECK_COMMAND_OR_REMOVE]` | Verify type correctness |
| Build | `[BUILD_COMMAND]` | Produce production artifact |

### Test

| Step | Command | Purpose |
|------|---------|---------|
| Unit tests | `[TEST_UNIT_COMMAND]` | Validate isolated logic |
| Integration tests | `[TEST_INTEGRATION_COMMAND_OR_REMOVE]` | Verify service interactions |
| E2E tests | `[TEST_E2E_COMMAND_OR_REMOVE]` | Confirm critical user flows |

### Deploy

| Step | Command | Purpose |
|------|---------|---------|
| Deploy to staging | `[DEPLOY_STAGING_COMMAND]` | Promote build to staging |
| Smoke test | `[SMOKE_TEST_COMMAND_OR_REMOVE]` | Verify staging deployment |
| Deploy to production | `[DEPLOY_PROD_COMMAND]` | Promote build to production |

## Pipeline Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Push /  │───▶│  Build   │───▶│   Test   │───▶│  Deploy  │
│   PR     │    │  + Lint  │    │  Suite   │    │ Staging  │
└──────────┘    └──────────┘    └──────────┘    └────┬─────┘
                                                     │
                                              ┌──────▼─────┐
                                              │  Manual     │
                                              │  Approval   │
                                              └──────┬─────┘
                                                     │
                                              ┌──────▼─────┐
                                              │  Deploy     │
                                              │ Production  │
                                              └─────────────┘
```

<!-- TODO: Adapt this diagram to match your actual pipeline topology -->

## Environment Variables in CI

| Variable | Purpose | Source |
|----------|---------|--------|
| `[ENV_VAR_1]` | [PURPOSE] | [CI secrets / repository variable] |
| `[ENV_VAR_2]` | [PURPOSE] | [CI secrets / repository variable] |
| `NODE_ENV` | Runtime mode | Set by pipeline stage |

## Secrets Management

- Store all secrets in the CI platform's encrypted secrets store.
- Never commit secrets to the repository; use `.env.example` as a template.
- Rotate secrets on a [ROTATION_SCHEDULE] cadence.
- Audit secret access via the CI platform's logs.

See also: `../SECURITY.md` for application-level secret handling.

## Branch Protection Rules

| Rule | Setting |
|------|---------|
| Require PR reviews | [REVIEW_COUNT] approval(s) required |
| Require status checks | Build + Test must pass |
| Require up-to-date branch | Merge only when current with `main` |
| Restrict force pushes | Disabled on `main` |
| Restrict deletions | Disabled on `main` |
| [ADDITIONAL_RULE_OR_REMOVE] | [SETTING] |

## Caching

Cache the following between pipeline runs to reduce build time:

| Cache Key | Path | Invalidation |
|-----------|------|--------------|
| Dependencies | `[CACHE_DEPS_PATH]` | Lockfile hash changes |
| Build cache | `[CACHE_BUILD_PATH_OR_REMOVE]` | Source file hash changes |

## Artifacts

| Artifact | Path | Retention | Purpose |
|----------|------|-----------|---------|
| Production build | `[BUILD_OUTPUT_DIR]` | 30 days | Deployment package |
| Test results | `[TEST_RESULTS_PATH_OR_REMOVE]` | 14 days | Test reporting |
| Coverage report | `[COVERAGE_PATH_OR_REMOVE]` | 14 days | Code coverage tracking |

## Troubleshooting

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| Dependency install fails | Lockfile out of sync | Run `[INSTALL_COMMAND]` locally, commit updated lockfile |
| Build timeout | Large assets or slow compilation | Increase timeout; check for unnecessary imports |
| Flaky tests | Non-deterministic test order or timing | Isolate test; add retries for known-flaky integration tests |
| Deploy fails | Missing env var or expired secret | Verify CI secrets match `.env.example` |
| Cache miss | Lockfile or key changed | Expected on dependency updates; first run will be slower |
