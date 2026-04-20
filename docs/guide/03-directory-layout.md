---
name: directory-layout
scope: workflow
description: "Part 3: Directory structure, reserved directories, file conventions, primary file selection"
tags:
  - guide
  - structure
  - directories
  - conventions
---

# Part 3 — Directory Layout & File Conventions

## The Full Structure

```
.agentflow/
├── AGENTS.md                        ← Identity + workflow discovery (Layer 0)
├── mcp.json                         ← MCP server configuration (optional)
│
├── capabilities/                    ← Tool definitions
│   ├── read-code.md                   builtin tool
│   ├── write-file.md                  builtin tool
│   ├── run-tests.md                   script tool
│   ├── source-agent.md                MCP tool
│   └── ...
│
├── instructions/                    ← Reusable instruction modules
│   ├── requirements-elicitation.md    workflow-scoped instruction
│   ├── coding-standards.md            global instruction (auto-loaded)
│   └── ...
│
├── runbooks/                        ← Conditions + human touchpoints
│   ├── design-approved.md             condition (for routing)
│   ├── review-design.md               interaction (human approval)
│   └── ...
│
├── memory/                          ← Persistent state
│   ├── MEMORY.md                      how to use memory (read once)
│   ├── user.md                        user preferences
│   ├── decisions.md                   architectural decisions
│   ├── lessons.md                     past mistakes
│   └── facts.md                       domain knowledge
│
├── hooks/                           ← Event-driven automation
│   ├── lint-on-save.json
│   ├── diagnostics-after-write.json
│   └── ...
│
└── build-feature/                   ← A workflow
    ├── AGENTS.md                      Workflow descriptor (Layer 1)
    ├── gather-requirements/           Node directory
    │   ├── SKILL.md                     Primary file (Layer 2)
    │   └── output/                      Runtime artifacts (Layer 4, never loaded)
    ├── review-requirements-gate/      Router node
    │   └── SKILL.md
    ├── create-design/
    │   └── SKILL.md
    └── ...
```

## Reserved Directory Names

These top-level names have special meaning. The parser uses them for automatic type inference:

| Directory | Resource type | Files inside are automatically classified as... |
|-----------|--------------|------------------------------------------------|
| `capabilities/` | capability | Tool definitions (builtin, script, MCP) |
| `instructions/` | instruction | Reusable instruction modules |
| `runbooks/` | runbook | Conditions or interactions |
| `memory/` | memory | Persistent state files |
| `hooks/` | hook | Event automation (JSON only) |

## Workflow Directories

Any top-level directory that is **not** reserved and contains subdirectories with `.md` files is treated as a workflow. The subdirectories are nodes.

## Artifact Directories

Directories named `output/` inside node directories hold runtime artifacts. These are **never** loaded as context — they exist for the agent to write results into.

## File Conventions

| File | Where | Purpose |
|------|-------|---------|
| `AGENTS.md` | Root or workflow directory | Identity descriptor or workflow descriptor |
| `SKILL.md` | Node directory | Primary instruction file for a node |
| `*.md` | Node directory (alongside SKILL.md) | Additional context files, loaded alongside the primary |
| `*.json` | `hooks/` directory | Hook definitions |
| `mcp.json` | Root `.agentflow/` | MCP server configuration |

## Primary File Selection

When a node directory contains multiple `.md` files, the parser selects the primary by priority:

1. `primary: true` in frontmatter
2. Filename `main.md`
3. Alphabetically first `.md` file

All other `.md` files become context files — loaded alongside the primary.

---

Next: [The Five-Layer Context Model](04-context-layers.md)
