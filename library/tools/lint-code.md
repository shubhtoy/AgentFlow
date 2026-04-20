---
type: script
command: "npx eslint --format json {files}"
parameters:
  files:
    type: string
    description: "File path or glob pattern to lint"
    required: true
  fix:
    type: boolean
    description: "Automatically fix fixable issues"
    default: false
---
# Lint Code

Run linters on source files and return structured results. Supports ESLint, Pylint, or any linter that outputs JSON.
