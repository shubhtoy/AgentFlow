---
name: get-diagnostics
type: builtin
description: Check code files for compile errors, lint violations, type errors, and semantic issues. Preferred over running build commands for validation.
parameters:
  paths:
    type: array
    description: Array of file paths to check
    required: true
outputs:
  - diagnostics
  - error_count
  - warning_count
narrativeTemplate:
  prefix: "Run"
  suffix: "on the modified files"
---

# Get Diagnostics

Check code files for compile errors, lint violations, type errors, and other semantic issues.

## When to use

- After writing or modifying code to catch errors immediately
- Before committing to ensure code compiles cleanly
- To validate generated code without a full build
