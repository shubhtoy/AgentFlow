---
type: builtin
builtin_mapping: synthetic_output
parameters:
  schema:
    type: object
    description: "JSON Schema defining the output structure"
    required: true
  instructions:
    type: string
    description: "Instructions for generating the output"
    required: true
---
# Structured Output

Generate structured data conforming to a JSON Schema. Use when downstream systems need machine-readable output rather than prose.
