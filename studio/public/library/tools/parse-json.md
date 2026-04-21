---
type: script
command: "echo '{input}' | python3 -c \"import sys,json; data=json.load(sys.stdin); print(json.dumps(data, indent=2))\""
parameters:
  input:
    type: string
    description: "JSON string to parse"
    required: true
  extract:
    type: string
    description: "JSONPath or dot-notation path to extract a specific field"
---
# Parse JSON

Parse, validate, and pretty-print JSON data. Use for extracting fields from API responses, validating configuration files, or transforming structured data between steps.
