# V3 Engine Design — Final

> Status: APPROVED — April 2026
> Pre-launch (closed stealth). No backward compatibility needed.

---

## 1. What AgentFlow Is

- A visual workflow designer for AI agent pipelines defined as directories and markdown
- A spec format: `.agentflow/` workspaces with AGENTS.md identity, SKILL.md nodes, resource files
- An export pipeline: author once → Agent Spec JSON (primary) + IDE file layouts (secondary)
- A context engineering tool: 5-layer selective context model
- Accessible to non-developers: anyone with a text editor can modify agent behavior
- NOT a runtime. NOT a framework. Defines workflows, doesn't execute them.

---

## 2. Node Types

Two explicit types. Router is inferred.

| Type | Declaration | When |
|------|------------|------|
| `step` | Default (no type needed) | Every node that does work |
| `sub-workflow` | Explicit (`type: sub-workflow`, `workflow:` field required) | Delegates to another workflow |

**Router is not a type.** A node with conditional edges (`{{-> target | condition}}`) is rendered as a router on the canvas and exported as a `BranchingNode` in Agent Spec. The parser detects this from edge data. The exporter already works this way (transforms.js line 470).

**No `interaction` type.** Human-in-the-loop is a content decision, not a structural one. A step whose SKILL.md says "ask the user for approval" is just a step. The exporter can set `human_in_the_loop: true` on the Agent Spec output based on content heuristics or a frontmatter hint.

---

## 3. Resource Categories

Five categories. `runbooks/` is gone entirely.

| Category | Dir | What | Agent Spec Mapping |
|----------|-----|------|-------------------|
| `instructions` | `instructions/` | Rules, conventions, knowledge, steering | Agent `system_prompt` content |
| `capabilities` | `capabilities/` | Tool definitions | `Tool` family (ServerTool, ClientTool, MCPTool, BuiltinTool) |
| `skills` | `skills/` | Packaged expertise (Agent Skills spec) | Opaque — per-platform mapping |
| `memory` | `memory/` | Persistent state | Future Agent Spec Memory component |
| `hooks` | `hooks/` | Event triggers (JSON) | Runtime-specific |

### Capability subtypes (unchanged)

`builtin`, `script`, `mcp`, `package` — maps 1:1 to Agent Spec Tool types.

### Skills vs Instructions vs Capabilities

| | Instruction | Capability | Skill |
|-|------------|-----------|-------|
| Structure | Single .md file | Single .md file | Directory (SKILL.md + references/ + scripts/ + assets/) |
| Purpose | Knowledge/rules | Tool definition | Packaged expertise |
| Loading | Full file on `{{ref}}` | Full file on `{{ref}}` | Progressive: metadata → body → references |
| Scope | Workspace or workflow | Workspace or workflow | Workspace only |
| Ecosystem | Local | Local | 91K+ on skills.sh |

### What happened to runbooks

| V2 runbook concept | V3 replacement |
|-------------------|----------------|
| Conditions (`type: condition`) | Inline text in edge syntax: `{{-> target \| condition text}}` or reference: `{{-> target \| instructions/criteria}}` |
| Interactions (`type: approval/freeform/choice/confirm`) | Just steps. Content determines behavior. |
| `narrativeTemplate` (prefix/suffix) | Universal frontmatter field on any resource |

---

## 4. Type Resolution

How the parser decides what a file IS:

```
1. frontmatter.type exists and is a known type → use it
2. file is in a conventional dir (instructions/, capabilities/, skills/, memory/, hooks/) → infer from dir
3. file is AGENTS.md → type: agents
4. otherwise → untyped
```

**Directory = type.** A file in `instructions/` is an instruction. Frontmatter `type` inside a conventional dir is redundant (but not an error). Frontmatter only matters for files outside conventional dirs or for disambiguation.

**Filename is not a constraint.** SKILL.md is a convention for `identifyPrimaryFile()`. Any .md file with the right frontmatter works. Files can be named anything.

---

## 5. Scope Resolution

Determined entirely by position in the tree. No `scope` or `inclusion` frontmatter fields.

