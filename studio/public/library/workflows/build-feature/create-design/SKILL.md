---
name: create-design
description: Transform approved requirements into a detailed technical design
type: step
agent: software-architect
model: claude-sonnet
context:
  max_tokens: 4000
  inputs:
    - ref: instructions/technical-design
      scope: full
    - ref: instructions/api-design
      scope: full
    - ref: instructions/security-review
      scope: full
    - ref: capabilities/source-agent
      scope: full
    - ref: capabilities/read-code
      scope: signature
    - ref: capabilities/git-history
      scope: signature
    - ref: capabilities/write-file
      scope: signature
    - ref: memory/decisions
      scope: full
    - ref: memory/lessons
      scope: summary
  exclude:
    - instructions/requirements-elicitation
    - instructions/task-decomposition
    - instructions/implementation-discipline
outputs:
  - name: design-doc
    format: markdown
    description: Technical design with architecture and data models
---

# Create Technical Design

The requirements have been approved. Transform them into a concrete technical design.

## Resources

- Apply {{instructions/technical-design}} to structure the design document
- Apply {{instructions/api-design}} to define API contracts
- Apply {{instructions/security-review}} to validate security considerations
- Query {{capabilities/source-agent}} to understand the codebase architecture
- Use {{capabilities/read-code}} to examine the source files
- Use {{capabilities/git-history}} to understand recent changes and evolution
- Use {{capabilities/write-file}} to create or modify the file
- {{memory/decisions}}
- {{memory/lessons}}

**Do not resolve** {{instructions/requirements-elicitation}}, {{instructions/task-decomposition}}, or {{instructions/implementation-discipline}} — they belong to other nodes.

## Inputs

- Approved requirements from {{<< output.gather-requirements}}

## Steps

### Step 1: Review Approved Requirements

Read the approved requirements from {{<< output.gather-requirements}}. Identify:
- Each numbered requirement and its acceptance criteria
- The scope boundaries — what's included and excluded
- Any constraints or assumptions noted during elicitation

Check {{memory/decisions}} for relevant past decisions that may influence the design.
Check {{memory/lessons}} for gotchas from previous work in this area.

### Step 2: Analyze the Codebase

Query {{capabilities/source-agent}} to understand the existing architecture:
- "What components exist in the area this feature touches?"
- "What patterns are used for similar features?"
- "What are the existing data models and interfaces?"

Use {{capabilities/read-code}} to examine specific files — focus on:
- Existing patterns and conventions to follow
- Interfaces this feature must integrate with
- Data models that will be extended or created

Use {{capabilities/git-history}} to understand how the relevant code has evolved and what recent changes may affect the design.

### Step 3: Design the Architecture

Apply {{instructions/technical-design}} to structure the design:

1. Define the **component architecture** — what new components are needed, how they relate to existing ones
2. Define the **interfaces** — public APIs, internal contracts, event schemas
3. Define the **data models** — new types, schema changes, state management
4. Identify **dependencies** — what this feature depends on, what depends on it

### Step 4: Design API Contracts and Data Flow

Apply {{instructions/api-design}} to define:

1. API endpoints with request/response schemas
2. Data flow between components — inputs, transformations, outputs
3. Error handling — failure modes, error responses, retry strategies
4. Validation rules for all inputs

### Step 5: Define the Testing Strategy

For each requirement, define:
1. **Correctness properties** — formal properties the implementation must satisfy
2. **Test categories** — unit tests, integration tests, edge cases
3. **Verification approach** — how each acceptance criterion will be tested

Apply {{instructions/security-review}} to identify security considerations and ensure the design addresses them.

### Step 6: Write the Design Document

Use {{capabilities/write-file}} to create the design document at `specs/<feature>/design.md`.

The document should include:
- Architecture overview with component relationships
- Data models and type definitions
- API contracts (endpoints, request/response schemas)
- Testing strategy and correctness properties
- Key design decisions and alternatives considered

Write any decisions made to {{memory/decisions}}.
Write any lessons learned to {{memory/lessons}}.

## Deliverable

A complete technical design document with architecture, data models, API contracts, and testing strategy — ready for user review.

## Next

Present the design to the user for review, then proceed to the review gate.

→ {{-> nodes/review-design-gate}}

{{<< output.create-design}}
