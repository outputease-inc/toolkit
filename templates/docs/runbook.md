# Operations Runbook

Operational procedures for incident response, deployment rollback, database maintenance, and common troubleshooting workflows for [PROJECT_NAME].

## Incident Response Procedure

When a production incident is detected:

1. **Acknowledge** -- Confirm the incident in [ALERTING_CHANNEL] within [RESPONSE_SLA]
2. **Assess severity** -- Classify using the severity table below
3. **Communicate** -- Post an initial status update in [STATUS_PAGE_OR_CHANNEL]
4. **Mitigate** -- Apply the quickest fix to restore service (rollback, feature flag, scale)
5. **Investigate** -- Identify root cause using logs, metrics, and traces
6. **Resolve** -- Deploy a permanent fix through the standard pipeline
7. **Document** -- Complete the post-incident review (see template below)

### Severity Classification

| Severity | Definition | Response Time | Example |
|----------|-----------|---------------|---------|
| P1 - Critical | Service down, data loss risk | < [P1_SLA] | Production outage, security breach |
| P2 - Major | Major feature broken, workaround exists | < [P2_SLA] | Auth failures for subset of users |
| P3 - Minor | Minor feature broken, low impact | < [P3_SLA] | UI glitch, non-critical API degradation |
| P4 - Low | Cosmetic, no user impact | Next business day | Typo, minor logging issue |

## Deployment Rollback

When a deployment causes issues, roll back immediately:

1. **Confirm** the issue is deployment-related (check deploy timestamp vs. incident start)
2. **Notify** the team in [ALERTING_CHANNEL]: "Rolling back deployment [VERSION]"
3. **Execute rollback**:
   ```bash
   [ROLLBACK_COMMAND]
   ```
4. **Verify** the rollback resolved the issue:
   ```bash
   [HEALTH_CHECK_COMMAND]
   ```
5. **Monitor** for [MONITOR_DURATION] after rollback to confirm stability
6. **Document** what went wrong and create a fix on a separate branch

### Rollback Decision Matrix

| Condition | Action |
|-----------|--------|
| Error rate > [ROLLBACK_ERROR_THRESHOLD]% | Immediate rollback |
| P95 latency > [ROLLBACK_LATENCY_THRESHOLD] | Rollback if not improving within 5 min |
| Single user report, metrics normal | Investigate before rollback |
| Data migration included | Follow database rollback procedure below |

## Database Maintenance

| Operation | Command |
|-----------|---------|
| Manual backup | `[DB_BACKUP_COMMAND]` |
| Verify backup | `[DB_VERIFY_BACKUP_COMMAND]` |
| Migration status | `[MIGRATE_STATUS_COMMAND]` |
| Rollback last migration | `[MIGRATE_ROLLBACK_COMMAND]` |
| Rollback to version | `[MIGRATE_ROLLBACK_TO_COMMAND] [VERSION]` |
| Restore from backup | `[DB_RESTORE_COMMAND]` |

- **Automated backups**: [BACKUP_SCHEDULE] via [BACKUP_SERVICE], retained [BACKUP_RETENTION_PERIOD]
- **Before migration rollback**: Verify `down` function is safe, check for dependent data, take a backup
- **Restore procedure**: Stop app, restore backup, re-run post-backup migrations, verify, restart

## Health Check Procedures

| Check | Command / URL | Expected Result | Frequency |
|-------|--------------|-----------------|-----------|
| Application health | `[HEALTH_ENDPOINT]` | `200 OK` with status payload | Every [HEALTH_INTERVAL] |
| Database connectivity | `[DB_HEALTH_CHECK]` | Connection successful | Every [HEALTH_INTERVAL] |
| External dependencies | `[DEPS_HEALTH_CHECK]` | All services reachable | Every [HEALTH_INTERVAL] |
| Disk space | `[DISK_CHECK_COMMAND]` | > [MIN_DISK_SPACE] free | Daily |
| SSL certificate | `[SSL_CHECK_COMMAND]` | > 30 days until expiry | Weekly |

## Common Issues and Resolution

| Issue | Symptoms | Resolution |
|-------|----------|------------|
| Out of memory | Application crashes, OOM errors | Restart service, investigate memory leak |
| Database connection pool exhausted | Timeout errors, slow responses | Restart app, check for connection leaks |
| SSL certificate expiring | Browser warnings, API rejections | Renew certificate via [CERT_RENEWAL_PROCESS] |
| Disk space full | Write errors, logging failures | Clean old logs, expand storage |
| Rate limiting triggered | 429 responses from upstream | Reduce request frequency, contact provider |
| [PROJECT_SPECIFIC_ISSUE_1] | [SYMPTOMS] | [RESOLUTION] |
| [PROJECT_SPECIFIC_ISSUE_2] | [SYMPTOMS] | [RESOLUTION] |

## Escalation Matrix

| Level | Role | Contact | When to Escalate |
|-------|------|---------|-----------------|
| L1 | On-call developer | [L1_CONTACT] | First response, known issues |
| L2 | Senior developer | [L2_CONTACT] | Unknown root cause after [L1_TIMEOUT] |
| L3 | [TECH_LEAD_OR_ARCHITECT] | [L3_CONTACT] | Architecture-level issue, data loss risk |
| L4 | [MANAGEMENT_CONTACT] | [L4_CONTACT] | P1 lasting > [ESCALATION_THRESHOLD], customer impact |

## Scheduled Maintenance

- **Window**: [MAINTENANCE_DAY], [MAINTENANCE_START] - [MAINTENANCE_END] UTC
- **Pre-maintenance**: Notify users [MAINTENANCE_NOTICE_PERIOD] in advance, take full backup, confirm rollback procedure
- **Post-maintenance**: Run health checks, monitor for [POST_MAINTENANCE_MONITOR], update [STATUS_PAGE_OR_CHANNEL]

## Post-Incident Review

Complete within [PIR_DEADLINE] of incident resolution. Each review must include:

| Section | Content |
|---------|---------|
| Summary | Date, severity, duration, user impact |
| Timeline | Timestamped sequence of events |
| Root Cause | What failed and why |
| Resolution | How the incident was resolved |
| Action Items | Owner, due date, and status for each follow-up |
| Lessons Learned | What to change to prevent recurrence |

See also: `./errors.md` for error code reference and `./environment.md` for environment configuration.
