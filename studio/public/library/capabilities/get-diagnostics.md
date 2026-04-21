---
name: get-diagnostics
type: builtin
builtin_mapping: getDiagnostics
parameters:
  paths:
    type: array
    description: Array of file paths to check for compile, lint, type, and semantic issues
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

Check code files for compile errors, lint violations, type errors, and other semantic issues. This is the preferred way to validate code correctness — use this instead of running build commands.
