---
type: instruction
name: task-decomposition
scope: workflow
domain: project-management
description: Break down a technical design into ordered, atomic implementation tasks
tags:
  - tasks
  - planning
  - implementation
narrativeTemplate:
  prefix: "Apply"
  suffix: "to break the design into tasks"
---

# Task Decomposition

Break a technical design into a sequence of small, atomic, independently verifiable implementation tasks.

## Process

### 1. Identify Work Units
- Read the design document and list every concrete change needed
- Group changes by module/component
- Identify dependencies between changes

### 2. Order by Dependency
- Data models and types first (foundation)
- Core logic second (business rules)
- Integration layer third (API, UI wiring)
- Tests woven in alongside each layer
- Final integration and verification last

### 3. Write Task Descriptions
For each task:
- One clear sentence describing what to do
- List the specific files to create or modify
- Reference the requirement(s) this task satisfies
- Note any prerequisite tasks

### 4. Add Verification Criteria
Each task should have a clear "done" signal:
- "Tests pass" for logic tasks
- "No type errors" for type/interface tasks
- "API returns expected response" for endpoint tasks

### 5. Add Checkpoints
Insert checkpoint tasks after major milestones:
- After foundation layer (types, models)
- After core logic
- After integration
- Final checkpoint before marking feature complete

## Rules
- Each task should take no more than 30 minutes of focused work
- Each task should be independently verifiable
- Never skip the checkpoint tasks
- Tasks marked with `*` are optional stretch goals
