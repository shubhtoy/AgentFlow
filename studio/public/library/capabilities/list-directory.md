---
name: list-directory
type: builtin
builtin_mapping: listDirectory
description: List directory contents with optional recursive depth.
parameters:
  path:
    type: string
    description: Path to directory (relative to workspace root)
    required: true
  depth:
    type: number
    description: Max recursion depth (default 1)
    required: false
outputs:
  - entries
  - file_count
  - dir_count
narrativeTemplate:
  prefix: "List"
  suffix: "to see the directory contents"
---

# List Directory

List directory contents in long format. Supports recursive listing with configurable depth. Use to understand project structure before diving into specific files.
