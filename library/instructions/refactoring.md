---
name: refactoring
description: Safe, incremental code restructuring without changing behavior
domain: development
tags:
  - refactoring
  - code-quality
  - cleanup
---

# Refactoring

Restructure code to improve readability, maintainability, or performance without changing external behavior.

## Golden Rule

Tests must pass before, during, and after refactoring. If tests break, you changed behavior — revert.

## Process

### 1. Ensure Coverage
- Run tests to confirm all tests pass before starting
- If coverage is low for the target code, write characterization tests first
- Never refactor untested code without adding tests first
- Measure coverage on the specific functions you plan to change

### 2. Small Steps
- One refactoring operation per commit
- Extract → verify → rename → verify → move → verify
- Never combine refactoring with feature work in the same change
- Each step should take under 5 minutes — if longer, break it down further

### 3. Common Operations

**Extract function** — Pull a block into a named function when:
- A code block has a clear single purpose
- The same logic appears in multiple places
- A function exceeds 30 lines

**Inline function** — Replace a trivial wrapper with its body when:
- The function body is as clear as the name
- The function is called exactly once
- The indirection adds no value

**Rename** — Use semantic rename to update all references when:
- The name doesn't describe what the thing does
- The domain language has evolved
- Abbreviations make the code harder to read

**Simplify conditionals** — Replace nested if/else with:
- Early returns (guard clauses) for error cases
- Lookup tables for value mapping
- Polymorphism for type-based branching

**Remove dead code** — Delete unreachable or unused code:
- Check for references before deleting
- Remove commented-out code (git has history)
- Remove unused imports, variables, and parameters

### 4. Verify After Every Change
- Run diagnostics (type checker, linter) after every edit
- Run the full test suite after every logical change
- Review the diff — does every change preserve behavior?
- Check that no unrelated formatting changes snuck in

## When NOT to Refactor
- Under time pressure with no test coverage
- Code that's about to be deleted or replaced
- Code you don't understand yet — understand first, then refactor
- During an active incident — stabilize first
