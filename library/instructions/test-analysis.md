---
name: test-analysis
description: Analyze test results, identify failures, and determine root causes from test output
domain: development
tags:
  - testing
  - analysis
  - diagnostics
---

# Test Analysis

Parse test output and identify what failed, why it failed, and what to do about it.

## Process

### 1. Run the Test Suite
- Run the full suite first to get the complete picture
- Note the total count: passed, failed, skipped, errored
- Record the overall execution time — slowness may indicate issues

### 2. Categorize Failures
Classify each failure into one of these categories:
- **Assertion failure:** expected vs. actual mismatch — logic bug
- **Runtime error:** exception thrown during execution — missing handling
- **Timeout:** test took too long — performance issue or infinite loop
- **Setup failure:** test couldn't initialize — environment or dependency issue
- **Flaky:** passes sometimes, fails sometimes — race condition or external dependency

### 3. Analyze Each Failure
For each failure:
- Read the assertion message and expected vs. actual values
- Map the failure to the source code location
- Check if the test or the implementation is wrong
- Look for patterns — multiple failures in the same module suggest a shared root cause
- Check if the failure is new (regression) or pre-existing

### 4. Prioritize Fixes
- Fix setup/environment failures first — they may cascade
- Fix shared root causes before individual failures
- Fix assertion failures in dependency order (foundational modules first)
- Skip flaky tests temporarily if they block progress (but track them)

### 5. Verify Fixes
- Re-run the full suite after each fix
- Confirm the fixed test passes consistently (run it 3 times for flaky suspects)
- Confirm no new failures were introduced

## Common Patterns
- **Off-by-one:** boundary values wrong — check loop conditions and array indices
- **Null/undefined:** missing null checks — add guard clauses
- **Async timing:** race conditions — check await/promise handling
- **State leakage:** tests depend on execution order — isolate test state
- **Stale mocks:** mock doesn't match current API — update mock data
