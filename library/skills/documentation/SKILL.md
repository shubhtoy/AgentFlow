---
name: documentation
description: Write effective technical documentation — README structure, API docs, architecture decision records, inline comments, and progressive disclosure. Explain why, not what.
---

# Documentation

## Core Principle

Documentation exists to reduce the time between "I have a question" and "I have an answer." Every sentence must earn its place. If it doesn't help someone do something or understand something, remove it.

## The Why-Not-What Rule

Code tells you WHAT happens. Documentation tells you WHY.

Bad comment:
```python
# Increment counter by 1
counter += 1
```

Good comment:
```python
# Rate limiter requires a minimum of 3 failed attempts before
# triggering lockout, so we track attempts across requests.
counter += 1
```

Apply this rule everywhere: inline comments, commit messages, PR descriptions, README sections, ADRs.

## Progressive Disclosure

Structure documentation in layers. The reader should get value at every level without reading everything:

1. **Title + one-line description** — Is this relevant to me?
2. **Quick start** — How do I use this in 2 minutes?
3. **Core concepts** — What do I need to understand?
4. **Detailed reference** — What are all the options?
5. **Troubleshooting** — What if something goes wrong?

Most readers stop at level 2. Write for them first.

## README Structure

Every project README should follow this structure:

```markdown
# Project Name

One paragraph: what this does and why it exists.

## Quick Start

Minimal steps to get running. Copy-pasteable commands.

## Installation

Prerequisites, dependencies, environment setup.

## Usage

Common use cases with examples. Show the 3 most frequent
operations, not every possible option.

## Configuration

Environment variables, config files, feature flags.
Table format with name, type, default, and description.

## Architecture

High-level overview. One diagram if it helps.
Link to detailed design docs for depth.

## Development

How to set up a dev environment, run tests, and contribute.

## Troubleshooting

Common errors and their solutions. FAQ format.

## License
```

### README Anti-Patterns

- Badges wall at the top (nobody reads them)
- "Table of Contents" for a 50-line README
- Installation instructions that don't work
- "See the docs" without a link
- Screenshots that are out of date
- No quick start section

## API Documentation

### Document Every Endpoint

For each endpoint, include:

1. **Method and path:** `GET /v1/users/:id`
2. **Description:** One sentence explaining what it does
3. **Parameters:** Name, type, required/optional, description, constraints
4. **Request body:** Schema with example
5. **Response:** Status codes, body schema with example
6. **Errors:** All possible error responses with codes and messages
7. **Authentication:** Required credentials and permissions

### Example

```markdown
### Get User

`GET /v1/users/:id`

Retrieve a user by their unique identifier.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| id | path | string (UUID) | Yes | User identifier |

**Response: 200 OK**

​```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Alice",
  "email": "<email>",
  "created_at": "2024-01-15T09:30:00Z"
}
​```

**Errors:**

| Status | Code | Description |
|--------|------|-------------|
| 404 | USER_NOT_FOUND | No user exists with this ID |
| 401 | UNAUTHORIZED | Missing or invalid auth token |
```

## Architecture Decision Records (ADRs)

Use ADRs to document significant technical decisions. They answer: "Why did we choose X over Y?"

### ADR Template

```markdown
# ADR-NNN: [Title]

## Status

[Proposed | Accepted | Deprecated | Superseded by ADR-NNN]

## Context

What is the problem or situation that requires a decision?
What constraints exist? What forces are at play?

## Decision

What is the decision and why was it chosen?

## Alternatives Considered

### Alternative A: [Name]
- Pros: ...
- Cons: ...
- Why rejected: ...

### Alternative B: [Name]
- Pros: ...
- Cons: ...
- Why rejected: ...

## Consequences

What are the positive and negative outcomes of this decision?
What new constraints does it introduce?
What follow-up work is needed?
```

### ADR Rules

- Number ADRs sequentially (ADR-001, ADR-002)
- Never delete or modify accepted ADRs — supersede them with new ones
- Write ADRs when the decision is made, not months later
- Keep them short — one page maximum
- Store them in the repository: `docs/adr/` or `docs/decisions/`

## Inline Comments

### When to Comment

Comment when:
- The code does something non-obvious and the WHY is not clear from context
- A workaround exists for a known bug or limitation (link to the issue)
- A performance optimization makes the code less readable
- A business rule is encoded that is not obvious from the domain
- A regex or algorithm is complex enough to need explanation

### When NOT to Comment

Do not comment when:
- The code is self-explanatory
- The comment restates the code in English
- The comment describes WHAT the code does (the code already does that)
- The comment is a section divider (`// ===== HELPERS =====`)
- The comment is a changelog (`// Added by Alice on 2024-01-15`)

### Comment Style

```python
# BAD: Describes what
# Check if user is admin
if user.role == "admin":

# GOOD: Describes why
# Admin users bypass rate limiting per SLA agreement with enterprise tier
if user.role == "admin":
```

```javascript
// BAD: Obvious
// Loop through items
for (const item of items) {

// GOOD: Non-obvious constraint
// Process in reverse order because later items may reference earlier ones
// and we need to resolve dependencies bottom-up
for (let i = items.length - 1; i >= 0; i--) {
```

## Docstrings and JSDoc

### Function Documentation

Document public functions with:
- What the function does (one line)
- Parameters with types and descriptions
- Return value with type and description
- Exceptions/errors that can be thrown
- Example usage (for complex functions)

```typescript
/**
 * Calculate the shipping cost for an order based on weight and destination.
 *
 * Uses tiered pricing: domestic orders under 5kg use flat rate,
 * all others use per-kg pricing with a distance multiplier.
 *
 * @param weight - Order weight in kilograms
 * @param destination - ISO 3166-1 alpha-2 country code
 * @returns Shipping cost in USD cents
 * @throws {InvalidDestinationError} If country code is not recognized
 *
 * @example
 * calculateShipping(2.5, "US")  // => 599
 * calculateShipping(10, "DE")   // => 2499
 */
function calculateShipping(weight: number, destination: string): number {
```

### Do Not Document

- Private/internal functions with obvious behavior
- Getters and setters
- Functions where the name + types tell the full story

```typescript
// This JSDoc adds nothing — skip it
/** Get the user's name */
function getName(): string { return this.name; }
```

## Documentation Maintenance

- Treat docs as code — review them in PRs
- Update docs in the same commit as the code change
- Delete outdated docs — wrong docs are worse than no docs
- Run link checkers periodically
- Date-stamp guides that may become outdated
- Use `<!-- TODO: update when X -->` markers for known future changes

## Writing Style

- Use active voice: "The server validates the token" not "The token is validated by the server"
- Use present tense: "Returns the user" not "Will return the user"
- Use second person for instructions: "Run the command" not "The user should run the command"
- Be concise: remove filler words ("basically", "simply", "just", "actually")
- Use consistent terminology — define terms once and use them everywhere
- One idea per paragraph
- Short sentences over long ones
