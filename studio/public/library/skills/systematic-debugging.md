---
name: systematic-debugging
domain: development
---
# Systematic Debugging

A structured 4-phase methodology for debugging. Never guess — always prove.

## Process Steps
1. Read the error message and stack trace completely — understand WHAT failed
2. Reproduce the bug with a minimal, consistent test case
3. Isolate the cause: binary search changes, add targeted logging, test one hypothesis at a time
4. Fix the root cause (not the symptom) and write a regression test
5. Verify the fix doesn't break other functionality
6. Check for similar patterns elsewhere in the codebase

## Phase 1: Understand
- Read the error message and stack trace completely
- Identify WHAT is failing (expected vs actual behavior)
- Identify WHEN it started failing (recent changes, deploys)
- Check logs for the exact error context
- If a debug log exists, read the last 20 lines and grep for `[ERROR]` and `[WARN]`

## Phase 2: Reproduce
- Create the minimal reproduction case
- Confirm the bug happens consistently
- Identify the exact input that triggers it
- Document the reproduction steps

## Phase 3: Isolate
- Binary search through recent changes if regression
- Add targeted logging around the failure point
- Test hypotheses ONE AT A TIME — never change multiple things
- Trace data flow from input to failure point
- Check for environment-specific issues (OS, versions, config)

## Phase 4: Fix & Verify
- Fix the root cause, not the symptom
- Write a test that fails without the fix and passes with it
- Check for similar patterns elsewhere in the codebase
- Verify the fix doesn't break other functionality
- Run the full test suite, not just the affected test

## Session Log Analysis
When debugging agent/tool issues:
- Read the debug log file if available
- Look for `[ERROR]` and `[WARN]` entries across the full file
- Check for stack traces and failure patterns
- Identify what the system was doing before the hang/crash

## Anti-Patterns
- Random code changes hoping something works
- Fixing symptoms without understanding root cause
- Changing multiple things at once
- Skipping reproduction ("I think I know what it is")
- Not writing a regression test
- Claiming "fixed" without running verification

## Output Format
A debug report with: symptom description, reproduction steps, root cause analysis, fix applied, regression test added, and verification results.
