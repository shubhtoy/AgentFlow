---
name: verify-feature
description: Final integration check — run full test suite, verify all requirements, sign off
type: step
agent: qa-engineer
model: claude-sonnet
context:
  max_tokens: 2000
  inputs:
    - ref: instructions/test-analysis
      scope: full
    - ref: capabilities/run-tests
      scope: full
    - ref: capabilities/get-diagnostics
      scope: full
    - ref: capabilities/read-code
      scope: signature
    - ref: memory/decisions
      scope: summary
    - ref: memory/lessons
      scope: summary
    - ref: memory/facts
      scope: full
  exclude:
    - instructions/requirements-elicitation
    - instructions/technical-design
    - instructions/task-decomposition
    - instructions/implementation-discipline
    - instructions/api-design
    - instructions/security-review
    - instructions/code-search
outputs:
  - name: verification-report
    format: markdown
    description: Final verification report with test results, acceptance criteria status, and known limitations
---

# Verify Feature

All implementation tasks are complete. Now do a final integration check to make sure everything works together.

## Resources

- Use {{instructions/test-analysis}} to parse the results
- Run {{capabilities/run-tests}} to verify correctness
- Run {{capabilities/get-diagnostics}} to check for errors
- Use {{capabilities/read-code}} to examine the source files
- {{memory/decisions}}
- {{memory/lessons}}

## Inputs

- Requirements from {{<< output.gather-requirements}} — the acceptance criteria to verify against
- Design from {{<< output.create-design}} — the correctness properties to check
- Task list from {{<< output.plan-tasks}} — confirm all tasks marked complete
- Implementation output from {{<< output.implement-task}} — the actual code changes

## Instructions

### Step 1: Run Full Test Suite

Run {{capabilities/run-tests}} to verify correctness with the full test suite. Use {{instructions/test-analysis}} to parse the results.

If any tests fail → {{-> nodes/implement-task}} to fix.

### Step 2: Run Diagnostics on All Modified Files

Run {{capabilities/get-diagnostics}} to check for errors on every file that was created or modified. There should be zero errors.

### Step 3: Verify Acceptance Criteria

Go through each requirement from {{<< output.gather-requirements}} and verify each acceptance criterion:
- For each WHEN/THEN criterion, confirm the implementation handles it
- Check edge cases and error handling

### Step 4: Verify Correctness Properties

Check the correctness properties from {{<< output.create-design}}:
- Do the formal properties hold?
- Are there any properties that can't be verified automatically?

### Step 5: Write Summary

Produce a brief summary:
- What was built (one paragraph)
- How many tasks completed
- Test results (pass/fail counts)
- Any known limitations or follow-up work

### Step 6: Record Lessons

Write any lessons learned to {{memory/lessons}}.
Update {{memory/facts}} with any new domain knowledge.

## Deliverable

- All tests passing ({{runbooks/tests-pass}})
- Zero diagnostics errors
- All acceptance criteria verified
- Feature summary with known limitations

## Next

Feature is complete. Present the summary to the user via {{runbooks/checkpoint}} for final sign-off.

If tests fail → {{runbooks/tests-fail}} — go back and fix.
