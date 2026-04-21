---
type: condition
name: task-failed
check: The current implementation task has failing tests, diagnostics errors, or does not satisfy the acceptance criteria — needs debugging and rework
---

# Task Failed

Evaluates whether the current implementation task has failed verification.

**True when:** Tests fail, diagnostics errors exist, or acceptance criteria are not satisfied.
**False when:** All tests pass, no errors exist, and acceptance criteria are met.
