---
type: builtin
builtin_mapping: glob
parameters:
  pattern:
    type: string
    description: "Glob pattern (e.g. '**/*.ts', 'src/**/*.test.js')"
    required: true
  path:
    type: string
    description: "Root directory to search from"
    default: "."
---
# Find Files

Fast file pattern matching that works with any codebase size. Returns matching file paths sorted by modification time. Use for finding files by name patterns. For content search, use search-codebase instead.
