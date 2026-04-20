---
name: error-handling
domain: development
---
# Error Handling

Design robust error handling that helps users and developers.

## Process Steps
1. Categorize the error: validation, auth, not-found, conflict, or internal
2. Choose the appropriate HTTP status code and error code string
3. Write a human-readable message explaining what happened and what to do
4. Add structured details (field-level errors, retry info) where applicable
5. Log the error with context (request ID, user ID, stack trace) — never log secrets
6. Implement retry/circuit-breaker for transient upstream failures

## Principles
- Fail fast: detect errors early, close to the source
- Fail loud: log errors with context, never swallow silently
- Fail gracefully: degrade functionality, don't crash entirely
- Fail informatively: error messages should explain what happened and what to do

## Error Categories
- Validation errors: bad input from the user (400)
- Authentication errors: who are you? (401)
- Authorization errors: you can't do that (403)
- Not found: resource doesn't exist (404)
- Conflict: state prevents the action (409)
- Internal errors: something broke on our side (500)
- Upstream errors: a dependency failed (502/503)

## Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable description",
    "details": [
      { "field": "email", "issue": "Invalid format" }
    ]
  }
}
```

## Retry Strategy
- Retry only on transient errors (network timeout, 503)
- Exponential backoff with jitter
- Set a max retry count (typically 3)
- Circuit breaker for repeated failures

## Logging
- Log the error, stack trace, request context, and user ID
- Never log passwords, tokens, or PII
- Use structured logging (JSON) for machine parsing
- Include correlation IDs for distributed tracing

## Anti-Patterns
- Swallowing exceptions with empty catch blocks
- Returning HTTP 200 with an error message in the body
- Exposing stack traces or internal paths to the client
- Using generic "Something went wrong" for all errors
- Retrying on non-transient errors (400, 404)

## Output Format
An error handling specification with: error category table (code, status, message template), retry policy, logging format, and client-facing error contract.

## Examples

### Example: Handle a missing resource
**Request**: `GET /api/users/999`

**Response** (404):
```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "No user found with ID 999.",
    "details": []
  }
}
```

**Log**: `{ level: "warn", code: "USER_NOT_FOUND", userId: 999, requestId: "abc-123" }`
