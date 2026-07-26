# Infrastructure Documentation

> **Applicability**: This template is designed for web applications with a
> browser-based frontend. Remove or adapt this file for non-web projects.
> See SETUP.md Step 1, Feature Flags.

Hosting, deployment targets, networking, and environment topology for [PROJECT_NAME].

## Architecture Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Developer  │────▶│  Git Host    │────▶│  CI/CD       │
│   Workstation│     │  [GIT_HOST]  │     │  [CI_PLATFORM]│
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                          ┌───────────────────────┼──────────────┐
                          │                       │              │
                          ▼                       ▼              ▼
                   ┌──────────────┐      ┌──────────────┐ ┌──────────────┐
                   │  Staging     │      │  Production  │ │  Preview     │
                   │  Environment │      │  Environment │ │  Deploys     │
                   └──────────────┘      └──────────────┘ └──────────────┘
```

<!-- TODO: Replace placeholder labels with actual provider names -->

## Hosting

| Property | Value |
|----------|-------|
| Provider | [HOSTING_PROVIDER] |
| Plan / Tier | [PLAN_TIER] |
| Region | [REGION] |
| Runtime | [RUNTIME_ENVIRONMENT] |
| Account Owner | [ACCOUNT_OWNER] |

## Environments

| Environment | URL | Provider | Branch | Purpose |
|-------------|-----|----------|--------|---------|
| Development | `http://localhost:[DEV_PORT]` | Local | any | Local development |
| Preview | `[PREVIEW_URL_PATTERN]` | [HOSTING_PROVIDER] | PR branches | PR review deploys |
| Staging | `[STAGING_URL]` | [HOSTING_PROVIDER] | `main` | Pre-production testing |
| Production | `[PRODUCTION_URL]` | [HOSTING_PROVIDER] | `main` (tagged) | Live user traffic |

## Deployment

### Method

Deployments are triggered by [DEPLOY_TRIGGER_DESCRIPTION] and managed by [CI_PLATFORM].

### Triggers

| Event | Target Environment | Automatic |
|-------|-------------------|-----------|
| Push to feature branch | Preview | Yes |
| Merge to `main` | Staging | Yes |
| Git tag `v*` | Production | [YES_OR_MANUAL_APPROVAL] |
| Manual trigger | Any | Yes (via CI dashboard) |

### Domain and DNS

| Domain | Type | Provider | Points To |
|--------|------|----------|-----------|
| `[PRODUCTION_DOMAIN]` | Primary | [DNS_PROVIDER] | [HOSTING_PROVIDER] |
| `[WWW_DOMAIN_OR_REMOVE]` | Redirect | [DNS_PROVIDER] | `[PRODUCTION_DOMAIN]` |
| `[STAGING_DOMAIN_OR_REMOVE]` | Staging | [DNS_PROVIDER] | [HOSTING_PROVIDER] |

### SSL / TLS

SSL certificates are provisioned by [CERT_PROVIDER] with auto-renewal [ENABLED_OR_DISABLED]. Minimum TLS version: 1.2.

## Networking

### CDN

CDN provided by [CDN_PROVIDER] ([REGIONS_OR_GLOBAL] edge locations). Static asset TTL: [TTL_STATIC]. Cache purge: [MANUAL_OR_AUTO_ON_DEPLOY].

### Security Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Force HTTPS |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer leakage |
| `Content-Security-Policy` | `[CSP_POLICY]` | Restrict resource loading |
| `Permissions-Policy` | `[PERMISSIONS_POLICY_OR_REMOVE]` | Limit browser feature access |

## Scaling

| Dimension | Strategy | Details |
|-----------|----------|---------|
| Compute | [AUTO_SCALE_OR_FIXED] | [DETAILS] |
| Static assets | CDN edge caching | Served from nearest edge node |
| Database | [DB_SCALING_OR_REMOVE] | [DETAILS] |
| Rate limiting | [RATE_LIMIT_LOCATION] | See `./api.md` for per-endpoint limits |

## Cost

| Resource | Provider | Estimated Monthly Cost | Notes |
|----------|----------|----------------------|-------|
| Hosting | [HOSTING_PROVIDER] | [COST] | [PLAN_DETAILS] |
| Domain | [DNS_PROVIDER] | [COST] | Annual renewal |
| CDN | [CDN_PROVIDER] | [COST_OR_INCLUDED] | [BANDWIDTH_NOTES] |
| [ADDITIONAL_RESOURCE_OR_REMOVE] | [PROVIDER] | [COST] | [NOTES] |

## Rollback Procedure

If a production deployment introduces a critical issue:

1. **Identify** -- Confirm the issue is caused by the latest deployment (see `./monitoring.md`).
2. **Revert** -- Roll back to the previous known-good deployment:
   - **Option A (preferred)**: Trigger redeployment of the previous git tag via CI.
   - **Option B (instant)**: Use the hosting provider's "rollback to previous deployment" feature.
3. **Verify** -- Confirm health checks pass and the issue is resolved.
4. **Communicate** -- Notify the team in [PRIMARY_CHANNEL].
5. **Fix forward** -- Create a hotfix branch, fix the root cause, and deploy through the normal pipeline.
6. **Post-mortem** -- Document what happened and add preventive measures (see `./monitoring.md` incident response).

## Emergency Contacts

| Role | Contact | When to Reach Out |
|------|---------|-------------------|
| On-call engineer | [ON_CALL_CONTACT] | Production outage or degraded service |
| Hosting provider support | [PROVIDER_SUPPORT_URL] | Platform-level issues |
| DNS provider support | [DNS_SUPPORT_URL] | Domain resolution failures |
| Project owner | [PROJECT_OWNER_CONTACT] | P1 incidents, business-critical decisions |
