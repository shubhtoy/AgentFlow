---
type: script
command: "{command}"
parameters:
  command:
    type: string
    description: "Shell command to execute"
    required: true
  cwd:
    type: string
    description: "Working directory for the command"
  timeout:
    type: number
    description: "Timeout in seconds"
    default: 30
---
# Run Shell Command

Execute a shell command and return stdout/stderr. Use for build steps, file operations, environment checks, or any CLI-based task.

## Tool Preference
Prefer dedicated tools over shell commands when available:
- File search → use find-files (not `find` or `ls`)
- Content search → use search-codebase (not `grep` or `rg`)
- Read files → use read-code (not `cat`, `head`, `tail`)
- Edit files → use edit-file (not `sed` or `awk`)
- Create files → use write-file (not `echo >` or heredoc)

## Safety Rules
- Always quote file paths containing spaces with double quotes
- Use absolute paths to maintain working directory consistency
- Verify parent directory exists before creating new files
- When issuing multiple commands, chain with `&&` so failures stop the sequence
- Avoid unnecessary `sleep` commands

## Git Safety
- NEVER skip hooks (`--no-verify`) unless explicitly requested
- NEVER run destructive commands (`push --force`, `reset --hard`, `clean -f`) unless explicitly requested
- NEVER force push to main/master
- Prefer `git add <specific files>` over `git add -A`
