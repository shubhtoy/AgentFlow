---
name: refactor-code
description: Safe, incremental code restructuring with test verification
type: step
agent: refactoring-specialist
model: claude-sonnet
context:
  max_tokens: 2500
  inputs:
    - ref: instructions/refactoring
      scope: full
    - ref: capabilities/read-code
      scope: signature
    - ref: capabilities/write-file
      scope: signature
    - ref: capabilities/get-diagnostics
      scope: signature
    - ref: capabilities/run-tests
      scope: full
    - ref: memory/decisions
      scope: full
  exclude:
    - instructions/debugging
    - instructions/implementation-discipline
outputs:
  - name: refactor-changes
    format: diff
    description: Refactoring changes applied
---

# Refactor Code

Restructure code safely without changing behavior.

## Resources

- Apply {{instructions/refactoring}} for safe restructuring
- Use {{capabilities/read-code}}
- Use {{capabilities/write-file}}
- Run {{capabilities/get-diagnostics}}
- Run {{capabilities/run-tests}}
- {{memory/decisions}}

## Instructions

### Step 1: Verify Baseline

Run {{capabilities/run-tests}} to confirm all tests pass before starting. If tests fail, stop — fix them first or route to {{-> nodes/debug-issue}}.

### Step 2: Plan the Refactoring

Apply {{instructions/refactoring}}:
- Identify the specific restructuring needed
- Plan small, incremental steps
- Each step should be independently verifiable

### Step 3: Execute

For each refactoring step:
1. Make one change with {{capabilities/write-file}}
2. Run {{capabilities/get-diagnostics}} — zero errors
3. Run {{capabilities/run-tests}} — all pass
4. If tests break, revert and try a different approach

### Step 4: Record

Write the refactoring rationale to {{memory/decisions}}.

## Next

→ {{-> nodes/user-review-gate}}

{{<< output.refactor-code}}
