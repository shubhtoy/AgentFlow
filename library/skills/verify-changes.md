---
name: verify-changes
domain: development
---
# Verify Changes

Verify that code changes actually work by running the application, executing tests, and checking outputs.

## Process Steps
1. Identify what changed (git diff or recent edits)
2. Determine the appropriate verification method
3. Run verification and check results
4. Report pass/fail with evidence

## Verification Methods
- **Unit tests** — run the project's test suite (`npm test`, `bun test`, `pytest`, `go test`)
- **Type checking** — run the type checker (`tsc --noEmit`, `mypy`, etc.)
- **Linting** — run linters for style and correctness
- **Manual execution** — run the changed code path and verify output
- **End-to-end** — start the app and exercise the affected flow

## Output Format
A verification report: what was checked, what passed, what failed, and any issues found. Include actual command output as evidence.

## Anti-Patterns
- Claiming "all tests pass" without running them
- Skipping verification because "the change is small"
- Only running unit tests when the change affects integration points
