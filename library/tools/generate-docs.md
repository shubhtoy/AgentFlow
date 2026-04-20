---
type: script
command: "npx typedoc --json /dev/stdout {entry_point} 2>/dev/null || echo '{}'"
parameters:
  entry_point:
    type: string
    description: "Source file or directory to generate docs from"
    required: true
  format:
    type: string
    description: "Documentation generator to use"
    enum: ["typedoc", "jsdoc", "sphinx", "javadoc", "auto"]
    default: "auto"
---
# Generate Docs

Generate documentation from source code. Supports JSDoc/TSDoc, Sphinx, Javadoc, or any doc generator that outputs structured data. Use for keeping docs in sync with code.
