# Error Reference

Error codes, user-facing messages, and troubleshooting steps for [PROJECT_NAME].

## Error Response Format

All API errors follow a consistent structure:

```json
{
  "error": {
    "code": "string — Machine-readable error code (e.g., AUTH_TOKEN_EXPIRED)",
    "message": "string — User-safe message (never expose internals)",
    "status": "number — HTTP status code",
    "details": "optional — Validation details or context",
    "requestId": "optional string — Correlation ID for log tracing"
  }
}
```

<!-- Adjust the schema above to match your project's actual error shape and language -->

## Client Errors (4xx)

| Status | Code | Message | When |
|--------|------|---------|------|
| 400 | `BAD_REQUEST` | Invalid request parameters | Malformed payload or query |
| 401 | `UNAUTHORIZED` | Authentication required | Missing or invalid credentials |
| 403 | `FORBIDDEN` | Insufficient permissions | Valid auth but lacks required role |
| 404 | `NOT_FOUND` | Resource not found | Entity does not exist or is deleted |
| 409 | `CONFLICT` | Resource already exists | Duplicate key or concurrent edit |
| 422 | `VALIDATION_ERROR` | Validation failed | Schema validation failure (see details) |
| 429 | `RATE_LIMITED` | Too many requests | Rate limit exceeded |

## Server Errors (5xx)

| Status | Code | Message | When |
|--------|------|---------|------|
| 500 | `INTERNAL_ERROR` | An unexpected error occurred | Unhandled exception |
| 502 | `BAD_GATEWAY` | Upstream service unavailable | Third-party API failure |
| 503 | `SERVICE_UNAVAILABLE` | Service temporarily unavailable | Maintenance or overload |
| 504 | `GATEWAY_TIMEOUT` | Request timed out | Upstream service timeout |

## Application-Specific Errors

| Code | Status | Message | Resolution |
|------|--------|---------|------------|
| `[APP_ERROR_CODE_1]` | [STATUS] | [USER_MESSAGE] | [RESOLUTION] |
| `[APP_ERROR_CODE_2]` | [STATUS] | [USER_MESSAGE] | [RESOLUTION] |
| `[APP_ERROR_CODE_3]` | [STATUS] | [USER_MESSAGE] | [RESOLUTION] |

<!-- TODO: Add domain-specific error codes as they are defined -->

## Validation Errors

Validation errors return status `422` with a `details` array describing each field failure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "status": 422,
    "details": [
      { "field": "email", "rule": "format", "message": "Must be a valid email address" },
      { "field": "password", "rule": "minLength", "message": "Must be at least 8 characters" }
    ]
  }
}
```

## Error Handling Patterns

### User-Facing Messages

- **Never expose** stack traces, database errors, or internal paths to clients
- **Use generic messages** for 5xx errors ("An unexpected error occurred")
- **Be specific for 4xx** errors so the client can correct the request
- **Include `requestId`** in every error response for support correlation

### Logging

| Severity | When | Example |
|----------|------|---------|
| `error` | Unhandled exceptions, 5xx responses | Database connection failure |
| `warn` | Recoverable issues, retries, deprecations | Rate limit approaching threshold |
| `info` | Normal operations, audit events | User login, resource created |
| `debug` | Development diagnostics | Request/response payloads |

- Log the full error (stack trace, context) server-side at `error` level
- Include `requestId`, user ID (if available), and timestamp in all log entries
- Use structured logging ([LOGGING_LIBRARY]) -- not `console.log` in production

### Retry Strategy

| Error Type | Retry | Backoff | Max Attempts |
|------------|-------|---------|--------------|
| Network timeout | Yes | Exponential | [MAX_RETRIES] |
| 429 Rate limited | Yes | Respect `Retry-After` header | [MAX_RETRIES] |
| 5xx Server error | Yes | Exponential | [MAX_RETRIES] |
| 4xx Client error | No | N/A | 1 |

## Troubleshooting Guide

### Authentication Failures

1. Verify the token has not expired (see `./auth.md`)
2. Check that required environment variables are set (see `./environment.md`)
3. Confirm the user has the necessary role and permissions
4. Review server logs filtered by `requestId`

### Database Connection Errors

1. Verify `[DATABASE_URL_VAR]` is correctly set in `.env`
2. Confirm the database service is running
3. Check connection pool limits and active connection count
4. Review database logs for rejected connections

### Third-Party Service Errors

1. Check the upstream service status page
2. Verify API keys and credentials are current
3. Review rate limit headers in recent responses
4. Fall back to cached data if available

See also: `./runbook.md` for incident response procedures.

---

## Claude Code Hook Errors

These errors are produced by hooks in `.claude/hooks/`. They appear in the Claude Code UI when a tool operation is blocked.

### protect-sensitive.js (PreToolUse)

This hook blocks Read, Edit, and Write operations on sensitive files. When blocked, the operation is prevented and Claude displays the message below.

| Trigger | Message | Resolution |
|---------|---------|------------|
| `.env` files (not `.example`/`.sample`/`.template`) | BLOCKED: Cannot edit {file} — environment files contain secrets. Edit .env files manually outside Claude Code. | Edit `.env` files in your editor. Use `.env.example` as the committed template. |
| Lock files (`package-lock.json`, `yarn.lock`, etc.) | BLOCKED: Cannot edit {file} — this is a generated lock file. Run package manager commands instead. | Use `npm install`, `yarn`, `pnpm install`, etc. to regenerate lock files. |
| Cloud/infra state files (`.tfstate`, `.aws/`, etc.) | BLOCKED: Cannot edit {file} — this file may contain cloud credentials or infrastructure state. | Edit infrastructure files in your editor or use the appropriate CLI tool. |
| Key/credential files (`.pem`, `.key`, `credentials.json`, etc.) | BLOCKED: Cannot edit {file} — this file may contain secrets or credentials. | Edit credential files in your editor. Never commit secrets to version control. |
| Hook stdin timeout (4s) | protect-sensitive: timed out reading input, blocking for safety | Safety fallback. Retry the operation. If persistent, check system load. |
| Hook stdin too large (>10KB) | protect-sensitive: input too large, blocking for safety | Safety fallback for abnormally large tool inputs. |

> **Configuration**: The hook is wired in `.claude/settings.json` under `PreToolUse`. To customize blocked patterns, edit `.claude/hooks/protect-sensitive.js`.
