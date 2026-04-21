---
name: escalate
type: notification
timeout: 0
---
# Escalate

Escalate an issue to a human when the agent cannot resolve it autonomously. Provide: what was attempted, why it failed, what information is needed, and suggested next steps for the human to take.

## What to Present

Show the user:

1. **Issue summary** — what went wrong in one sentence
2. **What was tried** — actions the agent already attempted
3. **Why it failed** — root cause or best guess
4. **What's needed** — specific information, access, or decision required from the human
5. **Suggested next steps** — recommended actions for the human

Prompt: "I've encountered an issue I cannot resolve on my own. Please review the details and take action."

## User Options

- **Provide guidance** — give the agent instructions to retry (free-text)
- **Take over manually** — human resolves the issue directly
- **Abort task** — stop the current workflow entirely
- **Retry** — ask the agent to try again with the same approach

## Timeout Behavior

No timeout (waits indefinitely). Escalations require human intervention and cannot be auto-resolved.
