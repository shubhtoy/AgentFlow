---
name: plan-tasks
description: Break the approved design into ordered, atomic implementation tasks
type: step
agent: project-planner
model: claude-sonnet
context:
  max_tokens: 3000
  inputs:
    - ref: instructions/task-decomposition
      scope: full
    - ref: capabilities/source-agent
      scope: full
    - ref: capabilities/write-file
      scope: signature
    - ref: memory/decisions
      scope: summary
  exclude:
    - instructions/requirements-elicitation
    - instructions/technical-design
    - instructions/implementation-discipline
    - instructions/api-design
    - instructions/security-review
outputs:
  - name: task-list
    format: markdown
    description: Ordered implementation plan with tasks, subtasks, file lists, and requirement traceability
---

# Plan Implementation Tasks

The design has been approved. Now break it into a concrete, ordered list of implementation tasks.

## Resources

- Apply {{instructions/task-decomposition}} to break the design into tasks
- Query {{capabilities/source-agent}} to understand the codebase architecture
- Use {{capabilities/write-file}} to create or modify the file
- {{memory/decisions}}

**Do not resolve** {{instructions/requirements-elicitation}}, {{instructions/technical-design}}, {{instructions/implementation-discipline}}, {{instructions/api-design}}, or {{instructions/security-review}} — they belong to other nodes.

## Inputs

- Requirements from {{<< output.gather-requirements}}
- Design from {{<< output.create-design}}

## Instructions

### Step 1: Analyze the Design

Read the design document from {{<< output.create-design}}. Identify every concrete change:
- Types/interfaces to define
- Modules/files to create or modify
- API endpoints to implement
- Tests to write

Query {{capabilities/source-agent}} to understand the codebase architecture and verify which files already exist.

### Step 2: Decompose into Tasks

Apply {{instructions/task-decomposition}} to break the design into tasks:

1. **Foundation tasks** — types, models, configuration
2. **Core logic tasks** — business rules, algorithms
3. **Integration tasks** — API wiring, UI components
4. **Verification tasks** — integration tests, full suite run
5. **Checkpoint tasks** — pause after each phase, verify with user via {{runbooks/checkpoint}}

### Step 3: Write the Task List

Use {{capabilities/write-file}} to create the implementation plan at `specs/<feature>/tasks.md`.

### Step 4: Record Decisions

Write task ordering rationale to {{memory/decisions}}.

## Deliverable

A complete, ordered implementation plan with requirements traceability.

## Next

Present the task list to the user for review, then proceed to the review gate.

→ {{-> nodes/review-tasks-gate}}

{{<< output.plan-tasks}}
