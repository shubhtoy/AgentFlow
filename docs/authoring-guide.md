# AgentFlow Authoring Guide

Every token loaded is a token the model can't use for reasoning. Your folder structure *is* the architecture. Design it like a budget.

---

## Directory Layout

```
.agentflow/
  AGENTS.md                    ← Identity + discovery (~200-800 tok)
  instructions/                ← Reusable instruction sets + steering (was: skills/ + steering/)
  capabilities/                ← Tool definitions: builtin, script, MCP (was: tools/)
  skills/                    ← Conditions + human touchpoints (was: templates/ + interactions/)
  memory/                      ← Persistent state across sessions
  hooks/                       ← Event-driven automation
  <workflow>/
    AGENTS.md                  ← Workflow descriptor + node summaries
    <node>/
      SKILL.md                 ← Stage contract (instructions + refs)
      output/                  ← Runtime artifacts (excluded from context)
```

---

## Five Context Layers

| Layer | What | Where | Budget |
|-------|------|-------|--------|
| 0 — Identity | Who is the agent | Root `AGENTS.md` `identity:` block | ~200 tok, always loaded |
| 1 — Routing | Which stage is active | Workflow `AGENTS.md` edges | ~500-800 tok |
| 2 — Contract | What this stage does | Node `SKILL.md` + resolved refs | 2k-8k tok per stage |
| 3 — References | Shared knowledge | `instructions/`, `capabilities/`, `memory/`, etc. | Resolved on demand |
| 4 — Artifacts | Runtime output | `<node>/output/` directories | Never loaded as context |

**The constraint:** Layer 0 + Layer 1 + one active Layer 2 + its resolved Layer 3 refs should fit in ~5k-8k tokens. If it doesn't, split the node.

---

## Reference Syntax

```
{{capabilities/read-code}}                              → mention (load this resource)
{{instructions/code-search}}                            → mention (load instruction)
{{-> nodes/create-design}}                              → edge (go here next)
{{-> nodes/plan-tasks | skills/design-approved}}      → conditional edge (go here IF)
{{<< output.gather-requirements}}                       → data flow (read previous output)
```

---

## Root AGENTS.md (Layer 0 + 1)

```yaml
---
type: agents
name: my-workspace
description: One-sentence purpose
identity:
  name: Senior Engineer
  role: Full-stack developer
  constraints:
    - Never skip tests
    - Always run diagnostics after edits
---
```

Body: list workflows, global tools, skills, memory. Summaries only — one line each.

```markdown
## Workflows
- {{-> nodes/build-feature}} — Requirements → design → tasks → implement → verify

## Capabilities
{{capabilities/read-code}}, {{capabilities/write-file}}, {{capabilities/run-tests}}

## Memory
{{memory/user}}, {{memory/decisions}}, {{memory/lessons}}
```

---

## Workflow AGENTS.md (Layer 1)

Lists all nodes with token estimates. This is the map — cheap to load, never detailed.

```markdown
## Nodes
- {{-> nodes/gather-requirements}} — Write requirements (~3k tok when active)
- {{-> nodes/review-gate}} — Approve or reject (~500 tok)
- {{-> nodes/implement}} — Write code (~3.5k tok, runs N times)
```

---

## Node SKILL.md (Layer 2)

The core unit. Four sections, in order:

### 1. Frontmatter

```yaml
---
name: gather-requirements
type: step          # step | router | sub-workflow
entry: true         # first node only
agent: analyst      # optional persona
context:
  max_tokens: 3000
  inputs:
    - ref: instructions/requirements-elicitation
      scope: full
    - ref: capabilities/source-agent
      scope: full
    - ref: memory/user
      scope: summary
  exclude:
    - instructions/technical-design
outputs:
  - name: requirements-doc
    format: markdown
---
```

### 2. Context Budget

Immediately after the title. Every ref, its cost, when to resolve it.

```markdown
## Context Budget
This node costs ~3000 tokens. References:
- {{instructions/requirements-elicitation}} (~800 tok, resolve now)
- {{capabilities/source-agent}} (~300 tok, resolve now)
- {{capabilities/read-code}} (~100 tok, resolve on use)
- {{memory/user}} (~50 tok, resolve at start)

**Do not resolve** {{instructions/technical-design}} — belongs to a later node.
```

### 3. Instructions

