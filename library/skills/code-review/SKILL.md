---
name: code-review
description: Systematic code review with priority ordering — correctness, security, performance, readability, maintainability, style. Structured feedback with actionable suggestions.
---

# Code Review

## Priority Order

Review in this order. Stop at the highest-priority issue found — lower-priority feedback is noise if the code is incorrect or insecure.

1. **Correctness** — Does it do what it claims to do?
2. **Security** — Does it introduce vulnerabilities?
3. **Performance** — Does it create bottlenecks or regressions?
4. **Readability** — Can another developer understand it in one pass?
5. **Maintainability** — Can it be changed safely in 6 months?
6. **Style** — Does it follow project conventions?

## Before You Start

1. Read the PR description and linked issue/ticket
2. Understand the intent — what problem is being solved?
3. Check the test coverage — are there tests? Do they cover edge cases?
4. Note the scope — is this PR doing one thing or many things?

## What to Look For

### Correctness

- Does the logic match the stated requirements?
- Are edge cases handled? (empty input, null, boundary values, overflow)
- Are error paths handled? (network failure, invalid data, timeout)
- Does the code handle concurrent access correctly?
- Are return values and error codes checked?
- Do loops terminate? Are off-by-one errors possible?
- Are type conversions safe? (narrowing, truncation, precision loss)

### Security

- Is user input validated and sanitized before use?
- Are SQL queries parameterized? (no string concatenation)
- Is output encoded for the context? (HTML, URL, JavaScript)
- Are secrets hardcoded? (API keys, passwords, tokens)
- Are permissions checked before sensitive operations?
- Is authentication/authorization enforced on all paths?
- Are dependencies up to date? Do they have known vulnerabilities?
- Is sensitive data logged? (PII, credentials, tokens)

### Performance

- Are there N+1 query patterns? (loop with DB call inside)
- Are large datasets loaded into memory unnecessarily?
- Are expensive operations inside hot loops?
- Is caching used appropriately? Is cache invalidation correct?
- Are database queries using indexes?
- Are there unnecessary network round trips?
- Is pagination implemented for list endpoints?

### Readability

- Can you understand each function without reading its callers?
- Are names descriptive and unambiguous?
- Are complex conditions extracted into named variables or functions?
- Are magic numbers replaced with named constants?
- Are comments explaining WHY, not WHAT?
- Is the code organized in a logical reading order?

### Maintainability

- Is the code DRY without being over-abstracted?
- Are responsibilities clearly separated?
- Can components be tested in isolation?
- Are interfaces stable? Will internal changes leak to consumers?
- Is configuration externalized where appropriate?
- Are there TODO/FIXME/HACK comments that should be tracked?

### Style

- Does it follow the project's linting rules and formatting?
- Are imports organized consistently?
- Is naming consistent with the codebase? (camelCase vs snake_case)
- Do files follow the project's directory structure conventions?

## Feedback Style

### Be Specific

Bad: "This could be better."
Good: "This query runs inside a loop (line 42-48), causing N+1 queries. Consider using a batch fetch or JOIN."

### Distinguish Severity

Use prefixes to signal importance:

- **`[blocking]`** — Must fix before merge. Correctness or security issue.
- **`[suggestion]`** — Recommended improvement. Not blocking.
- **`[nit]`** — Style or preference. Take it or leave it.
- **`[question]`** — Seeking understanding. Not necessarily a problem.

### Explain Why

Bad: "Don't use `any` here."
Good: "`[suggestion]` Using `any` here bypasses type checking for the `processOrder` return value. If the shape changes, callers won't get compile-time errors. Consider defining an `OrderResult` interface."

### Suggest Alternatives

When pointing out a problem, offer a concrete alternative when possible:

```
[suggestion] This manual retry loop (lines 78-95) could be replaced with
an exponential backoff utility:

  await retry(fetchData, { maxAttempts: 3, backoff: 'exponential' });

This handles jitter and max delay automatically.
```

### Praise Good Work

Call out things done well. It reinforces good patterns and makes reviews less adversarial:

- "Nice use of the builder pattern here — keeps the construction readable."
- "Good catch on the race condition — the mutex is the right approach."

## Anti-Patterns in Reviews

| Anti-Pattern | Problem | Instead |
|-------------|---------|---------|
| **Rubber stamping** | Approving without reading | Review every changed line |
| **Bikeshedding** | Debating style while ignoring logic | Address correctness first |
| **Gatekeeping** | Blocking on personal preference | Distinguish preference from requirement |
| **Drive-by reviews** | One-word comments with no context | Explain the issue and suggest a fix |
| **Review bombing** | 50 comments on a 10-line PR | Group related feedback, prioritize |
| **Scope creep** | Requesting unrelated changes | File separate issues for unrelated work |
| **Assuming malice** | "Why would you do this?" | "What was the reasoning behind this approach?" |

## Output Format

Structure your review as follows:

```markdown
## Summary

[One paragraph: what the PR does, whether it achieves its goal, overall assessment]

## Blocking Issues

- **[File:Line]** [Description of the issue and why it blocks]

## Suggestions

- **[File:Line]** [Description and recommended alternative]

## Nits

- **[File:Line]** [Minor style or preference note]

## Questions

- **[File:Line]** [What you want to understand]

## What's Done Well

- [Specific positive observations]
```

## Review Checklist

Before submitting your review, verify:

- [ ] You understood the intent of the change
- [ ] You reviewed every changed file
- [ ] You checked for missing test coverage
- [ ] You verified error handling paths
- [ ] You checked for security implications
- [ ] You distinguished blocking issues from suggestions
- [ ] Your feedback is actionable and specific
- [ ] You acknowledged what was done well

## Responding to Reviews

When your code is being reviewed:

- Assume good intent — reviewers are trying to improve the code
- Respond to every comment, even if just "Done" or "Acknowledged"
- If you disagree, explain your reasoning — don't just dismiss
- If a suggestion improves the code, adopt it and thank the reviewer
- If a discussion stalls, propose a compromise or escalate to a third opinion
- Do not take feedback personally — the review is about the code, not you