```
.agentflow/<resource-dir>/file.md                    → workspace scope
.agentflow/<workflow>/<resource-dir>/file.md          → workflow scope
.agentflow/<workflow>/<node>/file.md                  → node scope (context file)
```

### How "global" / "always-on" works

No separate mechanism. Use AGENTS.md:

- **Workspace-wide always-on:** Put it in root `AGENTS.md` (L0)
- **Workflow-wide always-on:** Put it in workflow `AGENTS.md` (L1), or reference instructions from there
- **On-demand:** Put it in `instructions/` and reference via `{{ref}}`

**Refs inside AGENTS.md are resolved.** If workflow AGENTS.md contains `{{instructions/code-style}}`, that instruction is loaded into L1 context for every node in the workflow. This is the mechanism for "auto-include these rules for all nodes" without needing `scope: global` or `inclusion: auto`.

---

## 6. Ref Resolution

When node `build-feature/implement/SKILL.md` contains `{{instructions/code-style}}`:

```
1. Check workflow-scoped: build-feature/instructions/code-style.md
2. Check workspace-scoped: instructions/code-style.md
3. Neither exists → broken_ref validation error
```

Nearest scope wins. Workflow shadows workspace. Like variable scoping.

### Condition refs in edges

```markdown
{{-> create-design | requirements are complete}}
```
→ Inline text. Stored as `edge.condition` string.

```markdown
{{-> create-design | instructions/approval-criteria}}
```
→ Resource reference. Resolved using the same ref resolution algorithm. Content (with `narrativeTemplate` wrapping) used as condition description.

### Data flow refs

```markdown
{{<< output.gather-requirements}}
```
→ Data flow from another node's output. Becomes `DataFlowEdge` in Agent Spec export.

### Template variables

```markdown
{{$workflows}}  {{$resources}}  {{$directory}}  {{$execution}}
```
→ NOT refs. `$`-prefixed tokens are excluded from ref resolution. Resolved at export time.

### Skill refs

```markdown
{{skills/security-review}}
```
→ Loads SKILL.md body into L3. Does NOT auto-load references/scripts/ (progressive disclosure). Workspace-scoped only (no workflow-scoped skills).

---

## 7. Selective Context Model (5 Layers — Unchanged)

| Layer | What | Source | Loading |
|-------|------|--------|---------|
| L0 — Identity | Root AGENTS.md + resolved refs | Workspace | Always |
| L1 — Routing | Workflow AGENTS.md + resolved refs | Workflow | When workflow active |
| L2 — Contract | Node's primary file + context files in node dir | Node | When node executes |
| L3 — Reference | Instructions, capabilities, skills | Workspace or workflow | On `{{ref}}` |
| L4 — Artifacts | Node outputs, memory | Runtime | On `{{<< output}}` |

**Change from V2:** L0 and L1 now resolve `{{ref}}` mentions inside AGENTS.md files. This enables auto-loading instructions for all nodes without a separate `scope: global` mechanism.

---

## 8. Frontmatter Schemas

### Node
```yaml
name: string (required)
type: enum [step, sub-workflow]     # default: step. Router is inferred.
description: string
workflow: string                     # required when type: sub-workflow
entry: boolean
agent: string                        # persona override
model: string                        # preferred model hint
outputs: object[]                    # [{name, format, description}]
context: { max_tokens, inputs, exclude }
```

### Instruction
```yaml
name: string (required)
description: string
domain: string
tags: string[]
max_tokens: integer
narrativeTemplate: { prefix, suffix }
platforms: {}                        # opaque platform-specific hints
```

No `scope` or `inclusion` fields. Scoping is positional. Inclusion is by reference.

### Capability
```yaml
name: string (required)
type: enum [builtin, script, mcp, package]
description: string
parameters: object                   # JSON Schema for tool params
command: string                      # when type: script
mcp: string                          # when type: mcp
package: string                      # when type: package
builtin_mapping: string              # when type: builtin
outputs: object[]
narrativeTemplate: { prefix, suffix }
```

