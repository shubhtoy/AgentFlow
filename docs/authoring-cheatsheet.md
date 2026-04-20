---
name: authoring-cheatsheet
scope: global
inclusion: auto
description: Condensed single-page reference for authoring AgentFlow workspaces
tags:
  - cheatsheet
  - authoring
  - reference
  - quick-reference
---

# AgentFlow Authoring Cheatsheet

> Full guide: [docs/guide/](./guide/00-index.md) · Taxonomy: [taxonomy-reference.md](./taxonomy-reference.md) , [taxonomy-graph.md](./taxonomy-graph.md)

---

## Workspace Structure

```
.agentflow/
  AGENTS.md              ← Identity + workflow discovery      (Layer 0, ~200-800 tok)
  mcp.json               ← MCP server configuration           (optional)
  capabilities/          ← Tool definitions: builtin, script, MCP
  instructions/          ← Reusable instruction modules (workflow + global)
  runbooks/              ← Routing conditions + human touchpoints
  memory/                ← Persistent state across sessions
  hooks/                 ← Event-driven automation (JSON)
  <workflow>/
    AGENTS.md            ← Workflow descriptor + node summaries (Layer 1, ~500-800 tok)
    <node>/
      SKILL.md           ← Stage contract + instructions       (Layer 2, 2k-8k tok)
      output/            ← Runtime artifacts                   (Layer 4, never loaded)
```

---

## Six Resource Categories (Taxonomy)

| Category | Directory | Scopes | Default Scope | Purpose |
|----------|-----------|--------|---------------|---------|
| **instructions** | `instructions/` | `workflow`, `global` | `workflow` | How to do things — reusable instruction modules |
| **capabilities** | `capabilities/` | `descriptor`, `config` | `descriptor` | What the agent can do — tool definitions |
| **runbooks** | `runbooks/` | `interaction`, `condition` | `interaction` | Routing conditions + human touchpoints |
| **memory** | `memory/` | — | `null` | Persistent state across sessions |
| **hooks** | `hooks/` | — | `null` | Event-driven automation (JSON files) |
| **identity** | `AGENTS.md` | — | N/A | Who the agent is (singular file) |

### Scope Inference (when no explicit `scope:` in frontmatter)

| Category | Condition | Inferred Scope |
|----------|-----------|---------------|
| instructions | Has `inclusion` field | `global` |
| instructions | Otherwise | `workflow` |
| capabilities | `type` is `builtin`/`script`/`mcp`/`package` | `descriptor` |
| capabilities | Otherwise | `config` |
| runbooks | `type` is `condition` | `condition` |
| runbooks | Otherwise | `interaction` |

---

## Five Context Layers

| Layer | Name | Where | Budget | Lifetime |
|-------|------|-------|--------|----------|
| L0 | Identity | Root `AGENTS.md` identity block | ~200 tok | Always loaded |
| L1 | Routing | Workflow `AGENTS.md` | ~500-800 tok | Always loaded |
| L2 | Contract | Node `SKILL.md` + resolved refs | 2k-8k tok | Current stage only |
| L3 | References | `instructions/`, `capabilities/`, `memory/` | On demand | Per ref |
| L4 | Artifacts | `node/output/` dirs | Never loaded | Written, not read |

**Constraint:** L0 + L1 + active L2 + its L3 refs ≤ **8k tokens**. If over, split the node.

---

## Reference Syntax (4 types)

```
{{capabilities/read-code}}                            → mention: load resource / wire tool
{{instructions/code-search}}                          → mention: load instruction
{{-> nodes/create-design}}                            → edge: go here next
{{-> nodes/plan-tasks | runbooks/design-approved}}    → conditional edge: go here IF
{{<< output.gather-requirements}}                     → data flow: read previous output
```

**Resolution order:** path match first (`category/name.md`), then frontmatter `name` fallback.

---

## Root AGENTS.md

```yaml
---
type: agents
name: my-workspace
description: One-sentence purpose
identity:
  name: Senior Engineer
  role: Full-stack developer
  personality: Methodical, thorough
  constraints:
    - Never skip tests
    - Always check diagnostics after edits
---
```

Body: list workflows (`{{-> nodes/...}}`), global capabilities, global instructions, memory. Summaries only.

---

## Node Types

| Type | Purpose | Has capabilities? | Has instructions? | Budget |
|------|---------|-------------------|-------------------|--------|
| **step** | Does work | Yes | Yes | 2k-8k tok |
| **router** | Routes only | **No** | **No** | ~400-500 tok |
| **sub-workflow** | Delegates | Inherited | Inherited | Varies |

---

## SKILL.md Structure (4 sections, in order)

