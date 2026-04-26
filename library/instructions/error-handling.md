---
name: error-handling
description: Never swallow errors — explicit error handling patterns, guard clauses, custom types, and logging strategy
domain: development
tags:
  - errors
  - exceptions
  - logging
  - reliability
---

# Error Handling

Never swallow errors. Every error should be handled explicitly, logged appropriately, and surfaced to the right audience.

## Core Rules

1. **Never use empty catch blocks.** If you catch an error, do something with it.
2. **Fail fast.** Validate inputs at the boundary. Don't let bad data propagate.
3. **Fail loudly.** Silent failures are the hardest bugs to diagnose.
4. **Handle errors at the right level.** Catch where you can meaningfully recover, not everywhere.

## Guard Clauses

Validate preconditions at the top of every function. Return or throw early.

```
// Good — fail fast, clear intent
function getUser(id) {
  if (!id) throw new Error('User ID is required');
  if (typeof id !== 'string') throw new TypeError('User ID must be a string');
  // ... happy path
}
```

Don't nest the happy path inside validation conditionals. Invert the condition and return early.

## Custom Error Types

Create domain-specific error types for errors that callers need to handle differently:
- `ValidationError` — bad input from the user
- `NotFoundError` — requested resource doesn't exist
- `ConflictError` — operation conflicts with current state
- `ExternalServiceError` — upstream dependency failed

Include context in the error: what operation failed, what input caused it, what was expected.

## Error Propagation

- **Rethrow with context** when you can't handle the error but can add useful information
- **Wrap errors** to preserve the original stack trace while adding domain context
- **Transform errors** at API boundaries — internal errors become user-facing messages
- **Never expose internal details** (stack traces, file paths, SQL) to end users

## Logging Strategy

- **ERROR:** Something failed that shouldn't have. Requires investigation.
- **WARN:** Something unexpected happened but was handled. Monitor for patterns.
- **INFO:** Significant business events (user created, order placed, deploy started).
- **DEBUG:** Detailed execution flow for troubleshooting. Off in production.

### What to Log
- The operation that failed and its inputs (sanitized — no PII or secrets)
- The error type, message, and stack trace
- Correlation IDs for tracing across services
- Timing information for performance-sensitive operations

### What NOT to Log
- Passwords, tokens, API keys, or secrets
- Full request/response bodies (too verbose, may contain PII)
- Expected errors at ERROR level (use WARN or INFO)

## Anti-Patterns
- Catching `Error` at the top level and returning a generic "something went wrong"
- Logging the error and then also throwing it (double-logging)
- Using exceptions for control flow (use return values or result types)
- Retrying without backoff or retry limits
- Swallowing errors in fire-and-forget async operations
