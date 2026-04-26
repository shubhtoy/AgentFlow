---
name: summarize
type: builtin
description: Summarize text, documents, code, or conversations into concise overviews. Supports multiple summary styles and configurable detail levels.
parameters:
  content:
    type: string
    description: The text or content to summarize
    required: true
  style:
    type: string
    description: "Summary style: brief, detailed, bullet-points, executive"
    required: false
outputs:
  - summary
  - key_points
narrativeTemplate:
  prefix: "Summarize"
  suffix: "to distill the key information"
---

# Summarize

Summarize text, documents, code, or conversations into concise overviews.

## When to use

- Condensing long documents or threads
- Creating executive summaries of technical content
- Extracting key points from meeting notes or discussions
- Generating changelogs from commit history
