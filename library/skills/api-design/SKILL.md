---
name: api-design
description: RESTful API design best practices — resource naming, HTTP methods, status codes, pagination, filtering, error responses, versioning, and authentication patterns. Includes OpenAPI spec guidance.
---

# API Design

## Core Principles

1. **Resources, not actions.** URLs identify things (nouns), not operations (verbs).
2. **HTTP methods express intent.** GET reads, POST creates, PUT replaces, PATCH updates, DELETE removes.
3. **Consistency over cleverness.** Every endpoint should feel like it belongs to the same API.
4. **Errors are part of the contract.** Error responses deserve as much design as success responses.

## Resource Naming

### URL Structure

```
/{version}/{resource-collection}/{resource-id}/{sub-resource-collection}/{sub-resource-id}
```

### Rules

- Use plural nouns: `/users`, `/orders`, `/products`
- Use kebab-case: `/order-items`, not `/orderItems` or `/order_items`
- Use lowercase: `/users`, not `/Users`
- No trailing slashes: `/users`, not `/users/`
- No file extensions: `/users/123`, not `/users/123.json`
- No verbs in URLs: `/users/123/activate` → `PATCH /users/123` with `{ "status": "active" }`
- Nest only for true parent-child relationships: `/users/123/orders` (orders belonging to user 123)
- Limit nesting to 2 levels: `/users/123/orders/456` is fine. `/users/123/orders/456/items/789/variants` is not — flatten it.

### Examples

```
GET    /v1/users                    # List users
POST   /v1/users                    # Create user
GET    /v1/users/123                # Get user
PUT    /v1/users/123                # Replace user
PATCH  /v1/users/123                # Update user fields
DELETE /v1/users/123                # Delete user
GET    /v1/users/123/orders         # List user's orders
POST   /v1/users/123/orders         # Create order for user
```

## HTTP Methods

| Method | Semantics | Idempotent | Safe | Request Body | Response Body |
|--------|-----------|------------|------|-------------|---------------|
| GET | Read resource(s) | Yes | Yes | No | Yes |
| POST | Create resource | No | No | Yes | Yes |
| PUT | Replace resource entirely | Yes | No | Yes | Yes |
| PATCH | Update resource partially | No* | No | Yes | Yes |
| DELETE | Remove resource | Yes | No | No | Optional |

*PATCH can be made idempotent with JSON Merge Patch semantics.

### Method Selection

- **GET** — Never mutate state. Must be safe to retry, cache, and prefetch.
- **POST** — Use for creation and for operations that don't fit CRUD (e.g., `/v1/reports/generate`).
- **PUT** — Send the complete resource. Missing fields are set to defaults or null.
- **PATCH** — Send only the fields to update. Missing fields are unchanged.
- **DELETE** — Return 204 No Content on success. Return 404 if already deleted (idempotent).

## Status Codes

### Success

| Code | Meaning | When to Use |
|------|---------|-------------|
| 200 | OK | GET, PUT, PATCH success with response body |
| 201 | Created | POST success. Include `Location` header with new resource URL |
| 204 | No Content | DELETE success. PUT/PATCH when no body is returned |

### Client Errors

| Code | Meaning | When to Use |
|------|---------|-------------|
| 400 | Bad Request | Malformed syntax, invalid field values, missing required fields |
| 401 | Unauthorized | Missing or invalid authentication credentials |
| 403 | Forbidden | Valid credentials but insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 405 | Method Not Allowed | HTTP method not supported for this resource |
| 409 | Conflict | Resource state conflict (duplicate, version mismatch) |
| 422 | Unprocessable Entity | Syntactically valid but semantically invalid (business rule violation) |
| 429 | Too Many Requests | Rate limit exceeded. Include `Retry-After` header |

### Server Errors

| Code | Meaning | When to Use |
|------|---------|-------------|
| 500 | Internal Server Error | Unexpected server failure. Never expose internal details |
| 502 | Bad Gateway | Upstream service returned invalid response |
| 503 | Service Unavailable | Server overloaded or in maintenance. Include `Retry-After` |
| 504 | Gateway Timeout | Upstream service did not respond in time |

## Error Responses

