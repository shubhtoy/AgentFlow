---
name: implement
type: step
description: Execute implementation tasks with TDD, continuous verification, and clean commits
context:
  max_tokens: 16000
  inputs: [output.task-list]
outputs:
  - name: implementation
    format: markdown
    description: Summary of changes — files modified, tests added, decisions made
---

# Implement

Execute the approved task list from {{<< output.task-list}} one task at a time. Follow a disciplined TDD cycle for each task, verify before moving on, and maintain clean commit history throughout.

## Tools Available

Use these capabilities throughout implementation:
- {{capabilities/write-file}} — create and modify source files
- {{capabilities/shell-exec}} — run build commands, install dependencies, execute scripts
- {{capabilities/run-tests}} — execute test suites and check results
- {{capabilities/get-diagnostics}} — check for compiler errors, lint warnings, type issues
- {{capabilities/grep-search}} — find patterns across the codebase
- {{capabilities/read-code}} — read existing code for context
- {{capabilities/codebase-explorer}} — understand project structure before making changes
- {{capabilities/git-history}} — check recent changes for context

## Automated Hooks

These hooks fire automatically during implementation — you don't invoke them, but be aware of their effects:
- {{hooks/test-on-change}} runs related tests after every file edit — check results before moving on
- {{hooks/lint-on-save}} auto-fixes formatting on save — don't fight it
- {{hooks/diagnostics-after-write}} runs type-checking after edits — address errors immediately
- {{hooks/security-scan-on-commit}} audits for vulnerabilities before each commit — fix any findings

## Per-Task Process

For each task in order, follow the implementation-checklist.md context file:

### 1. Understand the Task

Read the task description and acceptance criteria. Use {{capabilities/read-code}} and {{capabilities/codebase-explorer}} to understand the existing code you'll be modifying. Check {{capabilities/git-history}} for recent changes to the same files.

### 2. Write Failing Test First

Use {{skills/test-driven-development}} to write a test that captures the acceptance criteria. Run it with {{capabilities/run-tests}} to confirm it fails for the right reason.

### 3. Implement to Pass

Write the minimum code to make the test pass using {{capabilities/write-file}}. Follow {{instructions/coding-standards}} for clean code. Apply {{instructions/error-handling}} — validate inputs, use typed errors, fail fast.

### 4. Refactor

With tests green, improve structure. Run {{capabilities/get-diagnostics}} to catch any type errors or lint issues introduced.

### 5. Debug When Stuck

When something doesn't work, use {{skills/systematic-debugging}} — never guess. Use {{capabilities/shell-exec}} to run diagnostic commands, {{capabilities/grep-search}} to trace data flow through the codebase.

### 6. Self-Review

Before committing, review your own diff using {{skills/code-review}} patterns. Check {{instructions/security-review}} for any security concerns in the changes.

### 7. Commit and Verify

Follow {{skills/git-workflow}} for clean commits. Use {{skills/verification-before-completion}} to confirm the task is truly done — all tests pass via {{capabilities/run-tests}}, no regressions.

Update {{memory/session-notes}} with progress after each task.

## Handling Blockers

If a task reveals a design flaw or missing requirement:
1. Document the issue clearly
2. Assess whether you can work around it
3. If blocked, note it in the implementation summary for the verify phase

## Output

Produce an implementation summary as `output.implementation` containing:
- Tasks completed with status
- Files created or modified per task
- Tests added per task
- Deviations from the plan and why
- Blockers or issues discovered
- Decisions made (also recorded in {{memory/decisions}})

{{-> verify | all tasks implemented}}
