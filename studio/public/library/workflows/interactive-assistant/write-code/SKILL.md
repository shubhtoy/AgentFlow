---
name: write-code
description: Write, edit, or create code with full verification loop
type: step
agent: senior-developer
model: claude-sonnet
context:
  max_tokens: 3500
  inputs:
    - ref: instructions/implementation-discipline
      scope: full
    - ref: instructions/code-search
      scope: full
    - ref: capabilities/read-code
      scope: signature
    - ref: capabilities/write-file
      scope: signature
    - ref: capabilities/get-diagnostics
      scope: signature
    - ref: capabilities/run-tests
      scope: signature
    - ref: capabilities/source-agent
      scope: signature
    - ref: memory/decisions
      scope: full
    - ref: memory/lessons
      scope: full
  exclude:
    - instructions/debugging
    - instructions/refactoring
outputs:
  - name: code-changes
    format: diff
    description: Files created or modified
---

# Write Code

Implement the user's coding request with full verification.

## Resources

- Follow {{instructions/implementation-discipline}}
- Apply {{instructions/code-search}} to explore patterns
- Use {{capabilities/read-code}}
- Use {{capabilities/write-file}}
- Run {{capabilities/get-diagnostics}}
- Run {{capabilities/run-tests}}
- Query {{capabilities/source-agent}}
- {{memory/decisions}}
- {{memory/lessons}}

## Instructions

### Step 1: Understand the Request

Read the user's request carefully. If anything is ambiguous, ask before coding.

Check {{memory/decisions}} for relevant past decisions.
Check {{memory/lessons}} for past mistakes in similar work.

### Step 2: Explore the Context

Query {{capabilities/source-agent}} to understand the existing code patterns.
Use {{capabilities/read-code}} to examine files that will be affected.

### Step 3: Write the Code

Follow {{instructions/implementation-discipline}}:
1. Write the smallest change that satisfies the request
2. Follow existing conventions
3. Handle errors explicitly
4. Use {{capabilities/write-file}} to save changes

### Step 4: Verify

After every edit:
1. Run {{capabilities/get-diagnostics}} — fix all errors
2. Run {{capabilities/run-tests}} — fix any failures

### Step 5: Record

Write decisions to {{memory/decisions}} if non-obvious.
Write gotchas to {{memory/lessons}} if encountered.

## Next

→ {{-> nodes/user-review-gate}}

{{<< output.write-code}}
