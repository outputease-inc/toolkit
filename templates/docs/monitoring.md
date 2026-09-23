# Observability Guide

> **Applicability**: This template is designed for web applications with
> browser-based monitoring. Remove or adapt this file for non-web projects.
> See SETUP.md Step 1, Feature Flags.

Logging, metrics, alerting, and health check configurations for [PROJECT_NAME].

## Health Checks

| Endpoint | Method | Expected Response | Frequency |
|----------|--------|-------------------|-----------|
| `/api/health` | GET | `200 OK` with `{ "status": "ok" }` | 30s |
| `/api/health/db` | GET | `200 OK` with connection pool stats | 60s |
| `/api/health/dependencies` | GET | `200 OK` with upstream service status | 120s |
| `[ADDITIONAL_HEALTH_ENDPOINT_OR_REMOVE]` | GET | `200 OK` | [FREQUENCY] |

<!-- TODO: Add project-specific health check endpoints as features are built -->

Health check responses should include a `version` field for deployment verification:

```json
{
  "status": "ok",
  "version": "[APP_VERSION]",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

## Logging

### Log Levels

| Level | Usage | Example |
|-------|-------|---------|
| `error` | Unrecoverable failures requiring immediate attention | Database connection lost, unhandled exception |
| `warn` | Degraded behavior that does not block the user | Retry succeeded after transient failure, deprecated API usage |
| `info` | Normal operational events worth recording | Request served, deployment started, user action completed |
| `debug` | Detailed diagnostic data for development | Query parameters, intermediate computation results |

### Conventions

- Use structured JSON logs in production; human-readable format in development.
- Every log entry must include: `timestamp`, `level`, `message`, `requestId`.
- Never log secrets, tokens, passwords, or personally identifiable information (PII).
- Include `correlationId` for tracing requests across services.

### Log Locations

| Environment | Destination | Retention |
|-------------|-------------|-----------|
| Development | `stdout` / terminal | Session only |
| Staging | [LOG_PROVIDER_STAGING] | 7 days |
| Production | [LOG_PROVIDER_PRODUCTION] | 30 days |

## Metrics

### Key Metrics

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| Response time (p50) | Median request latency | < 200ms | > 500ms |
| Response time (p99) | Tail latency | < 1s | > 3s |
| Error rate | Percentage of 5xx responses | < 0.1% | > 1% |
| Uptime | Service availability | 99.9% | < 99.5% |
| CPU utilization | Server processor usage | < 60% | > 85% |
| Memory utilization | Server memory usage | < 70% | > 90% |
| [CUSTOM_METRIC_OR_REMOVE] | [DESCRIPTION] | [TARGET] | [THRESHOLD] |

## Alerting

### Channels

| Channel | Purpose | Audience |
|---------|---------|----------|
| [ALERT_CHANNEL_PRIMARY] | Critical production alerts | On-call engineer |
| [ALERT_CHANNEL_SECONDARY] | Warning-level notifications | Engineering team |
| Email | Daily/weekly summaries | Stakeholders |

### Alert Rules

| Rule | Condition | Severity | Channel |
|------|-----------|----------|---------|
| High error rate | Error rate > 1% for 5 min | P1 | [ALERT_CHANNEL_PRIMARY] |
| Slow responses | p99 latency > 3s for 10 min | P2 | [ALERT_CHANNEL_SECONDARY] |
| Health check failure | 3 consecutive failures | P1 | [ALERT_CHANNEL_PRIMARY] |
| Disk usage high | Disk > 85% | P2 | [ALERT_CHANNEL_SECONDARY] |
| Dependency down | Upstream returns 5xx for 5 min | P2 | [ALERT_CHANNEL_PRIMARY] |

## Error Tracking

- Use [ERROR_TRACKING_PROVIDER] for capturing and grouping runtime errors.
- Configure source maps for readable stack traces in production.
- Tag errors with `environment`, `release`, and `user` context.
- Set up release tracking to correlate deploys with new error patterns.

## Dashboards

Maintain the following dashboards in [DASHBOARD_PROVIDER]:

| Dashboard | Contents | Audience |
|-----------|----------|----------|
| Service Overview | Uptime, latency, error rate, throughput | All engineers |
| Infrastructure | CPU, memory, disk, network | DevOps / on-call |
| Business Metrics | [BUSINESS_METRICS_OR_REMOVE] | Product / stakeholders |

## Incident Response

### Severity Levels

| Severity | Definition | Response Time | Examples |
|----------|------------|---------------|----------|
| P1 - Critical | Service down or data loss risk | 15 min acknowledge, 1 hr resolve | Complete outage, security breach, data corruption |
| P2 - High | Major feature degraded | 1 hr acknowledge, 4 hr resolve | Partial outage, payment failures, auth broken |
| P3 - Medium | Minor feature impacted | 4 hr acknowledge, 24 hr resolve | UI glitch, non-critical integration down, slow queries |

### Incident Workflow

1. **Detect** -- Alert fires or user reports issue.
2. **Acknowledge** -- On-call confirms receipt within SLA.
3. **Triage** -- Assign severity, create incident channel.
4. **Mitigate** -- Apply immediate fix or rollback (see `./infrastructure.md`).
5. **Resolve** -- Confirm service restored, close alert.
6. **Post-mortem** -- Document root cause, timeline, and preventive actions.

### Escalation Contacts

| Role | Contact | Escalation Trigger |
|------|---------|-------------------|
| On-call engineer | [ON_CALL_CONTACT] | P1 or P2 alert fires |
| Engineering lead | [ENG_LEAD_CONTACT] | P1 unresolved after 30 min |
| Project owner | [PROJECT_OWNER_CONTACT] | P1 unresolved after 1 hr |
