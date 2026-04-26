---
name: task-decomposition
description: Break down a technical design into ordered, atomic implementation tasks
domain: project-management
tags:
  - tasks
  - planning
  - implementation
---

# Task Decomposition

Break a technical design into a sequence of small, atomic, independently verifiable implementation tasks.

## Process

### 1. Identify Work Units
- Read the design document and list every concrete change needed
- Group changes by module/component
- Identify dependencies between changes
- Separate infrastructure changes from application logic

### 2. Order by Dependency
- Data models and types first (foundation)
- Core logic second (business rules)
- Integration layer third (API, UI wiring)
- Tests woven in alongside each layer
- Final integration and verification last
- Never schedule a task that depends on an incomplete prerequisite

### 3. Write Task Descriptions
For each task:
- One clear sentence describing what to do
- List the specific files to create or modify
- Reference the requirement(s) this task satisfies
- Note any prerequisite tasks by name
- Estimate complexity: small (< 15 min), medium (15-30 min), large (split further)

### 4. Add Verification Criteria
Each task should have a clear "done" signal:
- "Tests pass" for logic tasks
- "No type errors" for type/interface tasks
- "API returns expected response" for endpoint tasks
- "Linter passes" for style/formatting tasks
- The criteria must be objectively checkable, not subjective

### 5. Add Checkpoints
Insert checkpoint tasks after major milestones:
- After foundation layer (types, models) — verify the data layer is solid
- After core logic — verify business rules work in isolation
- After integration — verify end-to-end flow works
- Final checkpoint before marking feature complete

## Rules
- Each task should take no more than 30 minutes of focused work
- Each task should be independently verifiable
- Never skip the checkpoint tasks — they catch integration issues early
- If a task feels too big, split it. If it feels trivial, merge it with the next.
- Tasks marked with `*` are optional stretch goals
- Re-evaluate the plan after each checkpoint — adjust remaining tasks if needed
