---
name: grep-search
type: builtin
description: Fast regex-based text search across files using ripgrep. Returns matches with file paths, line numbers, and context.
parameters:
  query:
    type: string
    description: Regex pattern to search for
    required: true
  includePattern:
    type: string
    description: "Glob pattern for files to include (e.g. '**/*.ts')"
    required: false
  caseSensitive:
    type: boolean
    description: Whether the search is case-sensitive (default false)
    required: false
outputs:
  - matches
  - file_paths
  - line_numbers
narrativeTemplate:
  prefix: "Search with"
  suffix: "to find matching patterns"
---

# Grep Search

Fast text-based regex search across the codebase. Preferred over shell `grep` for performance and consistency.

## When to use

- Finding all usages of a function, variable, or string
- Locating TODO/FIXME comments
- Searching for error messages or log patterns

## Tips

- Use `\b` for word boundaries to avoid partial matches
- Use `includePattern` to narrow scope (e.g. `**/*.py` for Python only)
- Results are capped at 50 matches — make patterns specific
