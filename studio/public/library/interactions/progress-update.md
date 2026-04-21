---
name: progress-update
type: notification
timeout: 30
---
# Progress Update

Provide the user with a status update on the current task. Include: what has been completed, what is in progress, any blockers or issues encountered, and estimated remaining work. Keep it concise.

## What to Present

Show the user:

1. **Completed** — tasks or steps finished so far
2. **In progress** — what the agent is currently working on
3. **Blockers** — any issues encountered (if applicable)
4. **Remaining** — estimated work left and time

Prompt: "Here's a quick status update on the current task."

## User Options

- **Acknowledge** — continue as planned
- **Pause** — stop work and wait for further instructions
- **Reprioritize** — change the order or focus of remaining work
- **Cancel** — stop the current task entirely

## Timeout Behavior

After 30 seconds, the agent continues working automatically. Progress updates are informational and do not block execution.
