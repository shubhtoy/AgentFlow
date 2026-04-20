---
name: grep-search
type: builtin
builtin_mapping: grepSearch
description: Fast regex-based text search across files using ripgrep.
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
    description: Whether the search is case-sensitive
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

Fast text-based regex search across the codebase. Returns matches with file paths, line numbers, and surrounding context. Preferred over shell `grep` for performance and consistency.

## Tips
- Use `\b` for word boundaries to avoid partial matches
- Use `includePattern` to narrow scope (e.g. `**/*.py` for Python files only)
- Results are capped at 50 matches — make patterns specific
