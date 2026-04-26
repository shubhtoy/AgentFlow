---
name: core-concepts
scope: workflow
description: "Part 2: Core building blocks — workspaces, identity, workflows, nodes, resources, references, budgets"
tags:
  - guide
  - concepts
  - fundamentals
---

# Part 2 — Core Concepts

Before diving into authoring, here are the building blocks you'll work with.

## The Workspace

An AgentFlow workspace is a `.agentflow/` directory at the root of your project. Everything lives inside it — identity, workflows, resources, configuration.

## Identity

The root `AGENTS.md` file defines *who the agent is* — its name, role, personality, and hard constraints. This is always loaded (Layer 0) and sets the tone for every interaction.

## Workflows

A workflow is a directed graph of **nodes** connected by **edges**. Each workflow lives in its own top-level directory inside `.agentflow/` (e.g., `build-feature/`, `code-review/`). A workflow has its own `AGENTS.md` descriptor that lists all nodes and their relationships.

## Nodes

Nodes are the stages of a workflow. Each node is a subdirectory containing a `SKILL.md` file (the primary instruction file). There are three node types:

| Type | Purpose | Has tools? | Has instructions? |
|------|---------|------------|-------------------|
| **step** | Does work — reads code, writes files, runs tests | Yes | Yes |
| **router** | Makes decisions — routes to the next node based on conditions | No | No |
| **sub-workflow** | Delegates to another workflow entirely | Inherited | Inherited |

## Resources

Shared, reusable components that nodes reference:

| Category | Directory | What it contains |
|----------|-----------|-----------------|
| **capabilities** | `capabilities/` | Tool definitions — what the agent can do (builtin, script, MCP) |
| **instructions** | `instructions/` | Reusable instruction modules — how to do things |
| **skills** | `skills/` | Conditions for routing + human touchpoints (approvals, confirmations) |
| **memory** | `memory/` | Persistent state across sessions |
| **hooks** | `hooks/` | Event-driven automation (JSON files) |

## References

The `{{ref}}` syntax connects everything together. Four types:

| Syntax | Name | Meaning |
|--------|------|---------|
| `{{capabilities/read-code}}` | Mention | Load this resource as context |
| `{{-> nodes/create-design}}` | Edge | Transition to this node next |
| `{{-> nodes/plan-tasks \| skills/design-approved}}` | Conditional edge | Transition IF condition is met |
| `{{<< output.gather-requirements}}` | Data flow | Read output from a previous node |

## Context Budgets

Every node declares how many tokens it costs when active, what references it needs, and when to resolve them. The constraint: **Layer 0 + Layer 1 + one active Layer 2 + its resolved Layer 3 refs ≤ ~8k tokens.** If it doesn't fit, split the node.

---

Next: [Directory Layout & File Conventions](03-directory-layout.md)
