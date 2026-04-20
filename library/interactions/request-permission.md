---
name: request-permission
type: approval
timeout: 120
---
# Request Permission

Request user approval before executing a potentially destructive or irreversible action. Uses wildcard patterns to define what's allowed.

## When to Request
- Destructive operations: deleting files/branches, dropping tables, killing processes
- Hard-to-reverse operations: force-pushing, `git reset --hard`, amending published commits
- Actions visible to others: pushing code, creating/commenting on PRs, sending messages
- Uploading content to third-party services (may be cached/indexed)

## Permission Patterns
Use wildcard patterns to specify allowed operations:
- `Bash(git *)` — allow all git commands
- `Bash(npm test)` — allow specific command
- `FileEdit(/src/*)` — allow edits under src/
- `FileRead(*)` — allow reading any file

## User Options
- **Approve** — allow this specific action
- **Approve pattern** — allow all matching actions (e.g., all git commands)
- **Deny** — block this action
- **Deny and explain** — block with reason

## Timeout Behavior
After 120 seconds, the action is denied by default. The agent should find an alternative approach or ask the user for guidance.
