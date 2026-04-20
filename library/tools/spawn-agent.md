---
type: builtin
builtin_mapping: agent
parameters:
  prompt:
    type: string
    description: "Complete task description for the agent"
    required: true
  name:
    type: string
    description: "Short name for tracking (1-2 words)"
  agent_type:
    type: string
    description: "Specialized agent type, or omit for general-purpose"
  run_in_background:
    type: boolean
    description: "Run without blocking the current agent"
    default: false
  isolation:
    type: string
    description: "Isolation mode: 'worktree' for git worktree isolation"
---
# Spawn Agent

Launch a sub-agent to handle complex tasks autonomously. Each agent starts fresh — provide a complete task description. The agent's result is returned to the caller but not visible to the user directly.

Write prompts like briefing a smart colleague who just walked in: explain what you're trying to accomplish, what you've learned, and enough context for judgment calls. Never delegate understanding — include file paths, line numbers, what specifically to change.
