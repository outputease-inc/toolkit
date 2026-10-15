# API Reference

> **Applicability**: This template is designed for web applications with
> REST/GraphQL APIs. Remove or adapt this file for non-web projects.
> See SETUP.md Step 1, Feature Flags.

Endpoints, request/response schemas, authentication requirements, and error codes for [PROJECT_NAME].

## Overview

The [PROJECT_NAME] API provides [API_PURPOSE_SUMMARY]. All endpoints return JSON and follow REST conventions.

## Base URL

| Environment | Base URL |
|-------------|----------|
| Development | `http://localhost:[DEV_PORT]/api` |
| Production | `https://[PRODUCTION_DOMAIN]/api` |

## Authentication

| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer [TOKEN]` | Yes (protected routes) |
| `Content-Type` | `application/json` | Yes (POST/PUT/PATCH) |

<!-- TODO: Document your token acquisition flow (e.g., OAuth, API key, session) -->

## Endpoints

### [HTTP_METHOD] /api/[RESOURCE]

[ENDPOINT_DESCRIPTION]

#### Request

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `[PARAM]` | `string` | Yes | [DESCRIPTION] |

**Body**

```json
{
  "[FIELD_1]": "[TYPE] -- [DESCRIPTION]",
  "[FIELD_2]": "[TYPE] -- [DESCRIPTION]"
}
```

#### Response

```json
{
  "success": true,
  "data": { "[FIELD]": "[VALUE]" }
}
```

#### Example

```bash
curl -X [METHOD] https://[PRODUCTION_DOMAIN]/api/[RESOURCE] \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "[FIELD_1]": "[VALUE]" }'
```

---

### [HTTP_METHOD] /api/[RESOURCE_2]

[ENDPOINT_DESCRIPTION]

#### Request

**Headers**: See Authentication section above.

#### Response

```json
{
  "success": true,
  "data": { "id": "[GENERATED_ID]", "[FIELD]": "[VALUE]" }
}
```

<!-- TODO: Duplicate the endpoint template above for each additional endpoint -->

## Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| `200` | OK | Successful GET, PUT, or PATCH |
| `201` | Created | Successful POST that creates a resource |
| `204` | No Content | Successful DELETE |
| `400` | Bad Request | Validation errors or malformed input |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Authenticated but insufficient permissions |
| `404` | Not Found | Resource does not exist |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server failure |

## Rate Limits

| Scope | Threshold | Window | Header |
|-------|-----------|--------|--------|
| Authenticated requests | [RATE_LIMIT_AUTH] req | [WINDOW] | `X-RateLimit-Remaining` |
| Unauthenticated requests | [RATE_LIMIT_UNAUTH] req | [WINDOW] | `X-RateLimit-Remaining` |
| [ENDPOINT_SPECIFIC_OR_REMOVE] | [LIMIT] req | [WINDOW] | `X-RateLimit-Remaining` |

When rate-limited, the API returns `429` with a `Retry-After` header indicating seconds until reset.

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description of what went wrong.",
    "details": [
      { "field": "email", "message": "Must be a valid email address." }
    ]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `error.code` | `string` | Machine-readable error identifier |
| `error.message` | `string` | Human-readable summary |
| `error.details` | `array` | Per-field validation errors (optional) |

For a full list of error codes, see `./errors.md`.