### Skill
```yaml
name: string (required)
description: string (required)       # used for progressive disclosure discovery
allowed-tools: string                # Agent Skills spec field
tags: string[]
```

### Memory
```yaml
name: string (required)
description: string
editable: boolean
narrativeTemplate: { prefix, suffix }
```

### Agents (identity)
```yaml
name: string (required)
description: string
identity: { name, role, personality, constraints }
```

### Removed
- `runbook` schema — gone entirely
- `scope` field on instructions — gone (positional)
- `inclusion` field on instructions — gone (by reference)
- `primary` field on nodes — gone (convention-based: SKILL.md > main.md > alphabetical)

---

## 9. Export Architecture

**All export is server-side.** The `/api/export` route handles everything. Client sends the workspace files, server returns the exported result (JSON or ZIP).

### Dependency: `tsagentspec`

Vendor Oracle's TypeScript Agent Spec SDK (`oracle/agent-spec/tsagentspec/`) into `packages/cli`. It provides:
- Type-safe component classes (Agent, Flow, Node, Tool, Edge, etc.)
- Serialization to valid Agent Spec JSON/YAML
- Schema validation (61 fixture configs pass round-trip)
- Apache 2.0 / UPL-1.0 licensed

We use `tsagentspec` types to build our transform, then call its serializer. This guarantees Agent Spec schema compliance without maintaining our own JSON serializer.

### Primary: Agent Spec JSON

One fully-compliant exporter. AgentFlow → `tsagentspec` objects → valid Agent Spec JSON.

| AgentFlow | Agent Spec (via tsagentspec) |
|-----------|-----------|
| Workflow | `Flow` |
| Node (step) | `AgentNode` with synthesized `Agent` |
| Node (sub-workflow) | `FlowNode` |
| Conditional edges | `BranchingNode` + branched `ControlFlowEdge` |
| Unconditional edges | `ControlFlowEdge` (default "next" branch) |
| Data flow (`{{<< output}}`) | `DataFlowEdge` |
| Entry point | `StartNode` (synthesized) |
| Terminal nodes | `EndNode` (synthesized) |
| Capabilities | `Tool` subtypes (ServerTool, ClientTool, MCPTool, BuiltinTool) |
| Instructions | Part of Agent `system_prompt` |
| AGENTS.md identity | Agent `system_prompt` preamble |
| `{{placeholder}}` | Agent Spec `{{placeholder}}` inputs (same syntax) |
| Node outputs | `outputs` with JSON Schema properties |

Runtime frameworks (LangGraph, CrewAI, AutoGen, OpenAI Agents, WayFlow) are handled by Agent Spec's own adapters. We don't maintain those transforms.

### Secondary: IDE File Layouts

Thin server-side transforms. File rename + frontmatter adjustment.

| AgentFlow | Claude Code | Cursor | Windsurf | Kiro |
|-----------|------------|--------|----------|------|
| `AGENTS.md` | `CLAUDE.md` | `.cursor/rules/identity.mdc` | `AGENTS.md` | `.kiro/` specs |
| `instructions/*.md` | `.claude/rules/*.md` | `.cursor/rules/*.mdc` | nested `AGENTS.md` | `.kiro/` specs |
| `skills/*/` | `.claude/skills/*/` | `.cursor/rules/*.mdc` | `.windsurf/rules/` | — |
| `capabilities/*.md` | referenced in CLAUDE.md | referenced in rules | referenced in AGENTS.md | — |

Platform-specific hints via optional `platforms:` frontmatter field (opaque to parser, read by exporters).

### API Route

```
POST /api/export
  body: { files: { [path]: content }, format: 'agent-spec' | 'claude' | 'cursor' | 'windsurf' | 'kiro', workflowId?: string }
  returns: { files: { [path]: content } } or ZIP download
```

### What this replaces

- The entire `packages/core/src/transport/` directory (transforms.js, platform-configs.js, platform-adapter.js, etc.)
- Client-side export in `studio/lib/export-client.ts`
- The 7 custom platform configs