Step-by-step work. Reference tools and skills inline where they're used.

```markdown
## Instructions

### Step 1: Explore
Use {{capabilities/source-agent}} to query the codebase.
Read {{memory/decisions}} for past choices.

### Step 2: Write
Apply {{instructions/requirements-elicitation}} to structure requirements.
Use {{capabilities/write-file}} to save the document.

### Step 3: Record
Write decisions to {{memory/decisions}}.
```

### 4. Edges

Where to go next. Always last.

```markdown
## Next
→ {{-> nodes/review-requirements-gate}}
{{<< output.gather-requirements}}
```

---

## Router Nodes

Lightweight. No tools, no skills. Just route.

```yaml
---
name: review-design-gate
type: router
---
```

```markdown
# Review Design Gate

Present design via {{skills/review-design}}.

## Routing
- Approved → {{-> nodes/plan-tasks | skills/design-approved}}
- Rejected → {{-> nodes/create-design | skills/design-rejected}}
```

Budget: ~400-500 tokens. If your router needs capabilities, it's not a router — it's a step.

---

## Resource Definitions

### Capabilities (was: Tools)

Three types:

```yaml
# Builtin — maps to agent runtime capability
---
name: read-code
type: builtin
outputs: [source_code, file_structure]
---

# Script — runs a shell command
---
name: run-tests
type: script
command: npm test
outputs: [test_results, pass_count, fail_count]
---

# MCP — connects to an MCP server
---
name: source-agent
type: mcp
mcp:
  server: source-agent-server
  tool: query_codebase
parameters:
  query: { type: string, required: true }
  scope: { type: string, required: false }
outputs: [relevant_files, code_snippets]
---
```

MCP capabilities: document the server config in the body so users know how to set it up.

### Instructions (was: Skills + Steering)

Reusable instruction modules. Self-contained — should make sense without the node that references them.

**Workflow scope** (was "skill"):
```yaml
---
name: requirements-elicitation
domain: product-engineering
description: Transform vague requests into testable requirements
---
```

Body: process steps, anti-patterns, output format. No node-specific context.

**Global scope** (was "steering"):
```yaml
---
name: coding-standards
inclusion: auto
description: Project-wide coding conventions
---
```

### Skills — Conditions (was: Templates)

Used in conditional edges. The `check` field must be unambiguous.

```yaml
---
name: design-approved
type: condition
check: The user explicitly approved the design with no outstanding concerns
---
```

### Skills — Interactions

Human touchpoints. Document what to show and what the user can do.

```yaml
---
name: review-design
type: approval
timeout: 300
---
```

Body: "What to Present" + "User Options" (Approve / Reject / Edit).

### Memory

Append-friendly files. Date-prefix entries. Never store secrets.

```
memory/
  MEMORY.md      ← How to use memory (read once)
  user.md        ← Preferences and conventions
  decisions.md   ← Choices with reasoning
  facts.md       ← Domain knowledge
  lessons.md     ← Past mistakes
```

Nodes declare reads and writes: "Read `memory/user` at start. Write to `memory/decisions` when making choices."

### Hooks

Event-driven automation. JSON files in `hooks/` that trigger actions on workspace events.

```json
{
  "name": "lint-on-save",
  "version": "1.0.0",
  "description": "Run linter when source files change",
  "event": "fileEdited",
  "condition": {
    "field": "path",
    "operator": "matches",
    "value": "\\.(ts|tsx|js|jsx)$"
  },
  "action": {
    "type": "run-script",
    "target": "npm run lint -- --fix",
    "params": {}
  },
  "enabled": true,
  "priority": 100
}
```

Hook fields:
- `event` — what triggers it: `fileEdited`, `fileCreated`, `pre-commit`, `session-end`, etc.
- `condition` — optional filter with `field`, `operator` (`equals`, `contains`, `matches`, `startsWith`, `endsWith`), and `value`
- `action.type` — what to do: `trigger-workflow`, `run-script`, `notify`, `log`
- `action.target` — the workflow name, script command, or notification target
- `priority` — lower numbers run first (0-1000, default 100)
- `enabled` — toggle without deleting

Pre-shipped hooks in the library:
- `diagnostics-after-write` — run diagnostics after code file edits
- `lint-on-save` — auto-lint on save
- `test-on-change` — run related tests on source changes (disabled by default)
- `security-scan-on-commit` — audit dependencies before commit (disabled by default)
- `memory-on-session-end` — remind agent to persist learnings

