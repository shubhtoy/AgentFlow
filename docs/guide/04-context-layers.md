---
name: context-layers
scope: workflow
description: "Part 4: The Five-Layer Context Model — cache-inspired layering for LLM context management"
tags:
  - guide
  - context
  - layers
  - tokens
  - budgets
---

# Part 4 — The Five-Layer Context Model

AgentFlow organizes context into five layers, inspired by CPU cache hierarchies. Each layer has a clear scope, budget, and lifetime.

```
┌─────────────────────────────────────────────────────┐
│  Layer 0 — Identity          ~200 tok   ALWAYS HOT  │
│  Root AGENTS.md identity block                      │
├─────────────────────────────────────────────────────┤
│  Layer 1 — Routing           ~500-800 tok   ALWAYS  │
│  Workflow AGENTS.md (node list + edges)              │
├─────────────────────────────────────────────────────┤
│  Layer 2 — Contract          2k-8k tok   PER STAGE  │
│  Current node's SKILL.md + resolved refs             │
├─────────────────────────────────────────────────────┤
│  Layer 3 — References        ON DEMAND              │
│  instructions/, capabilities/, memory/               │
├─────────────────────────────────────────────────────┤
│  Layer 4 — Artifacts         NEVER LOADED           │
│  node/output/ directories                            │
└─────────────────────────────────────────────────────┘
```

## Layer-by-Layer Breakdown

| Layer | Name | What | Where | Budget | Lifetime |
|-------|------|------|-------|--------|----------|
| 0 | Identity | Who the agent is | Root `AGENTS.md` `identity:` block | ~200 tokens | Always loaded |
| 1 | Routing | Which stage is active, what nodes exist | Workflow `AGENTS.md` | ~500–800 tokens | Always loaded |
| 2 | Contract | What this stage does — instructions + refs | Node `SKILL.md` + resolved refs | 2k–8k tokens | Current stage only |
| 3 | References | Shared knowledge | `instructions/`, `capabilities/`, `memory/` | On demand | Resolved per ref |
| 4 | Artifacts | Runtime output | `node/output/` directories | Never loaded | Written, not read |

## The Constraint

**Layer 0 + Layer 1 + one active Layer 2 + its resolved Layer 3 refs should fit in ~5k–8k tokens.**

If it doesn't, the node is too complex. Split it.

## Why This Matters

Without layers, you get two failure modes:

- **Context overload:** Load everything → the model drowns in irrelevant instructions
- **Context starvation:** Load too little → the model hallucinates or goes off-track

Layers make context loading **deterministic**. Layers 0 and 1 are always present at low cost. Layer 2 swaps per stage. Layer 3 resolves on demand. Layer 4 is never loaded.

## The Cache Analogy

| Layer | CPU cache equivalent |
|-------|---------------------|
| 0 — Identity | L1 cache — always hot, tiny, fastest access |
| 1 — Routing | L1/L2 — the dispatch table |
| 2 — Contract | L2 — the working set, swaps per process |
| 3 — References | L3 — shared across cores, loaded on demand |
| 4 — Artifacts | Disk — cold storage, never in active memory |

---

Next: [Reference Syntax](05-reference-syntax.md)
