---
type: script
command: "npx prettier --write {files} 2>&1 || black {files} 2>&1 || echo 'No formatter found'"
parameters:
  files:
    type: string
    description: "File path or glob pattern to format"
    required: true
  formatter:
    type: string
    description: "Formatter to use"
    enum: ["prettier", "black", "gofmt", "rustfmt", "auto"]
    default: "auto"
---
# Format Code

Auto-format source code using the project's configured formatter (Prettier, Black, gofmt, rustfmt, etc.). Ensures consistent style without manual effort.
