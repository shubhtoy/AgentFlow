---
type: script
command: "python3 -c \"import json,jsonschema; schema=json.load(open('{schema_file}')); data=json.load(open('{data_file}')); jsonschema.validate(data, schema); print('Valid')\""
parameters:
  schema_file:
    type: string
    description: "Path to the JSON Schema file"
    required: true
  data_file:
    type: string
    description: "Path to the data file to validate"
    required: true
---
# Validate Schema

Validate data against a JSON Schema, OpenAPI spec, or other schema definition. Use for input validation, API contract testing, or configuration verification.
