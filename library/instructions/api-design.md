---
name: api-design
description: Best practices for designing clean, consistent, and evolvable APIs
domain: development
tags:
  - api
  - rest
  - contracts
---

# API Design

Best practices for designing clean, consistent APIs that are easy to use and hard to misuse.

## URL Structure
- Nouns for resources, not verbs: `/users` not `/getUsers`
- Plural nouns: `/orders` not `/order`
- Nested for relationships: `/users/{id}/orders`
- Max 2 levels of nesting — flatten deeper hierarchies
- Use kebab-case for multi-word paths: `/order-items`
- Keep URLs lowercase

## HTTP Methods
- **GET:** read (idempotent, cacheable, no body)
- **POST:** create a new resource or trigger an action
- **PUT:** full replace of an existing resource
- **PATCH:** partial update of specific fields
- **DELETE:** remove a resource (idempotent)

## Request/Response Design
- Consistent envelope: `{ data, error, meta }`
- Pagination: `{ data, meta: { page, perPage, total, nextCursor } }`
- Errors: `{ error: { code, message, details[] } }`
- HTTP status codes must match semantics (don't return 200 with an error body)
- Use `Content-Type` headers consistently
- Accept and return JSON by default

## Versioning
- URL prefix: `/v1/users`
- Never break existing clients — additive changes only
- Deprecate before removing — give clients migration time
- Document breaking changes with a migration guide

## Security
- Authentication on every endpoint (except explicitly public ones)
- Rate limiting with clear `Retry-After` headers
- Input validation with descriptive error messages
- No sensitive data in URLs (use headers or body)
- CORS configuration for browser clients
- Validate content types to prevent injection

## Pagination
- Use cursor-based pagination for large or frequently changing datasets
- Use offset-based pagination only for small, stable datasets
- Always include total count when feasible
- Set reasonable default and maximum page sizes

## Error Handling
- Use standard HTTP status codes (400, 401, 403, 404, 409, 422, 500)
- Include machine-readable error codes for programmatic handling
- Include human-readable messages for debugging
- Never expose internal stack traces or implementation details in errors
