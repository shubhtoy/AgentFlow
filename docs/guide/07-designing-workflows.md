---
name: designing-workflows
scope: workflow
description: "Part 7: Designing workflows — workflow descriptors, node summaries, routing maps"
tags:
  - guide
  - workflows
  - design
  - routing
---

# Part 7 — Designing Workflows

A workflow is a directed graph of nodes. Before writing any files, sketch the graph on paper (or in your head). The graph answers three questions:

1. **What are the phases?** (requirements, design, implementation, verification)
2. **Where does a human need to approve?** (review gates)
3. **Where does the agent loop?** (iteration, retry on failure)

## Workflow AGENTS.md (Layer 1)

Each workflow directory has its own `AGENTS.md` that serves as the routing map. It lists all nodes with brief descriptions and token estimates.

```markdown
---
type: agents
name: build-feature
description: Spec-driven feature development — requirements, design, tasks, implement, verify
---

# Build Feature

A structured workflow for building new features. Three phases:
**Requirements → Design → Tasks**, followed by iterative implementation.

## Context Budget

This descriptor costs ~800 tokens. Each node below is a summary (~50 tokens).
**Activate only the current node** — each costs ~2000-5000 tokens when loaded.

## Nodes

### Phase 1: Requirements (~3000 tokens when active)
- {{-> nodes/gather-requirements}} — Explore codebase, write structured requirements

### Phase 2: Requirements Review (~500 tokens when active)
- {{-> nodes/review-requirements-gate}} — Present to user, route on approval/rejection

### Phase 3: Design (~4000 tokens when active)
- {{-> nodes/create-design}} — Architecture, data models, API contracts

### Phase 4: Design Review (~500 tokens when active)
- {{-> nodes/review-design-gate}} — Present to user, route on approval/rejection

### Phase 5: Task Planning (~3000 tokens when active)
- {{-> nodes/plan-tasks}} — Break design into ordered, atomic tasks

### Phase 6: Implementation (~3500 tokens when active, runs N times)
- {{-> nodes/implement-task}} — Execute one task: write code, test, verify

### Phase 7: Task Completion Check (~400 tokens when active)
- {{-> nodes/task-completion-gate}} — More tasks? Loop. All done? Verify.

### Phase 8: Verification (~2000 tokens when active)
- {{-> nodes/verify-feature}} — Full test suite, acceptance criteria, sign-off

## Capabilities (resolve on demand)

{{capabilities/read-code}}, {{capabilities/write-file}}, {{capabilities/run-tests}},
{{capabilities/source-agent}}, {{capabilities/get-diagnostics}}

## Instructions (resolve on demand)

{{instructions/requirements-elicitation}}, {{instructions/technical-design}},
{{instructions/task-decomposition}}, {{instructions/implementation-discipline}}
```

## Key Rules for Workflow Descriptors

- **Summaries only.** One line per node. The detail lives in the node's `SKILL.md`.
- **Token estimates.** Give the executor a sense of cost before it loads a node.
- **Don't preload all nodes.** The descriptor says "here's the map." The executor loads one node at a time.
- **List shared resources.** Capabilities and instructions referenced across multiple nodes go here.

---

Next: [Writing Nodes (SKILL.md)](08-writing-nodes.md)