Replaced by:
- `packages/cli/src/export/agent-spec-transform.ts` — AgentFlow → tsagentspec objects
- `packages/cli/src/export/ide-transforms.ts` — thin IDE file layout transforms
- `tsagentspec` dependency for serialization

---

## 10. Skills — Internal Structure

Skills follow the Agent Skills spec. The parser understands the internal directory structure:

```
skills/
  security-review/
    SKILL.md              # required: frontmatter + instructions
    references/           # optional: supporting docs
      owasp-top-10.md
    scripts/              # optional: executable code
      scan.sh
    assets/               # optional: templates, data
      checklist.png
```

Parser output:
```javascript
skills['security-review'] = {
  name: 'security-review',
  description: 'Comprehensive security audit',
  primaryFile: { /* SKILL.md parsed */ },
  references: ['references/owasp-top-10.md'],
  scripts: ['scripts/scan.sh'],
  assets: ['assets/checklist.png'],
}
```

**Progressive disclosure:**
1. Discovery — parser loads only name + description from frontmatter
2. Activation — when referenced by a node, SKILL.md body loads into L3
3. Execution — references/ and scripts/ available on demand (not auto-loaded)

**Skills are NOT flattened into system_prompt at export.** Each platform exporter maps them appropriately:
- Claude Code → `.claude/skills/` (native format)
- Cursor → `.cursor/rules/` with description-based activation
- Agent Spec → context chunks + Tool components for scripts

**UI:** Skills appear as directories in the explorer. Users browse SKILL.md, references, scripts like any other files. No special UI needed.

---

## 11. narrativeTemplate

Universal frontmatter field available on any resource (instructions, capabilities, skills, memory):

```yaml
narrativeTemplate:
  prefix: "When reviewing, apply these criteria:"
  suffix: "Score each criterion pass/fail."
```

Used by the exporter when assembling prompts. The content gets wrapped:

```
When reviewing, apply these criteria:

[file content here]

Score each criterion pass/fail.
```

This replaces the V2 runbook pretext/postext pattern. Same functionality, available on all resource types.

---

## 12. Parser Architecture

### V3 flow:
```
parse ALL .md files (frontmatter + path)
  → classify each (frontmatter → dir convention → AGENTS.md → untyped)
  → group by scope (workspace / workflow / node)
  → build workflow graphs from node directories
  → infer routing from conditional edges
  → resolve refs in AGENTS.md files (L0/L1 auto-loading)
  → validate
```

### Key changes from V2:
- Parse first, classify second (not dir-first)
- No `runbooks` in taxonomy
- `skills` added with internal structure awareness
- Router inferred from edges, not declared
- AGENTS.md refs resolved for auto-loading
- `scope`/`inclusion` fields removed from instruction schema

---

## 13. Complete Workspace Structure

```
.agentflow/
  AGENTS.md                              ← L0: workspace identity (always loaded)
                                            refs inside are resolved

  instructions/                          ← workspace-scoped resources
    code-style.md                           loaded when referenced via {{instructions/code-style}}
    testing-strategy.md
    api-conventions.md

  capabilities/                          ← tool definitions
    write-file.md                           type: script, command: ...
    run-tests.md                            type: script, command: ...
    search-codebase.md                      type: mcp, mcp: ...

  skills/                                ← packaged expertise (workspace-only)
    security-review/
      SKILL.md
      references/
        owasp-top-10.md
      scripts/
        scan.sh

  memory/                                ← persistent state
    decisions.md
    preferences.md

  hooks/                                 ← event triggers
    lint-on-save.json

  build-feature/                         ← workflow
    AGENTS.md                            ← L1: workflow identity (loaded when active)
                                            can reference instructions for auto-loading

    instructions/                        ← workflow-scoped (shadows workspace if same name)
      requirements-format.md

    gather-requirements/                 ← node (step — default)
      SKILL.md                           ← L2: node contract
      interview-template.md              ← context file (loaded with node)

    review-gate/                         ← node (router — inferred from conditional edges)
      SKILL.md                              contains: {{-> create-design | approved}}
                                                      {{-> gather-requirements | needs work}}

    create-design/                       ← node (step)
      SKILL.md

    implement/                           ← node (step)
      SKILL.md
      helper-notes.md                    ← context file

    verify/                              ← node (step)
      SKILL.md

  content-pipeline/                      ← another workflow
    AGENTS.md
    ...
```

