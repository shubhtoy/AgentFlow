---
name: what-agentflow-is
scope: workflow
description: "Part 1: What AgentFlow is — philosophy, principles, and consumption levels"
tags:
  - guide
  - introduction
  - philosophy
---

# Part 1 — What AgentFlow Is

AgentFlow is a **declarative, markdown-based format** for defining AI agent workflows. It answers a specific question: *how do you structure agent instructions so that the right context is loaded at the right time, and nothing more?*

It is not a framework, not a runtime, and not a visual tool. It is a **format** — standard markdown files organized in directories, with YAML frontmatter for metadata and a lightweight `{{ref}}` syntax for encoding graph relationships.

## What Makes It Different

Most agent systems treat context as unlimited — they concatenate system prompts, tool descriptions, conversation history, and retrieved documents into a single prompt. This works for simple tasks. It breaks for multi-step workflows where:

- Different stages need different instructions
- Tools are only relevant at certain points
- Prior outputs need to flow forward selectively
- The agent needs to maintain identity across stages

AgentFlow treats context like memory in a constrained system. Every piece of context has a **cost** (tokens), a **scope** (which stages need it), and a **lifetime** (when to load, when to discard). The format encodes all of this in the file structure itself.

## Five Design Principles

| # | Principle | What it means |
|---|-----------|---------------|
| 1 | **Directory is architecture** | The folder layout *is* the workflow structure. No build step, no compilation. `ls` shows the architecture. `cat` shows the content. Git tracks the history. |
| 2 | **Context is scarce** | Every token loaded is a token the model can't reason with. The format makes context loading explicit and budgeted. |
| 3 | **Progressive strictness** | Frontmatter is optional. Drop a `.md` file in the right directory and it works. Add metadata when you need precision. |
| 4 | **Platform agnostic** | Any AI system can consume the output — Kiro, Claude Code, Cursor, GPT, or a shell script that concatenates files into a prompt. |
| 5 | **Refs encode intent** | The `{{ref}}` syntax tells the parser *what you mean* — load this resource, go to this node, check this condition, read this output. |

## Two Consumption Levels

**Level 1 — Read-only (any agent):** The agent reads the `.agentflow/` markdown as context and follows the instructions. No tooling required. Works today with zero integration.

**Level 2 — Graph-walking (orchestrator):** A runtime walks the graph node by node, loading only the current stage's context, executing tools, evaluating routing conditions, and advancing. The reference runtime demonstrates this.

---

Next: [Core Concepts](02-core-concepts.md)
