---
name: file-search
type: builtin
builtin_mapping: fileSearch
description: Fuzzy file path search. Find files when you know part of the name but not the location.
parameters:
  query:
    type: string
    description: Partial filename or path pattern
    required: true
outputs:
  - matching_files
narrativeTemplate:
  prefix: "Search for"
  suffix: "to locate the file"
---

# File Search

Fuzzy search for files by name or path fragment. Returns up to 10 matching file paths. Use when you know what a file is called but not where it lives.