---

## 14. Config-Driven Architecture

AgentFlow is config-driven wherever possible. Adding a platform, resource category, validation rule, or theme = editing a config, not writing code.

### 14.1 Taxonomy Config

Single source of truth for resource categories. Parser, validator, canvas, explorer, and exporters all read from this.

```yaml
# configs/taxonomy.yaml
categories:
  instructions:
    label: Instruction
    pluralLabel: Instructions
    dir: instructions
    icon: book-open
    color: var(--category-instructions)
    scope: [workspace, workflow]
    fileFormat: single           # single .md file
    description: Rules, conventions, knowledge the agent follows

  capabilities:
    label: Capability
    pluralLabel: Capabilities
    dir: capabilities
    icon: wrench
    color: var(--category-capabilities)
    scope: [workspace, workflow]
    fileFormat: single
    subtypes: [builtin, script, mcp, package]
    description: Tool definitions

  skills:
    label: Skill
    pluralLabel: Skills
    dir: skills
    icon: sparkles
    color: var(--category-skills)
    scope: [workspace]           # workspace-only
    fileFormat: directory         # SKILL.md + references/ + scripts/ + assets/
    subdirs: [references, scripts, assets]
    description: Packaged expertise (Agent Skills spec)

  memory:
    label: Memory
    pluralLabel: Memory
    dir: memory
    icon: brain
    color: var(--category-memory)
    scope: [workspace, workflow]
    fileFormat: single
    writable: true               # agent can write during execution
    description: Persistent state across runs

  hooks:
    label: Hook
    pluralLabel: Hooks
    dir: hooks
    icon: zap
    color: var(--category-hooks)
    scope: [workspace, workflow]
    fileFormat: json              # JSON, not markdown
    description: Event triggers
```

### 14.2 Node Config

```yaml
# configs/nodes.yaml
types:
  step:
    label: Step
    icon: play-circle
    color: var(--node-step)
    isDefault: true              # no type declaration needed
    description: Agent executes instructions, produces output

  sub-workflow:
    label: Sub-workflow
    icon: git-branch
    color: var(--node-sub-workflow)
    requiredFields: [workflow]   # must declare which workflow to link
    description: Delegates to another workflow

inference:
  router:
    label: Router
    icon: git-merge
    color: var(--node-router)
    condition: hasConditionalEdges   # inferred, not declared
    description: Node with conditional edges (inferred)

identity:
  file: AGENTS.md
  type: agents
  levels:
    - name: workspace
      path: .agentflow/AGENTS.md
      layer: L0
      loading: always
    - name: workflow
      path: .agentflow/{workflow}/AGENTS.md
      layer: L1
      loading: when-workflow-active

primaryFile:
  convention: [SKILL.md, main.md]   # checked in order
  fallback: alphabetical
```

### 14.3 Validation Rules Config

```yaml
# configs/validation-rules.yaml
rules:
  broken_ref:
    severity: error
    message: "Reference {{ref}} does not resolve to any file"
    category: references

  orphan_node:
    severity: warning
    message: "Node {{node}} has no incoming or outgoing edges"
    category: structure

  missing_entry_point:
    severity: error
    message: "Workflow {{workflow}} has no entry point"
    category: structure

  cycle_detected:
    severity: error
    message: "Cycle detected: {{path}}"
    category: structure

  context_budget_exceeded:
    severity: warning
    message: "Node {{node}} context is {{actual}} tokens (budget: {{budget}})"
    category: context

  missing_identity:
    severity: warning
    message: "No AGENTS.md found at workspace root"
    category: identity

  missing_workflow_descriptor:
    severity: info
    message: "Workflow {{workflow}} has no AGENTS.md descriptor"
    category: identity

  unknown_category_dir:
    severity: info
    message: "Directory {{dir}} is not a recognized category"
    category: taxonomy

  empty_node:
    severity: warning
    message: "Node {{node}} has no content in its primary file"
    category: content

  missing_skill_description:
    severity: warning
    message: "Skill {{skill}} has no description (needed for progressive disclosure)"
    category: skills

  unresolved_data_flow:
    severity: error
    message: "Data flow {{ref}} references node {{node}} which doesn't exist"
    category: references

  sub_workflow_missing:
    severity: error
    message: "Sub-workflow node {{node}} references workflow {{workflow}} which doesn't exist"
    category: references
```

