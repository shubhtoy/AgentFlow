---
name: plan-tasks
description: Break approved design into ordered, atomic implementation tasks
context:
  max_tokens: 6000
  inputs: [output.create-design]
outputs:
  - name: task-list
    format: markdown
    description: Ordered list of implementation tasks with dependencies and estimates
---

# Plan Tasks

Break the approved technical design into a concrete, ordered list of implementation tasks. Consume the design document from {{<< output.create-design}} and produce a task list that can be executed sequentially.

## Decomposition Methodology

Follow {{instructions/task-decomposition}} for breaking complex work into manageable pieces. Use {{skills/executing-plans}} for task ordering and dependency management.

## Process

### 1. Identify Work Units

Walk through the design and extract every piece of implementation work:
- Data model creation or modification
- API endpoint implementation
- Business logic modules
- Integration code
- Configuration and infrastructure
- Test suites

### 2. Make Tasks Atomic

Each task must be:
- **Completable in one session** — if it takes more than a few hours, break it down further
- **Independently verifiable** — has clear acceptance criteria you can check
- **Self-contained** — produces a working increment, not a half-finished state

### 3. Define Each Task

For every task, specify:
- **Summary**: one-line description of what to do
- **Acceptance criteria**: how to know it's done
- **Dependencies**: which tasks must complete first
- **Estimated effort**: small (< 1hr), medium (1-3hr), large (3+ hr — consider splitting)
- **Files likely touched**: helps with planning and conflict avoidance

### 4. Order by Dependency Graph

Arrange tasks so that:
- Dependencies come before dependents
- Foundation work (models, interfaces) comes first
- Integration work comes after the pieces it connects
- Tests are written alongside or before implementation, not after

### 5. Identify Critical Path

Mark which tasks are on the critical path — the longest chain of dependent tasks that determines minimum total time. Flag any tasks that could be parallelized.

## Output

Produce a numbered task list as `output.task-list` with the structure:
```
## Task N: [Summary]
- Acceptance criteria: [list]
- Dependencies: [task numbers or "none"]
- Effort: [small/medium/large]
- Files: [expected files]
```

{{-> review-plan | task list is complete}}
