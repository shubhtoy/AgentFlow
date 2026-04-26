---
name: shell-exec
type: script
command: "${command}"
description: Execute arbitrary shell commands in the workspace. Use for build steps, linting, formatting, or any CLI operation not covered by a dedicated capability.
parameters:
  command:
    type: string
    description: The shell command to execute
    required: true
  cwd:
    type: string
    description: Working directory (relative to workspace root)
    required: false
outputs:
  - stdout
  - stderr
  - exit_code
narrativeTemplate:
  prefix: "Run"
  suffix: "to execute the command"
---

# Shell Exec

Execute arbitrary shell commands in the workspace context. This is the escape hatch for operations not covered by dedicated capabilities.

## When to use

- Running build commands (`npm run build`, `make`, `cargo build`)
- Running linters or formatters (`eslint --fix`, `prettier --write`)
- Installing dependencies (`npm install`, `pip install`)
- Database migrations or seed scripts
- Any CLI tool not wrapped by another capability

## Safety

- Commands run in the workspace root by default
- Never run destructive commands without explicit user confirmation
- Prefer dedicated capabilities (run-tests, get-diagnostics) over raw shell when available