### 14.4 Export Platform Configs

Each platform is a config file. Adding a new platform = adding a new YAML file.

```yaml
# configs/platforms/claude-code.yaml
id: claude-code
name: Claude Code
website: https://claude.ai/code
agentsmd: true                    # supports AGENTS.md standard natively

paths:
  root: .claude
  identity: CLAUDE.md
  rules: .claude/rules/
  skills: .claude/skills/
  settings: .claude/settings.json

mapping:
  identity:
    target: CLAUDE.md
    transform: rename

  instructions:
    target: .claude/rules/{name}.md
    transform: copy

  skills:
    target: .claude/skills/{name}/
    transform: copy-dir

  capabilities:
    mcp:
      target: .claude/settings.json
      transform: merge-mcp-config
    non-mcp:
      embed: identity              # mentioned in CLAUDE.md

  memory:
    target: null                   # Claude manages its own

  hooks:
    target: null                   # not supported

mcp:
  configPath: .claude/settings.json
  format: claude-settings
  schema:
    mcpServers:
      "{name}":
        command: "{command}"
        args: "{args}"
        env: "{env}"
```

```yaml
# configs/platforms/cursor.yaml
id: cursor
name: Cursor
website: https://cursor.com

paths:
  root: .cursor
  rules: .cursor/rules/
  mcp: .cursor/mcp.json

mapping:
  identity:
    target: .cursor/rules/identity.mdc
    transform: to-mdc

  instructions:
    target: .cursor/rules/{name}.mdc
    transform: to-mdc
    frontmatter:
      description: "from:instructions.description"
      globs: "from:instructions.platforms.cursor.globs"
      alwaysApply: "from:instructions.platforms.cursor.alwaysApply"

  skills:
    target: .cursor/rules/{name}.mdc
    transform: flatten-skill-to-mdc

  capabilities:
    mcp:
      target: .cursor/mcp.json
      transform: merge-mcp-config
    non-mcp:
      embed: rules

  memory:
    target: null

  hooks:
    target: null

mcp:
  configPath: .cursor/mcp.json
  format: mcp-standard
  schema:
    mcpServers:
      "{name}":
        command: "{command}"
        args: "{args}"
```

```yaml
# configs/platforms/agent-spec.yaml
id: agent-spec
name: Open Agent Spec
website: https://openagentspec.dev
version: "26.1.0"
serializer: tsagentspec

mapping:
  identity:
    transform: to-agent-system-prompt

  instructions:
    transform: to-system-prompt-chunk

  skills:
    transform: to-agent-specialization

  capabilities:
    builtin:
      transform: to-builtin-tool
    script:
      transform: to-server-tool
    mcp:
      transform: to-mcp-tool-and-toolbox
    package:
      transform: to-client-tool

  nodes:
    step:
      transform: to-agent-node
    sub-workflow:
      transform: to-flow-node

  edges:
    unconditional:
      transform: to-control-flow-edge
    conditional:
      transform: to-branching-node

  memory:
    transform: null

  hooks:
    transform: null

mcp:
  format: agent-spec-mcp
  components: [MCPTool, MCPToolBox, StdioTransport, SSETransport, StreamableHTTPTransport]
```

Additional platform configs follow the same pattern for: Windsurf, Copilot, Aider, OpenCode, OpenClaw, Antigravity, Gemini CLI, Qwen Code, Kimi Code, Kiro.

### 14.5 Canvas Config

