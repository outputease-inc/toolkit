# Authentication Guide

> **Applicability**: This template is designed for applications with user
> authentication. Remove or adapt this file for non-authenticated projects.
> See SETUP.md Step 1, Feature Flags.

Auth flows, session management, role-based access, and token handling for [PROJECT_NAME].

## Overview

| Property | Value |
|----------|-------|
| Auth provider | [AUTH_PROVIDER] |
| Session strategy | [SESSION_STRATEGY] (e.g., JWT, cookie-based, OAuth) |
| Token storage | [TOKEN_STORAGE] (e.g., httpOnly cookie, secure header) |
| MFA support | [MFA_SUPPORT_OR_REMOVE] |

## Auth Flow

<!-- TODO: Replace or refine the ASCII diagram below to match your actual auth flow -->

```
                        [AUTH_FLOW_DIAGRAM]

  Client                     Server                   Auth Provider
    |                          |                           |
    |--- 1. Login request ---->|                           |
    |                          |--- 2. Verify credentials ->|
    |                          |<-- 3. Auth token/session --|
    |<-- 4. Set session -------|                           |
    |                          |                           |
    |--- 5. API request ------>|                           |
    |    (with token/cookie)   |--- 6. Validate token ---->|
    |                          |<-- 7. Token valid --------|
    |<-- 8. Response ----------|                           |
```

## Auth Provider

| Setting | Value |
|---------|-------|
| Provider | [AUTH_PROVIDER] |
| SDK/Library | [AUTH_LIBRARY] |
| Config file | [AUTH_CONFIG_PATH] |
| Callback URL | [CALLBACK_URL] |
| Logout URL | [LOGOUT_URL] |

## Session Management

- **Duration**: [SESSION_DURATION] (e.g., 24 hours)
- **Refresh window**: [REFRESH_WINDOW] before expiry
- **Storage**: [SESSION_STORAGE_LOCATION] (e.g., encrypted cookie, server-side store)
- **Invalidation**: Sessions are invalidated on logout, password change, and [ADDITIONAL_INVALIDATION_TRIGGERS]
- **Concurrent sessions**: [CONCURRENT_SESSION_POLICY] (e.g., allowed, single-device only)

## Roles and Permissions

| Role | Description | Permissions |
|------|-------------|------------|
| `[ROLE_ADMIN]` | Full system access | All operations |
| `[ROLE_USER]` | Standard user | Read/write own resources |
| `[ROLE_VIEWER]` | Read-only access | Read all, write none |
| [ADDITIONAL_ROLES_OR_REMOVE] | | |

### Permission Checks

Permissions are enforced at [ENFORCEMENT_LAYER] (e.g., middleware, route handler, database policy):

- Check role **before** executing any data mutation
- Return `403 FORBIDDEN` for valid auth with insufficient permissions
- Return `401 UNAUTHORIZED` for missing or invalid credentials
- Log all permission denials at `warn` level

## Protected Routes

| Route Pattern | Required Role | Notes |
|---------------|--------------|-------|
| `[ADMIN_ROUTES]` | [ROLE_ADMIN] | Administrative functions |
| `[API_ROUTES]` | [ROLE_USER]+ | Authenticated API access |
| `[PUBLIC_ROUTES]` | None | Login, registration, public pages |
| [ADDITIONAL_ROUTE_RULES_OR_REMOVE] | | |

## Token Handling

### Storage

- **Access token**: Stored in [ACCESS_TOKEN_STORAGE] (e.g., httpOnly cookie, memory)
- **Refresh token**: Stored in [REFRESH_TOKEN_STORAGE] (e.g., httpOnly cookie, secure DB)
- **Never** store tokens in `localStorage` or non-httpOnly cookies

### Refresh Flow

1. Client detects token expiration (or receives `401` response)
2. Client sends refresh token to `[REFRESH_ENDPOINT]`
3. Server validates refresh token and issues new access token
4. If refresh token is expired, redirect to login

### Security

- Set `httpOnly`, `Secure`, `SameSite=Strict` on auth cookies
- Rotate refresh tokens on each use (one-time use)
- Include CSRF protection for cookie-based auth
- Set short access token TTL ([ACCESS_TOKEN_TTL])

## Implementation Patterns

| Component | Location | Purpose |
|-----------|----------|---------|
| Auth middleware | `[AUTH_MIDDLEWARE_PATH]` | Validate session/token, attach user context |
| [AUTH_HELPER_1] | [PATH] | [PURPOSE] |
| [AUTH_HELPER_2] | [PATH] | [PURPOSE] |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `[AUTH_SECRET_VAR]` | Yes | Token signing secret |
| `[AUTH_PROVIDER_ID_VAR]` | Yes | OAuth client ID |
| `[AUTH_PROVIDER_SECRET_VAR]` | Yes | OAuth client secret |
| `[AUTH_CALLBACK_URL_VAR]` | Yes | OAuth callback URL |
| [ADDITIONAL_AUTH_VARS_OR_REMOVE] | | |

See also: `./environment.md` for full environment configuration.

## Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| `401` on all requests | Expired or missing token | Check token TTL and refresh flow |
| `403` after login | Insufficient role | Verify user role in database |
| Redirect loop on login | Callback URL mismatch | Compare `[AUTH_CALLBACK_URL_VAR]` with provider config |
| Session lost on refresh | Cookie settings | Verify `SameSite`, `Secure`, and domain settings |
| Token not refreshing | Refresh token expired | Check refresh token TTL and rotation logic |
