---
name: writing-nodes
scope: workflow
description: "Part 8: Writing nodes — step nodes, router nodes, sub-workflows, context budgets, frontmatter"
tags:
  - guide
  - nodes
  - skill-md
  - step
  - router
  - sub-workflow
  - context-budget
---

# Part 8 — Writing Nodes (SKILL.md)

The node `SKILL.md` is the core authoring unit. It's the contract between you (the author) and the executor (the agent). A well-structured SKILL.md has four sections, always in this order:

1. **Frontmatter** — metadata and declarations
2. **Context Budget** — what to load, when, and at what cost
3. **Instructions** — step-by-step work
4. **Edges** — where to go next

## 8.1 — Step Nodes

Step nodes are the workhorses. They receive context, use tools, follow instructions, and produce output.

### Full Example: `gather-requirements/SKILL.md`

```yaml
---
name: gather-requirements
description: Understand the feature request and produce structured requirements
type: step
entry: true
agent: requirements-analyst
model: claude-sonnet
context:
  max_tokens: 3000
  inputs:
    - ref: instructions/requirements-elicitation
      scope: full
    - ref: capabilities/source-agent
      scope: full
    - ref: capabilities/read-code
      scope: signature
    - ref: capabilities/write-file
      scope: signature
    - ref: memory/user
      scope: full
    - ref: memory/decisions
      scope: full
  exclude:
    - instructions/technical-design
    - instructions/task-decomposition
outputs:
  - name: requirements-doc
    format: markdown
    description: Structured requirements with numbered items and WHEN/THEN acceptance criteria
---

# Gather Requirements

You are starting the spec-driven workflow. Your job is to transform the user's
feature request into a precise, testable requirements document.

## Context Budget

This node costs ~3000 tokens fully loaded. It references:
- {{instructions/requirements-elicitation}} (~800 tok, resolve now — core instruction)
- {{capabilities/source-agent}} (~300 tok, resolve now — needed for exploration)
- {{capabilities/read-code}} (~100 tok, resolve on first use)
- {{capabilities/write-file}} (~100 tok, resolve on first use)
- {{memory/user}} (~50 tok, resolve at start)
- {{memory/decisions}} (~100 tok, resolve at start)

**Do not resolve** {{instructions/technical-design}} or
{{instructions/task-decomposition}} — they belong to later nodes.

## Instructions

### Step 1: Understand the Context

Query {{capabilities/source-agent}} to understand the existing architecture:
- "What components exist in the area this feature touches?"
- "What are the current data models and API contracts?"

Use {{capabilities/read-code}} to examine specific files. Keep reads focused.
Read {{memory/user}} for the user's preferences.
Read {{memory/decisions}} for relevant past decisions.

### Step 2: Elicit Requirements

Apply {{instructions/requirements-elicitation}} to structure the requirements:

1. Write an **Introduction** explaining what this feature is and why it matters
2. Write a **Glossary** defining domain-specific terms
3. For each capability, write a **Requirement** with:
   - A numbered heading (Requirement 1, Requirement 2, ...)
   - A **User Story**: "As a [role], I want [capability], so that [benefit]"
   - Numbered **Acceptance Criteria** using WHEN/THEN format

### Step 3: Write the Document

Use {{capabilities/write-file}} to save at `.kiro/specs/<feature>/requirements.md`.

### Step 4: Record What You Learned

Write useful facts to {{memory/facts}}.
Write decisions to {{memory/decisions}}.

## Deliverable

A complete requirements document with numbered requirements, user stories,
and testable acceptance criteria.

## Next

→ {{-> nodes/review-requirements-gate}}

{{<< output.gather-requirements}}
```

### Frontmatter Field Reference

| Field | Type | Purpose |
|-------|------|---------|
| `name` | string | Node identifier |
| `type` | `step` / `router` / `sub-workflow` | Node type |
| `entry` | boolean | `true` = workflow entry point (exactly one per workflow) |
| `primary` | boolean | `true` = primary file in a multi-file node directory |
| `agent` | string | Optional persona name for this stage |
| `model` | string | Preferred LLM model |
| `context.max_tokens` | integer | Token budget for this node |
| `context.inputs` | array | Explicit ref declarations with scope (`full` / `summary` / `signature`) |
| `context.exclude` | string[] | Refs that should NOT be loaded at this node |
| `outputs` | array | What this node produces (name, format, description) |

## 8.2 — Router Nodes

Routers are lightweight decision points. They evaluate conditions and route to the next node. **Zero capabilities, zero instructions.** If your router needs tools, it's a step.

**Budget target: ~400–500 tokens.**

### Full Example: `review-requirements-gate/SKILL.md`

```yaml
---
name: review-requirements-gate
description: Router — present requirements to user, route on approval or rejection
type: router
---

# Review Requirements Gate

Present the requirements document from {{<< output.gather-requirements}}
to the user via {{skills/review-requirements}}.

## Context Budget

Lightweight router (~500 tokens). Resolves:
- {{skills/review-requirements}} (~200 tok, the interaction prompt)
- Two condition skills (~50 tok each)

**No instructions or capabilities needed** — this node only routes.

## What to Present

Show the user:
- The full requirements document with all numbered requirements
- A summary of scope: what's included and what's excluded
- Any assumptions made during elicitation
- Open questions that need user input

## Routing

- If approved → {{-> nodes/create-design | skills/requirements-approved}}
- If rejected → {{-> nodes/gather-requirements | skills/requirements-rejected}}
  — incorporate the user's feedback and revise
```

## 8.3 — Sub-Workflow Nodes

Sub-workflow nodes delegate to another workflow entirely. The parser recursively parses the referenced workflow and treats it as a nested graph.

```yaml
---
name: run-code-review
type: sub-workflow
workflow: code-review
---

# Run Code Review

Delegate to the {{-> nodes/code-review}} workflow for a full code review cycle.
```

## 8.4 — Context Budget Section

Every node should have a Context Budget section immediately after the title. It serves two purposes:

1. Tells the executor what to load and when
2. Documents the token budget for the author (and for validation)

### Resolve Timing Keywords

| Timing | Meaning |
|--------|---------|
| `resolve now` | Load immediately when the node activates |
| `resolve on use` / `resolve on first use` | Load only when the agent first references it |
| `resolve on write` | Load only when the agent needs to write to it |
| `resolve at start` | Load at the beginning of the session |
| `do not resolve` | Explicitly excluded — belongs to another node |

### Token Estimation Heuristic

A rough guide: **1 token ≈ 4 characters** of English text. For code and structured text, closer to **1 token ≈ 3 characters**.

| Component | Typical budget |
|-----------|---------------|
| Root AGENTS.md (Layer 0) | ~200 tokens |
| Workflow AGENTS.md (Layer 1) | ~500–800 tokens |
| Node SKILL.md (Layer 2) | ~1000–3000 tokens |
| Each resolved instruction | ~300–800 tokens |
| Each resolved capability (as context) | ~100–300 tokens |
| Each memory file | ~50–500 tokens |
| **Total per active step** | **~5000–8000 tokens** |

### When to Split a Node

If a node's total budget exceeds ~8000 tokens:
- Separate "explore" from "write" into two steps
- Move complex logic into an instruction (loaded on demand)
- Break a multi-phase step into sequential steps with a router between them

---

Next: [Resource Authoring](09-resource-authoring.md)
