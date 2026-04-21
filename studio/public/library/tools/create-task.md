---
type: builtin
builtin_mapping: task_create
parameters:
  description:
    type: string
    description: "Task description"
    required: true
  type:
    type: string
    description: "Task type: shell, agent"
    default: "shell"
  command:
    type: string
    description: "Shell command to run (for shell tasks)"
---
# Create Task

Create a background task that runs independently. Shell tasks execute a command; agent tasks spawn a sub-agent. Use for long-running operations that don't need immediate results.
