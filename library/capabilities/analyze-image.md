---
name: analyze-image
type: builtin
description: Describe, analyze, or extract information from images. Supports screenshots, diagrams, charts, photos, and UI mockups.
parameters:
  path:
    type: string
    description: Path to the image file
    required: true
  prompt:
    type: string
    description: What to analyze or extract from the image
    required: false
outputs:
  - description
  - extracted_text
  - analysis
narrativeTemplate:
  prefix: "Analyze"
  suffix: "to understand the visual content"
---

# Analyze Image

Describe, analyze, or extract information from images. Supports screenshots, diagrams, charts, photos, and UI mockups.

## When to use

- Understanding UI mockups or wireframes
- Extracting text from screenshots (OCR)
- Analyzing architecture diagrams
- Visual QA of rendered output
