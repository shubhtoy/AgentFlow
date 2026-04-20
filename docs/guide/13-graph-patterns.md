---
name: graph-patterns
scope: workflow
description: "Part 13: Graph design patterns — linear, review gates, rejection loops, iteration, checkpoints"
tags:
  - guide
  - patterns
  - graphs
  - workflows
  - routing
---

# Part 13 — Graph Design Patterns

Real workflows combine several patterns. Here are the building blocks.

## Pattern 1: Linear Flow

The simplest workflow. Stages execute in sequence.

```
requirements → design → tasks → implement → verify
```

**Use when:** Every stage depends on the previous one, no branching needed.

## Pattern 2: Review Gates

Insert router nodes between phases. The user reviews output and approves or rejects.

```
requirements → review-req-gate → design → review-design-gate → tasks
```

Review gates are routers with two outgoing conditional edges:
- Approved → next phase
- Rejected → loop back to revise

## Pattern 3: Rejection Loops

When the user rejects, the workflow loops back to the producing node with feedback.

```
review-req-gate:
  approved → design
  rejected → requirements (revise based on feedback)
```

The rejection edge carries the user's feedback as context. The producing node re-executes with the original output plus the feedback.

## Pattern 4: Iteration Loops

A node executes repeatedly until a termination condition is met.

```
implement-task → task-gate:
  failed    → implement-task (retry with diagnostics)
  more-left → implement-task (next task)
  all-done  → verify-feature
```

## Pattern 5: Checkpoint Gates

Insert `confirm`-type interactions at major milestones. The user can pause, review progress, and decide whether to continue.

```
implement-task → checkpoint → task-gate
```

## Combining Patterns — The Full Picture

The `build-feature` workflow combines all five patterns:

```
  gather-req ←──rejected── review-req-gate
                                │ approved
  create-design ←──rejected── review-design-gate
                                    │ approved
  plan-tasks ←──rejected── review-tasks-gate
                                 │ approved
              ┌──────── implement-task ◄──┐
              ▼                           │
        task-gate ──more/failed──────────┘
              │ all-done
        verify-feature
```

## Pattern Tips

- **Always add review gates between major phases.** Catching a bad design before implementation saves hours.
- **Rejection loops should go back to the correct producing node**, not to an earlier phase.
- **Iteration loops need termination conditions.** Without `all-tasks-done`, the agent loops forever.
- **Router nodes should be cheap** (~400–500 tokens). If they need tools, they're steps.
- **Cycles are valid.** The parser doesn't require acyclic graphs. The executor detects infinite loops by counting visits (typically capping at 3 visits to the same node).

---

Next: [Validation & Quality](14-validation.md)
