# Integration Documentation

Third-party APIs, webhooks, and service connections with configuration and usage patterns for [PROJECT_NAME].

## Overview

[PROJECT_NAME] integrates with external services for [INTEGRATION_PURPOSE_SUMMARY]. All integrations follow a server-side-only pattern to protect credentials.

## Integration Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  [PROJECT_NAME] │────▶│  [SERVICE_1]    │────▶│  [SERVICE_2]    │
│  (Application)  │     │  ([PURPOSE_1])  │     │  ([PURPOSE_2])  │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  [SERVICE_3]    │
│  ([PURPOSE_3])  │
└─────────────────┘
```

<!-- TODO: Replace with actual service names and their relationships -->

---

## [SERVICE_NAME]

**Purpose**: [SERVICE_PURPOSE]

### Configuration

| Property | Value |
|----------|-------|
| Provider | [PROVIDER_NAME] |
| API Version | [API_VERSION] |
| Base URL | `[API_BASE_URL]` |
| Documentation | [DOCS_URL] |

### Environment Variables

```bash
# Server-side only -- no PUBLIC_ prefix
[SERVICE_NAME_UPPER]_API_KEY=[API_KEY_VALUE]
[SERVICE_NAME_UPPER]_BASE_URL=[BASE_URL_VALUE]
```

### Authentication

| Method | Details |
|--------|---------|
| Type | [API_KEY / OAUTH2 / BEARER_TOKEN] |
| Header | `Authorization: Bearer [TOKEN]` |
| Rotation | [ROTATION_CADENCE] |

### Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Expired or invalid API key | Regenerate key in [PROVIDER_NAME] dashboard |
| `429 Too Many Requests` | Rate limit exceeded | Implement backoff; check provider dashboard |
| `500 Server Error` | Upstream service issue | Retry with exponential backoff; check status page |

<!-- TODO: Duplicate the service section above for each additional integration -->

---

## API Authentication Patterns

All external API calls are made server-side to prevent credential leakage.

| Pattern | When to Use | Notes |
|---------|-------------|-------|
| API Key in header | Simple service-to-service auth | Store in env; never prefix with `PUBLIC_` |
| OAuth 2.0 Client Credentials | Machine-to-machine with scoped access | Rotate client secret on schedule |
| Signed Webhooks | Receiving inbound events | Verify HMAC signature before processing |
| [ADDITIONAL_PATTERN_OR_REMOVE] | [USE_CASE] | [NOTES] |

## Error Handling

### Retry Strategy

Use exponential backoff for transient failures (5xx, network errors):

| Attempt | Delay | Cumulative Wait |
|---------|-------|-----------------|
| 1 | 2s | 2s |
| 2 | 4s | 6s |
| 3 | 8s | 14s |

- Maximum retries: 3. Do **not** retry on 4xx (client errors are deterministic).

## Data Mapping

| Internal Field | External Field | Transform |
|----------------|----------------|-----------|
| `[INTERNAL_1]` | `[EXTERNAL_1]` | [TRANSFORM_OR_NONE] |
| `[INTERNAL_2]` | `[EXTERNAL_2]` | [TRANSFORM_OR_NONE] |
| `[INTERNAL_3]` | `[EXTERNAL_3]` | [TRANSFORM_OR_NONE] |

## Monitoring

Track integration health (see also `./monitoring.md`):

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| External API response time | < 500ms | > 2s |
| External API error rate | < 0.5% | > 2% |
| Webhook delivery success | > 99% | < 95% |
