---
name: root-agents-md
scope: workflow
description: "Part 6: Writing the root AGENTS.md — identity, frontmatter schema, body structure"
tags:
  - guide
  - agents-md
  - identity
  - frontmatter
---

# Part 6 — Writing Your Root AGENTS.md

The root `AGENTS.md` is the entry point for every executor. It lives at `.agentflow/AGENTS.md` and defines the agent's identity, lists available workflows, and references global resources.

**Budget target: ~200–800 tokens.** This is always loaded. Keep it lean.

## Frontmatter

```yaml
---
type: agents
name: my-workspace
description: One-sentence purpose of this workspace
identity:
  name: Senior Engineer
  role: Full-stack developer specializing in spec-driven feature development
  personality: Methodical, thorough, prefers small PRs and incremental verification
  constraints:
    - Never skip tests
    - Always check diagnostics after edits
    - Never skip the requirements or design phase
    - Write to memory as you learn
---
```

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `type` | `"agents"` | Yes | Identifies this as a descriptor file |
| `name` | string | No | Workspace name |
| `description` | string | No | One-sentence purpose |
| `identity.name` | string | No | Agent persona name |
| `identity.role` | string | No | What the agent does |
| `identity.personality` | string | No | Behavioral traits |
| `identity.constraints` | string[] | No | Hard rules the agent must always follow |

## Body Structure

The body lists workflows, global capabilities, instructions, and memory — **summaries only**, one line each.

```markdown
# My Workspace

You are a senior software engineer agent. You build features methodically
using a structured spec-driven process.

## Workflows

- {{-> nodes/build-feature}} — Requirements → design → tasks → implement → verify
- {{-> nodes/code-review}} — Scan → analyze → report

## Global Capabilities

{{capabilities/read-code}}, {{capabilities/write-file}}, {{capabilities/run-tests}},
{{capabilities/get-diagnostics}}, {{capabilities/source-agent}}

## Global Instructions

{{instructions/coding-standards}}

## Memory

- {{memory/user}} — User preferences and conventions
- {{memory/decisions}} — Past architectural decisions
- {{memory/lessons}} — Past mistakes and learnings
- {{memory/facts}} — Domain knowledge
- {{memory/MEMORY}} — How to use the memory system (load once)
```

## Tips

- Keep the identity block tight. Constraints are the most important part — they're the guardrails.
- List workflows as edge refs (`{{-> nodes/...}}`) so the parser builds the graph.
- Global capabilities and instructions listed here are available to all workflows.
- Memory refs here tell the agent what persistent state exists.

---

Next: [Designing Workflows](07-designing-workflows.md)
