---
type: instruction
name: refactoring
scope: workflow
domain: development
description: Safe, incremental code restructuring without changing behavior
tags:
  - refactoring
  - code-quality
  - cleanup
narrativeTemplate:
  prefix: "Apply"
  suffix: "to restructure the code safely"
---

# Refactoring

Restructure code to improve readability, maintainability, or performance without changing external behavior.

## Golden Rule
Tests must pass before, during, and after refactoring. If tests break, you changed behavior — revert.

## Process

### 1. Ensure Coverage
- Run {{capabilities/run-tests}} to confirm all tests pass before starting
- If coverage is low for the target code, write characterization tests first
- Never refactor untested code without adding tests first

### 2. Small Steps
- One refactoring operation per commit
- Extract → verify → rename → verify → move → verify
- Never combine refactoring with feature work in the same change

### 3. Common Operations
- **Extract function**: Pull a block into a named function
- **Inline function**: Replace a trivial wrapper with its body
- **Rename**: Use semantic rename to update all references
- **Move**: Relocate to a more logical module
- **Simplify conditionals**: Replace nested if/else with early returns or guard clauses
- **Remove dead code**: Delete unreachable or unused code

### 4. Verify
- Run {{capabilities/get-diagnostics}} after every change
- Run {{capabilities/run-tests}} after every change
- Review the diff — does every change preserve behavior?

## When NOT to Refactor
- Under time pressure with no test coverage
- Code that's about to be deleted or replaced
- Code you don't understand yet (understand first, then refactor)
