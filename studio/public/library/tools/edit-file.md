---
type: builtin
builtin_mapping: file_edit
parameters:
  path:
    type: string
    description: "File path to edit"
    required: true
  old_string:
    type: string
    description: "Exact string to find and replace"
    required: true
  new_string:
    type: string
    description: "Replacement string"
    required: true
  replace_all:
    type: boolean
    description: "Replace all occurrences instead of just the first"
    default: false
---
# Edit File

Partial file modification via exact string replacement. Preferred over full file rewrites for targeted changes. The file MUST be read first before editing. The edit will fail if `old_string` is not unique — provide more surrounding context to make it unique, or use `replace_all` for renaming across the file.
