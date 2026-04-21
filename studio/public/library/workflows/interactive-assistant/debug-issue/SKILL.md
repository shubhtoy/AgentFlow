---
name: debug-issue
description: Systematic debugging — reproduce, isolate, hypothesize, fix, verify
type: step
agent: debugger
model: claude-sonnet
context:
  max_tokens: 3000
  inputs:
    - ref: instructions/debugging
      scope: full
    - ref: instructions/test-analysis
      scope: full
    - ref: capabilities/read-code
      scope: signature
    - ref: capabilities/write-file
      scope: signature
    - ref: capabilities/get-diagnostics
      scope: full
    - ref: capabilities/run-tests
      scope: signature
    - ref: capabilities/grep-search
      scope: signature
    - ref: capabilities/git-history
      scope: signature
    - ref: memory/lessons
      scope: full
  exclude:
    - instructions/implementation-discipline
    - instructions/refactoring
outputs:
  - name: fix-report
    format: markdown
    description: Root cause analysis and fix applied
---

# Debug Issue

Systematically diagnose and fix the reported issue.

## Resources

- Apply {{instructions/debugging}} for systematic diagnosis
- Use {{instructions/test-analysis}} to parse test failures
- Run {{capabilities/get-diagnostics}} to see current errors
- Use {{capabilities/read-code}} to examine code
- Use {{capabilities/write-file}} to apply fixes
- Run {{capabilities/run-tests}} to verify fixes
- Use {{capabilities/grep-search}} to trace error origins
- Check {{capabilities/git-history}} for recent changes
- {{memory/lessons}}

## Instructions

### Step 1: Reproduce

Apply {{instructions/debugging}} — start by confirming the bug:
- Run {{capabilities/get-diagnostics}} to see current errors
- Run {{capabilities/run-tests}} to see failing tests
- Note the exact error message and conditions

### Step 2: Isolate

Trace the error to its root cause:
- Use {{capabilities/grep-search}} to find where the error originates
- Use {{capabilities/read-code}} to examine the code path
- Check {{capabilities/git-history}} — did this work before? What changed?
- Check {{memory/lessons}} — have we seen this before?

### Step 3: Fix

Apply the minimal fix:
- Use {{capabilities/write-file}} to make the change
- Run {{capabilities/get-diagnostics}} immediately after
- Run {{capabilities/run-tests}} to confirm the fix and check for regressions

### Step 4: Record

Write the root cause and fix to {{memory/lessons}} so we don't repeat this.

## Next

→ {{-> nodes/user-review-gate}}

{{<< output.debug-issue}}
