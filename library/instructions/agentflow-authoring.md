---
name: agentflow-authoring
description: Complete reference for authoring AgentFlow workspaces — file formats, taxonomy, context layers, reference syntax, validation rules
domain: agentflow
tags:
  - agentflow
  - authoring
  - reference
  - system
---

# AgentFlow Authoring Reference

You are building on the AgentFlow platform. This is your reference for all file formats, conventions, and rules.

## Workspace Structure

```
.agentflow/
  AGENTS.md              ← Identity + workflow discovery      (Layer 0, ~200-800 tok)
  mcp.json               ← MCP server configuration           (optional)
  capabilities/          ← Tool definitions: builtin, script, MCP
  instructions/          ← Reusable instruction modules
  memory/                ← Persistent state across sessions
  hooks/                 ← Event-driven automation (JSON)
  <workflow>/
    AGENTS.md            ← Workflow descriptor + node summaries (Layer 1, ~500-800 tok)
    <node>/
      SKILL.md           ← Stage contract + instructions       (Layer 2, 2k-8k tok)
      output/            ← Runtime artifacts                   (Layer 4, never loaded)
```

## Five Resource Categories

| Category | Directory | Purpose |
|----------|-----------|---------|
| **instructions** | `instructions/` | How to do things — reusable instruction modules |
| **capabilities** | `capabilities/` | What the agent can do — tool definitions |
| **memory** | `memory/` | Persistent state across sessions |
| **hooks** | `hooks/` | Event-driven automation (JSON files) |
| **identity** | `AGENTS.md` | Who the agent is |

## Five Context Layers

| Layer | Where | Budget | Lifetime |
|-------|-------|--------|----------|
| L0 Identity | Root `AGENTS.md` identity block | ~200 tok | Always loaded |
| L1 Routing | Workflow `AGENTS.md` | ~500-800 tok | Always loaded |
| L2 Contract | Node `SKILL.md` + resolved refs | 2k-8k tok | Current stage only |
| L3 References | `instructions/`, `capabilities/`, `memory/` | On demand | Per ref |
| L4 Artifacts | `node/output/` dirs | Never loaded | Written, not read |

**Constraint:** L0 + L1 + active L2 + its L3 refs ≤ 8k tokens. Split the node if over.

## Reference Syntax

```
{{capabilities/read-code}}                            → mention: load resource
{{instructions/code-search}}                          → mention: load instruction
{{-> nodes/create-design}}                            → edge: go here next
{{-> nodes/plan-tasks | the design is approved}}      → conditional edge: go here IF
{{<< output.gather-requirements}}                     → data flow: read previous output
```

## Node Types

| Type | Purpose | Has capabilities? | Has instructions? |
|------|---------|-------------------|-------------------|
| **step** | Does work | Yes | Yes |
| **router** | Routes only | **No** | **No** |
| **sub-workflow** | Delegates | Inherited | Inherited |

## SKILL.md Frontmatter

```yaml
---
name: gather-requirements
type: step
entry: true                   # exactly 1 per workflow
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

## Root AGENTS.md Frontmatter

```yaml
---
type: agents
name: my-workspace
description: One-sentence purpose
identity:
  name: Agent Name
  role: What it does
  personality: How it behaves
  constraints:
    - Hard rules it must follow
---
```

Body: workflows (`{{-> nodes/...}}`), capabilities, instructions, memory refs, boundaries, when-stuck rules.

## Capability Types

- **Builtin:** `type: builtin`, `builtin_mapping: readCode`
- **Script:** `type: script`, `command: npm test`
- **MCP:** `type: mcp`, `mcp: server-name` (must match key in mcp.json)

## Hook Format (JSON)

```json
{
  "name": "hook-name",
  "event": "fileEdited",
  "condition": { "field": "path", "operator": "matches", "value": "\\.(ts|js)$" },
  "action": { "type": "run-script", "target": "npm run lint" },
  "enabled": true,
  "priority": 100
}
```

Events: `fileEdited`, `fileCreated`, `fileDeleted`, `preToolUse`, `postToolUse`, `workflowStarted`, `workflowCompleted`, `nodeEntered`, `nodeCompleted`, `memoryUpdated`, `session-end`

## MCP Configuration (mcp.json)

```json
{
  "mcpServers": {
    "server-name": {
      "command": "command",
      "args": ["arg1"],
      "env": { "API_KEY": "${env:VAR}" }
    }
  }
}
```

Use `${env:VAR}` for secrets. Never hardcode.

## Graph Patterns

| Pattern | When |
|---------|------|
| pipeline | Steps in sequence, each feeding the next |
| router | Input classified and sent to different handlers |
| supervisor | Coordinator delegates to specialists |
| handoff | Agents pass work in sequence |
| single | Just one step |

Always add review gates before irreversible actions. Rejection loops go back to the producer. Loops need exit conditions.

## Validation Rules

- All `{{ref}}` must resolve to existing files (Error)
- Exactly 1 `entry: true` node per workflow (Error)
- Router nodes: zero capabilities, zero instructions (Error)
- Active stage total ≤ 8k tokens (Warning)
- No unreachable nodes (Warning)
- MCP refs must match mcp.json keys (Warning)

## Token Estimation

~1 token ≈ 4 chars (English), ~3 chars (code). Split a node if total > 8k tokens.