```yaml
# configs/canvas.yaml
nodeTypes:
  step:
    color: var(--node-step)
    shape: rounded-rect
    icon: play-circle

  sub-workflow:
    color: var(--node-sub-workflow)
    shape: rounded-rect
    icon: git-branch

  router:                          # inferred type, visual only
    color: var(--node-router)
    shape: hexagon
    icon: git-merge

edgeTypes:
  default:
    color: var(--primary)
    style: solid
    animated: false

  conditional-in:
    color: var(--warning)
    style: dashed
    animated: false

  conditional-out:
    color: var(--warning)
    style: solid
    animated: false

  data-flow:
    color: var(--success)
    style: dotted
    animated: true

conditionGate:
  color: var(--warning)
  shape: diamond
  compact: true

minimap:
  enabled: true
  collapsible: true
```

### 14.6 What Stays as Code

These are NOT config-driven — they're core logic:

- **Parser** — classification chain, scope resolution, graph building, ref extraction
- **Ref syntax** — `{{}}` regex patterns (changing them breaks everything)
- **Export transforms** — the transform *functions* (copy, to-mdc, to-agent-node, etc.)
- **Export engine** — the orchestrator that reads configs and applies transforms
- **Selective context assembly** — L0-L4 layer resolution
- **tsagentspec integration** — Agent Spec serialization

The boundary: **configs define WHAT to do, code defines HOW to do it.**

---

## 15. Decisions Log

| Decision | Answer | Rationale |
|----------|--------|-----------|
| Node types | `step` (default), `sub-workflow` (explicit). Router inferred. | Exporters already infer routing from edges. Less concepts to learn. |
| Interaction type | No. It's just a step. | Content determines behavior, not structural type. |
| Resource categories | instructions, capabilities, skills, memory, hooks | runbooks split: conditions → edge syntax, interactions → steps |
| Filename constraints | None. SKILL.md is convention. | Any .md with right frontmatter works. |
| Type resolution | Frontmatter first, dir convention second | Industry standard (Claude Code, Windsurf pattern) |
| Scope resolution | Position in tree. No frontmatter fields. | Eliminates scope/inclusion complexity. Tree IS the scoping model. |
| Global/auto-loading | Refs in AGENTS.md are resolved | Replaces scope:global + inclusion:auto with a single mechanism |
| Ref resolution | Nearest scope wins (workflow → workspace) | Like variable scoping in every programming language |
| Skills scoping | Workspace-only | External packages don't belong to specific workflows |
| Skills at export | NOT flattened into system_prompt. Per-platform mapping. | Respects progressive disclosure pattern |
| narrativeTemplate | Universal field on any resource | Replaces runbook-specific pretext/postext |
| Export primary | Agent Spec JSON (fully compliant via `tsagentspec`) | One exporter. Runtime frameworks handled by Agent Spec adapters. |
| Export secondary | IDE file layouts (config-driven server-side transforms) | Adding a platform = adding a YAML config. |
| Export location | All server-side (`/api/export` route) | `tsagentspec` is Node-only. Less client code. Easier to add platforms. |
| Export dependency | Vendor `tsagentspec` into `packages/cli` | Guarantees Agent Spec schema compliance. Apache 2.0 licensed. |
| Export platforms | 12 platforms: Claude, Cursor, Windsurf, Copilot, Aider, OpenCode, OpenClaw, Antigravity, Gemini CLI, Qwen, Kimi, Kiro + Agent Spec | Based on Agency Agents mapping (85K stars) + Kiro. |
| Agent Spec compliance | Export-layer compliant. Authoring stays markdown-native. | AgentFlow is an authoring tool, not a runtime. |
| Config-driven | Taxonomy, schemas, validation rules, platform exports, canvas rendering | Adding features = adding config. Code handles HOW, config handles WHAT. |
| MCP export | Per-platform MCP config generation from capabilities | Each platform config declares its MCP format and path. |
| Backward compat | None needed. Pre-launch stealth. | Clean slate. |

---

*This document is the approved design. Ready for implementation.*
