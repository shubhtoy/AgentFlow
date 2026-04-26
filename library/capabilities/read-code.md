---
name: read-code
type: builtin
description: Read and analyze source code files with AST awareness. Navigate definitions, search symbols, and understand file structure.
parameters:
  path:
    type: string
    description: File path to read (relative to workspace root)
    required: true
  startLine:
    type: number
    description: Starting line number for partial reads
    required: false
  endLine:
    type: number
    description: Ending line number for partial reads
    required: false
outputs:
  - source_code
  - file_structure
narrativeTemplate:
  prefix: "Use"
  suffix: "to examine the source files"
---

# Read Code

Read and analyze source code files. Understands AST structure, can search for symbols, and navigate definitions. Use for understanding existing code before making changes.

## When to use

- Reading source files to understand implementation
- Navigating to symbol definitions
- Reviewing code structure before edits
