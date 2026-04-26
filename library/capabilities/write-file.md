---
name: write-file
type: builtin
description: Create or modify files in the workspace. Supports creating new files, replacing content, inserting at line numbers, and appending.
parameters:
  path:
    type: string
    description: File path relative to workspace root
    required: true
  content:
    type: string
    description: Content to write
    required: true
  mode:
    type: string
    description: "Write mode: create, replace, insert, or append"
    required: false
outputs:
  - file_path
  - bytes_written
narrativeTemplate:
  prefix: "Use"
  suffix: "to create or modify the file"
---

# Write File

Create or modify files in the workspace. Supports creating new files with full content, replacing existing content, inserting at specific line numbers, and appending to the end.

## When to use

- Creating new source files, configs, or documentation
- Modifying existing files with targeted edits
- Generating boilerplate or scaffolding
