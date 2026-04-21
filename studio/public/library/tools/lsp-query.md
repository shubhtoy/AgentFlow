---
type: builtin
builtin_mapping: lsp
parameters:
  action:
    type: string
    description: "LSP action: goto_definition, find_references, hover, diagnostics"
    required: true
  path:
    type: string
    description: "File path"
    required: true
  line:
    type: number
    description: "Line number (1-based)"
    required: true
  column:
    type: number
    description: "Column number (1-based)"
    required: true
---
# LSP Query

Language Server Protocol operations for semantic code navigation. Supports go-to-definition, find-references, hover info, and diagnostics. More precise than text search for understanding code relationships.