### MCP Configuration

MCP servers are configured in `.agentflow/mcp.json` (or `.kiro/settings/mcp.json` for Kiro):

```json
{
  "mcpServers": {
    "source-agent-server": {
      "command": "uvx",
      "args": ["source-agent-mcp@latest"],
      "env": { "FASTMCP_LOG_LEVEL": "ERROR" },
      "disabled": false,
      "autoApprove": []
    },
    "filesystem-server": {
      "command": "uvx",
      "args": ["awslabs.fs-mcp-server@latest"],
      "env": {},
      "disabled": false,
      "autoApprove": ["read_file", "list_directory"]
    }
  }
}
```

MCP capabilities reference their server in frontmatter:

```yaml
---
name: source-agent
type: mcp
mcp:
  server: source-agent-server
  tool: query_codebase
---
```

The body of an MCP capability should document the server configuration so users know how to set it up.

---

## Graph Design Patterns

### 1. Start linear
```
requirements → design → tasks → implement → verify
```

### 2. Add review gates between phases
```
requirements → review-req-gate → design → review-design-gate → tasks
```

### 3. Add rejection loops
```
review-req-gate:
  approved → design
  rejected → requirements (revise)
```

### 4. Add iteration loops
```
implement → task-gate:
  failed    → implement (retry)
  more-left → implement (next task)
  all-done  → verify
```

### Visual
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

---

## Validation

```bash
node src/cli.js validate path/to/.agentflow
```

Checks: ref resolution, frontmatter schemas, context budgets, output declarations, identity structure, graph connectivity.

---

## Checklist

- [ ] Root `AGENTS.md` under 800 tokens with identity block
- [ ] Every node has a Context Budget section with token estimates
- [ ] Every ref has resolve timing (now / on use / on write)
- [ ] Excluded refs are explicitly listed per node
- [ ] Active stage total under 8k tokens
- [ ] Router nodes have zero capabilities and zero instructions
- [ ] Entry node marked `entry: true`
- [ ] Every `{{ref}}` resolves to an existing file
- [ ] Every conditional edge has a matching skill (condition)
- [ ] Data flow refs point to nodes that produce output
- [ ] `output/` dirs exist for nodes that declare outputs
- [ ] Review gates between every major phase
- [ ] Rejection loops go back to the correct node
- [ ] Iteration loops have termination conditions
- [ ] MCP capabilities document their server configuration
- [ ] Memory files are append-friendly with date prefixes
- [ ] Hooks use valid event names and action types
- [ ] Hook conditions use valid operators (equals, contains, matches, startsWith, endsWith)
- [ ] MCP config exists for every MCP capability referenced
- [ ] Global instructions use `inclusion: auto` in frontmatter
- [ ] All refs use new taxonomy: `capabilities/`, `instructions/`, `skills/` (not `tools/`, `skills/`, `templates/`, `interactions/`)

---

## Pre-Shipped Library

The library ships with ready-to-use resources across all categories:

### Capabilities (12)
`read-code`, `write-file`, `run-tests`, `get-diagnostics`, `web-search`, `git-history`, `source-agent` (MCP), `analyze-image`, `file-search`, `list-directory`, `grep-search`, `shell-exec`

### Instructions (12)
`requirements-elicitation`, `technical-design`, `task-decomposition`, `implementation-discipline`, `code-search`, `security-review`, `api-design`, `test-analysis`, `coding-standards` (global/auto), `debugging`, `refactoring`, `prompt-engineering`

### Skills (22)
Conditions: `design-approved`, `design-rejected`, `requirements-approved`, `requirements-rejected`, `tasks-approved`, `tasks-rejected`, `tests-pass`, `tests-fail`, `all-tasks-done`, `more-tasks-remain`, `task-complete`, `task-failed`, `implementation-ready`, `retry-with-feedback`
Interactions: `review-design`, `review-requirements`, `review-tasks`, `checkpoint`, `collect-feedback`, `show-diff`, `escalate-to-human`, `confirm-destructive`

### Hooks (5)
`diagnostics-after-write`, `lint-on-save`, `test-on-change`, `security-scan-on-commit`, `memory-on-session-end`

### Memory (5)
`MEMORY` (instructions), `user`, `decisions`, `facts`, `lessons`