### 1. Frontmatter

```yaml
---
name: gather-requirements
type: step                    # step | router | sub-workflow
entry: true                   # exactly 1 per workflow
agent: requirements-analyst   # optional persona
model: claude-sonnet          # optional preferred model
context:
  max_tokens: 3000
  inputs:
    - ref: instructions/requirements-elicitation
      scope: full             # full | summary | signature
    - ref: capabilities/read-code
      scope: signature
  exclude:
    - instructions/technical-design
outputs:
  - name: requirements-doc
    format: markdown
---
```

### 2. Context Budget (immediately after title)

```markdown
## Context Budget
This node costs ~3000 tokens. References:
- {{instructions/requirements-elicitation}} (~800 tok, resolve now)
- {{capabilities/read-code}} (~100 tok, resolve on use)
- {{memory/user}} (~50 tok, resolve at start)
**Do not resolve** {{instructions/technical-design}} — belongs to a later node.
```

Resolve timings: `resolve now` · `resolve on use` · `resolve on write` · `resolve at start` · `do not resolve`

### 3. Instructions (step-by-step with inline refs)

```markdown
## Instructions
### Step 1: Explore
Query {{capabilities/source-agent}} to understand the codebase.
Read {{memory/decisions}} for past choices.
### Step 2: Write
Apply {{instructions/requirements-elicitation}} to structure requirements.
Use {{capabilities/write-file}} to save the document.
```

### 4. Edges (always last)

```markdown
## Next
→ {{-> nodes/review-requirements-gate}}
{{<< output.gather-requirements}}
```

---

## Capability Frontmatter (3 types)

**Builtin:**
```yaml
---
name: read-code
type: builtin
builtin_mapping: readCode
description: Read and analyze source code files
outputs: [source_code, file_structure]
---
```

**Script:**
```yaml
---
name: run-tests
type: script
command: npm test
outputs: [test_results, pass_count, fail_count]
---
```

**MCP:**
```yaml
---
name: source-agent
type: mcp
mcp: source-agent-server          # must match key in mcp.json
parameters:
  query: { type: string, required: true }
outputs: [relevant_files, code_snippets]
---
```

---

## Instruction Frontmatter (2 scopes)

**Workflow scope** (loaded by specific nodes):
```yaml
---
name: requirements-elicitation
scope: workflow
domain: product-engineering
description: Transform requests into testable requirements
---
```

**Global scope** (auto-loaded every session):
```yaml
---
name: coding-standards
scope: global
inclusion: auto
description: Project-wide coding conventions
---
```

---

## Runbook Frontmatter (2 scopes)

**Condition** (used in conditional edges):
```yaml
---
name: design-approved
type: condition
check: The user explicitly approved the design with no outstanding concerns
---
```

`check` must be unambiguous and evaluable. Good: specific. Bad: vague.

**Interaction** (human touchpoints):
```yaml
---
name: review-design
type: approval          # approval | freeform | choice | confirm
timeout: 300
---
```

Body: "What to Present" + "User Options" (Approve / Reject / Edit).

---

## Memory

| File | Purpose |
|------|---------|
| `MEMORY.md` | How to use memory (read once) |
| `user.md` | User preferences, conventions |
| `decisions.md` | Choices + reasoning |
| `lessons.md` | Past mistakes |
| `facts.md` | Domain knowledge |

Rules: date-prefix entries `[YYYY-MM-DD]`, be specific, never store secrets, prune stale info.

---

## Hooks (`hooks/*.json`)

```json
{
  "name": "lint-on-save",
  "version": "1.0.0",
  "event": "fileEdited",
  "condition": { "field": "path", "operator": "matches", "value": "\\.(ts|js)$" },
  "action": { "type": "run-script", "target": "npm run lint -- --fix" },
  "enabled": true,
  "priority": 100
}
```

**Events:** `fileEdited`, `fileCreated`, `fileDeleted`, `preToolUse`, `postToolUse`, `workflowStarted`, `workflowCompleted`, `workflowFailed`, `nodeEntered`, `nodeCompleted`, `memoryUpdated`, `protocolToggled`, `pre-commit`, `session-end`

**Actions:** `trigger-workflow`, `run-script`, `notify`, `log`

**Operators:** `equals`, `contains`, `matches`, `startsWith`, `endsWith`

**Priority:** 0–1000 (lower runs first, default 100). Regex patterns > 512 chars or ReDoS-prone are rejected.

---

## MCP Configuration (`mcp.json`)

```json
{
  "mcpServers": {
    "source-agent-server": {
      "command": "uvx",
      "args": ["source-agent-mcp@latest"],
      "env": { "GITHUB_TOKEN": "${env:GITHUB_TOKEN}" },
      "required": true,
      "description": "Semantic code search"
    }
  }
}
```

