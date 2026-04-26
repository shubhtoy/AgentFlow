---
name: debugging
description: Systematic approach to diagnosing and fixing bugs
domain: development
tags:
  - debugging
  - troubleshooting
  - root-cause
---

# Debugging

Systematic approach to diagnosing and fixing bugs. Don't guess — follow the evidence.

## Process

### 1. Reproduce
- Confirm the bug exists — run the failing test or trigger the error
- Note the exact error message, stack trace, and conditions
- Identify the minimal reproduction case
- Record the environment: OS, runtime version, dependencies
- If you can't reproduce it, you can't fix it — get more information first

### 2. Isolate
- Trace the error back to its origin, not where it surfaces
- Use search tools to find related code paths
- Check recent changes — did this work before? What changed?
- Add logging or breakpoints at key decision points
- Binary search through commits if the regression point is unclear
- Check if the issue is in your code, a dependency, or the environment

### 3. Hypothesize
- Form a specific hypothesis: "X fails because Y returns null when Z is empty"
- Design a test that would confirm or refute the hypothesis
- Don't fix anything yet — understand first
- If your hypothesis is wrong, that's progress — update and try again
- Write down what you've ruled out to avoid circular investigation

### 4. Fix
- Make the smallest change that fixes the root cause
- Don't fix symptoms — fix the underlying problem
- Run diagnostics after every edit
- Run the full test suite to confirm the fix and check for regressions
- If the fix is complex, break it into smaller verified steps

### 5. Verify and Prevent
- Confirm the original error no longer occurs
- Confirm no new failures were introduced
- Write a regression test if one doesn't exist
- Document the root cause for future reference
- Check if the same pattern exists elsewhere in the codebase

## Anti-Patterns
- Shotgun debugging — changing random things until it works
- Fixing the symptom instead of the root cause
- Not writing a regression test after fixing
- Assuming the bug is in the code you just wrote (it might be in a dependency)
- Debugging in production without a local reproduction
- Spending hours without stepping back to reconsider the approach
