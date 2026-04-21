---
type: builtin
builtin_mapping: task_manage
parameters:
  action:
    type: string
    description: "Action: list, get, stop, output"
    required: true
  task_id:
    type: string
    description: "Task ID (required for get, stop, output)"
---
# Manage Tasks

List, inspect, stop, or get output from background tasks. Use to track progress of long-running operations and retrieve their results.
