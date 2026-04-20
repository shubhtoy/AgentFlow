---
type: instruction
name: api-design
scope: workflow
domain: development
description: Best practices for designing clean, consistent APIs
tags:
  - api
  - rest
  - contracts
narrativeTemplate:
  prefix: "Apply"
  suffix: "for the API contracts"
---

# API Design

Best practices for designing clean, consistent APIs.

## URL Structure
- Nouns for resources, not verbs: `/users` not `/getUsers`
- Plural nouns: `/orders` not `/order`
- Nested for relationships: `/users/{id}/orders`
- Max 2 levels of nesting

## HTTP Methods
- GET: read (idempotent, cacheable)
- POST: create
- PUT: full replace
- PATCH: partial update
- DELETE: remove

## Response Format
- Consistent envelope: `{ data, error, meta }`
- Pagination: `{ data, meta: { page, perPage, total } }`
- Errors: `{ error: { code, message, details[] } }`
- HTTP status codes match semantics

## Versioning
- URL prefix: `/v1/users`
- Never break existing clients — additive changes only

## Security
- Authentication on every endpoint (except public)
- Rate limiting with clear headers
- Input validation with descriptive errors
- No sensitive data in URLs