Use a consistent error format across all endpoints:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email address",
        "value": "not-an-email"
      },
      {
        "field": "age",
        "message": "Must be between 0 and 150",
        "value": -5
      }
    ]
  }
}
```

### Error Design Rules

- Use machine-readable error codes (`VALIDATION_ERROR`, `NOT_FOUND`, `RATE_LIMITED`)
- Include human-readable messages for debugging
- Never expose stack traces, internal paths, or database details in production
- Include field-level details for validation errors
- Use the same error envelope for all error responses

## Pagination

### Cursor-Based (Preferred)

```
GET /v1/users?limit=20&cursor=eyJpZCI6MTIzfQ
```

Response:
```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTQzfQ",
    "has_more": true
  }
}
```

Advantages: stable under inserts/deletes, performant with large datasets.

### Offset-Based (Simple)

```
GET /v1/users?limit=20&offset=40
```

Response:
```json
{
  "data": [...],
  "pagination": {
    "total": 1234,
    "limit": 20,
    "offset": 40
  }
}
```

Disadvantages: skips or duplicates items when data changes between pages. Slow for large offsets.

### Pagination Rules

- Always set a default limit (e.g., 20)
- Always set a maximum limit (e.g., 100)
- Return pagination metadata in every list response
- Use cursor-based pagination for large or frequently changing datasets

## Filtering, Sorting, and Search

### Filtering

Use query parameters with field names:

```
GET /v1/users?status=active&role=admin
GET /v1/orders?created_after=2024-01-01&total_min=100
```

For complex filters, use a structured syntax:

```
GET /v1/products?filter[price][gte]=10&filter[price][lte]=100
```

### Sorting

```
GET /v1/users?sort=created_at        # ascending (default)
GET /v1/users?sort=-created_at       # descending (prefix with -)
GET /v1/users?sort=-created_at,name  # multi-field sort
```

### Search

```
GET /v1/users?q=alice                # full-text search
```

## Versioning

### URL Path Versioning (Recommended)

```
GET /v1/users
GET /v2/users
```

Simple, explicit, easy to route. Use this unless you have a strong reason not to.

### Header Versioning

```
GET /users
Accept: application/vnd.myapi.v2+json
```

Cleaner URLs but harder to test and debug.

### Versioning Rules

- Version the API from day one — adding it later is painful
- Increment the major version only for breaking changes
- Support at least one previous version during migration
- Document the deprecation timeline clearly

## Authentication

### Bearer Token (OAuth 2.0 / JWT)

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

Use for user-facing APIs. Tokens should be short-lived with refresh token rotation.

### API Key

```
X-API-Key: sk_live_abc123...
```

Use for server-to-server communication. Scope keys to specific permissions.

### Authentication Rules

- Always use HTTPS — never transmit credentials over HTTP
- Use short-lived tokens (15-60 minutes) with refresh tokens
- Include rate limiting per API key or token
- Return 401 for missing/invalid credentials, 403 for insufficient permissions
- Never include credentials in URLs (query parameters are logged)

## OpenAPI Specification

Document every endpoint with OpenAPI 3.x:

```yaml
openapi: 3.0.3
info:
  title: My API
  version: 1.0.0

paths:
  /v1/users:
    get:
      summary: List users
      operationId: listUsers
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
        - name: cursor
          in: query
          schema:
            type: string
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserList'
        '401':
          $ref: '#/components/responses/Unauthorized'
```

### OpenAPI Rules

- Write the spec before implementing — it is the contract
- Use `$ref` for reusable schemas, parameters, and responses
- Include examples for every request and response
- Document all error responses, not just the happy path
- Generate client SDKs and server stubs from the spec
- Keep the spec in version control alongside the code

## Design Checklist

- [ ] Resources are nouns, not verbs
- [ ] HTTP methods match semantics
- [ ] Status codes are correct and consistent
- [ ] Error responses use a consistent envelope
- [ ] Pagination is implemented for all list endpoints
- [ ] Filtering and sorting use query parameters
- [ ] API is versioned from the start
- [ ] Authentication is required for all non-public endpoints
- [ ] Rate limiting is in place
- [ ] OpenAPI spec is written and up to date
- [ ] All responses include appropriate `Content-Type` headers
- [ ] CORS is configured for browser clients
