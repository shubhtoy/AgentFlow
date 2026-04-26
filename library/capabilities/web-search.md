---
name: web-search
type: builtin
description: Search the web for documentation, examples, API references, and technical information.
parameters:
  query:
    type: string
    description: Search query string
    required: true
outputs:
  - search_results
  - source_urls
narrativeTemplate:
  prefix: "Search with"
  suffix: "for external context"
---

# Web Search

Search the web for information. Returns relevant results with titles, snippets, and URLs.

## When to use

- Looking up library documentation or API references
- Finding solutions to error messages
- Researching best practices or design patterns
