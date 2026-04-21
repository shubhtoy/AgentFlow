---
name: review-tasks-gate
description: Router — present task list to user, route on approval or rejection
type: router
context:
  inputs: []
---

# Review Tasks Gate

Present the implementation task list from {{<< output.plan-tasks}} to the user via {{runbooks/review-tasks}}.

## Resources

Lightweight router node. Resolves:
- {{runbooks/review-tasks}}
- Two condition templates

**No skills or tools needed.**

## What to Present

Show the user:
- The ordered list of tasks with subtasks
- Dependency relationships between tasks
- Checkpoint tasks and their purpose
- Which requirements each task satisfies

## Routing

- If approved → {{-> nodes/implement-task | runbooks/tasks-approved}}
- If rejected → {{-> nodes/plan-tasks | runbooks/tasks-rejected}} — adjust ordering, scope, or granularity per feedback