- `${env:VAR}` tokens resolved at connection time, never stored in plaintext
- `{rootDir}` placeholder in args/env replaced with workspace root
- `required: true` → workflow aborts if server unavailable
- Defaults (no config): filesystem, git, memory, fetch, sequentialthinking

---

## Graph Design Patterns

```
Pattern 1 — Linear:       req → design → tasks → implement → verify
Pattern 2 — Review gates: req → gate → design → gate → tasks
Pattern 3 — Rejection:    gate ──rejected──→ req (revise)
Pattern 4 — Iteration:    implement → gate ──more──→ implement
                                      └──done──→ verify
Pattern 5 — Checkpoint:   implement → confirm → gate
```

Combined (`build-feature`):
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

## Token Estimation

~1 token ≈ 4 chars (English) · ~1 token ≈ 3 chars (code)

| Component | Budget |
|-----------|--------|
| Root AGENTS.md | ~200 tok |
| Workflow AGENTS.md | ~500-800 tok |
| Node SKILL.md | ~1000-3000 tok |
| Each instruction | ~300-800 tok |
| Each capability (as context) | ~100-300 tok |
| Each memory file | ~50-500 tok |
| **Total per active step** | **~5k-8k tok** |

Split a node if total > 8k tokens.

---

## Pre-Shipped Library

**Capabilities (12):** `read-code`, `write-file`, `run-tests`, `get-diagnostics`, `web-search`, `git-history`, `source-agent`, `analyze-image`, `file-search`, `list-directory`, `grep-search`, `shell-exec`

**Instructions (12):** `requirements-elicitation`, `technical-design`, `task-decomposition`, `implementation-discipline`, `code-search`, `security-review`, `api-design`, `test-analysis`, `coding-standards`, `debugging`, `refactoring`, `prompt-engineering`

**Runbooks (29):** 17 conditions (`design-approved`, `design-rejected`, `requirements-approved`, `requirements-rejected`, `tasks-approved`, `tasks-rejected`, `tests-pass`, `tests-fail`, `all-tasks-done`, `more-tasks-remain`, `task-complete`, `task-failed`, `implementation-ready`, `retry-with-feedback`, `code-needed`, `debug-needed`, `explore-needed`) + 12 interactions (`review-design`, `review-requirements`, `review-tasks`, `checkpoint`, `collect-feedback`, `show-diff`, `escalate-to-human`, `confirm-destructive`, `explain-needed`, `refactor-needed`, `new-request`, `session-ending`)

**Hooks (5):** `diagnostics-after-write`, `lint-on-save`, `test-on-change` *(off)*, `security-scan-on-commit` *(off)*, `memory-on-session-end`

**Memory (5):** `MEMORY`, `user`, `decisions`, `facts`, `lessons`

**Workflows (4):** `build-feature` (9 nodes), `code-review` (3 nodes), `interactive-assistant`, `agent-builder`

---

## Validation Rules

| Rule | Severity |
|------|----------|
| All `{{ref}}` resolve to existing files | Error |
| Exactly 1 `entry: true` node per workflow | Error |
| Required frontmatter present (e.g. `check` on conditions) | Error |
| Router nodes: zero capabilities, zero instructions | Error (strict) |
| Active stage total ≤ 8k tokens | Warning |
| Unreachable nodes (no incoming edges, not entry) | Warning |
| MCP capability references server not in `mcp.json` | Warning |
| `output/` dir exists for nodes declaring outputs | Warning |
| Root AGENTS.md has identity block | Warning |
| Cycles in workflow graph | Warning (informational) |

---

## Primary File Selection (multi-file node dirs)

1. `primary: true` in frontmatter
2. Filename `main.md`
3. Alphabetically first `.md` file

All other `.md` files in the node dir → context files loaded alongside primary.

---

## Branding

Precedence: env vars > `agentflow.config.json` > defaults (`AgentFlow` / `.agentflow` / `agentflow`)

| Env var | Field | Constraints |
|---------|-------|-------------|
| `AGENTFLOW_BRAND_NAME` | `name` | 1-64 chars |
| `AGENTFLOW_DIR` | `dir` | 1-64 chars, `[a-zA-Z0-9._-]` |
| `AGENTFLOW_CLI` | `cli` | 1-32 chars, `[a-z0-9-]` |

---

## Builder Patterns

`single` · `supervisor` · `router` · `handoff` · `blackboard` · `pipeline`

5-phase scaffold: Intent → Pattern → Tools → Nodes → Review → Generate
