---
name: task-completion-gate
description: Router — check if more tasks remain or all tasks are done
type: router
context:
  inputs: []
---

# Task Completion Gate

Check the implementation plan from {{<< output.plan-tasks}} to determine if there are more tasks to do.

## Resources

Lightweight router node. Resolves:
- Three condition runbooks

**No skills, tools, or interactions needed** — just read the task list and route.

## Logic

Read the task list. Count completed `[x]` vs uncompleted `[ ]` tasks.

## Routing

- If the current task failed verification → {{-> nodes/implement-task | runbooks/task-failed}} — retry with diagnostics feedback
- If more uncompleted tasks remain → {{-> nodes/implement-task | runbooks/more-tasks-remain}} — pick up the next task
- If all tasks are done → {{-> nodes/verify-feature | runbooks/all-tasks-done}} — proceed to final verification
