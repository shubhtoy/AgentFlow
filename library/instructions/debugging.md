---
type: instruction
name: debugging
scope: workflow
domain: development
description: Systematic approach to diagnosing and fixing bugs
tags:
  - debugging
  - troubleshooting
  - root-cause
narrativeTemplate:
  prefix: "Apply"
  suffix: "to diagnose the issue"
---

# Debugging

Systematic approach to diagnosing and fixing bugs. Don't guess — follow the evidence.

## Process

### 1. Reproduce
- Confirm the bug exists — run the failing test or trigger the error
- Note the exact error message, stack trace, and conditions
- Identify the minimal reproduction case

### 2. Isolate
- Trace the error back to its origin (not where it surfaces)
- Use {{capabilities/grep-search}} to find related code paths
- Check recent changes with {{capabilities/git-history}} — did this work before?
- Add logging or breakpoints at key decision points

### 3. Hypothesize
- Form a specific hypothesis: "X fails because Y returns null when Z is empty"
- Design a test that would confirm or refute the hypothesis
- Don't fix anything yet — understand first

### 4. Fix
- Make the smallest change that fixes the root cause
- Don't fix symptoms — fix the underlying problem
- Run {{capabilities/get-diagnostics}} after every edit
- Run {{capabilities/run-tests}} to confirm the fix and check for regressions

### 5. Verify
- Confirm the original error no longer occurs
- Confirm no new failures were introduced
- Write a regression test if one doesn't exist

## Anti-Patterns
- Shotgun debugging (changing random things until it works)
- Fixing the symptom instead of the root cause
- Not writing a regression test after fixing
- Assuming the bug is in the code you just wrote (it might be in a dependency)
