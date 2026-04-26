---
name: codebase-explorer
type: builtin
description: High-level codebase exploration for understanding project structure, patterns, and architecture. Combines directory listing, symbol search, and pattern recognition.
parameters:
  query:
    type: string
    description: "Natural language query about the codebase (e.g. 'what is the directory structure', 'how does auth work')"
    required: true
  scope:
    type: string
    description: Limit exploration to a directory or file pattern
    required: false
outputs:
  - relevant_files
  - code_snippets
  - architecture_notes
  - directory_structure
narrativeTemplate:
  prefix: "Explore"
  suffix: "to understand the project"
---

# Codebase Explorer

High-level codebase exploration that combines directory listing, file reading, symbol search, and pattern recognition to answer questions about project structure and architecture.

## When to use

- First encounter with an unfamiliar codebase
- Mapping project structure before designing workflows
- Finding existing patterns to follow for new features
- Understanding how modules connect and communicate
