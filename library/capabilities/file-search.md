---
name: file-search
type: builtin
description: Fuzzy file path search. Find files when you know part of the name but not the exact location in the project tree.
parameters:
  query:
    type: string
    description: Partial filename or path pattern to match
    required: true
outputs:
  - matching_files
narrativeTemplate:
  prefix: "Search for"
  suffix: "to locate the file"
---

# File Search

Fuzzy search for files by name or path fragment. Returns up to 10 matching file paths.

## When to use

- You know a file's name but not its directory
- Looking for config files (e.g. "tsconfig", "Dockerfile")
- Finding test files related to a source file
