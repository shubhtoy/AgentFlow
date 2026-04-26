# AgentFlow — Architecture Guide

A complete conceptual reference for anyone authoring agent workflows in AgentFlow. This document covers the philosophy, the format the parser understands, every frontmatter schema, every reference type, every resource category, and the context model that ties it all together.

No code. No UI. Just the system as the parser sees it.

---

## Contents

- [Philosophy](#philosophy)
- [The Core Idea](#the-core-idea)
- [Directory Layout](#directory-layout)
- [The Five-Layer Context Model](#the-five-layer-context-model)
- [Reference Syntax — The Complete Language](#reference-syntax--the-complete-language)
- [Frontmatter — Every Schema](#frontmatter--every-schema)
- [Resource Types](#resource-types)
- [Workflow Graph Model](#workflow-graph-model)
- [Node Anatomy](#node-anatomy)
- [Context Budgets](#context-budgets)
- [Graph Design Patterns](#graph-design-patterns)
- [MCP Integration](#mcp-integration)
- [The Library](#the-library)
- [Validation Rules](#validation-rules)
- [Consumption Model — What Executor Agents Must Do](#consumption-model--what-executor-agents-must-do)
- [Complete Worked Example](#complete-worked-example)
- [Authoring Checklist](#authoring-checklist)

---

## Philosophy

AgentFlow is built on five principles. Every design decision traces back to one of them.

### 1. Directory is architecture

The folder layout *is* the workflow structure. There is no build step, no compilation, no config file that maps names to paths. `ls` shows the architecture. `cat` shows the content. Git tracks the history.

A directory inside a workflow is a node. A file inside `tools/` is a tool. The parser infers structure from where files live. You never need to declare "this directory is a workflow" — the parser figures it out from the presence of subdirectories containing `.md` files.

### 2. Context is a scarce resource

LLMs have finite context windows. Every token loaded is a token the model cannot use for reasoning. AgentFlow treats context like memory in a constrained system — every piece has a cost (tokens), a scope (which stages need it), and a lifetime (when to load, when to discard).

The format encodes all of this in the file structure itself. Identity is always loaded. The current node's instructions swap per stage. Shared resources resolve on demand. Runtime artifacts are never loaded.

### 3. Progressive strictness

Frontmatter is optional. Any `.md` file dropped into the right directory works immediately. The parser infers types from directory names. Validation is permissive by default.

The gradient runs from zero ceremony to full specification:
- Drop a file in `tools/` — it is a tool, no frontmatter needed
- Add `type: mcp` frontmatter — the parser knows it connects to an MCP server
- Add `parameters:` — the parser can generate tool schemas
- Add `context: { max_tokens: 3000 }` — the runtime can enforce budgets

The format never forces ceremony on simple cases.

### 4. Platform agnostic

AgentFlow workspaces are consumed by any AI system — a custom orchestrator, Kiro, Claude Code, Cursor, GPT, or a shell script that concatenates files into a prompt. The format is markdown files in directories. The consuming agent decides how to interpret them.

### 5. Refs encode intent

The `{{ref}}` syntax is not just a link. The prefix tells the parser (and the executor) what the author *means*:
- "Load this resource as context"
- "Transition to this node"
- "Transition to this node if a condition is met"
- "Read the output from a previous stage"

The markdown is simultaneously human-readable documentation and machine-parseable workflow definition.

---

## The Core Idea

An AgentFlow workspace is a `.agentflow/` directory containing markdown files organized into a specific structure. The parser reads this directory and produces a typed graph — nodes, edges, tools, skills, templates, interactions, and memory — that any executor can walk.

```
.agentflow/
├── AGENTS.md                    ← Identity + workflow discovery
├── tools/                       ← What the agent can do
├── skills/                      ← Reusable instruction modules
├── templates/                   ← Condition definitions for routing
├── interactions/                ← Human touchpoints
├── memory/                      ← Persistent state across sessions
├── mcp.json                     ← MCP server configuration (optional)
└── build-feature/               ← A workflow
    ├── AGENTS.md                ← Workflow descriptor
    ├── gather-requirements/     ← A node (stage)
    │   ├── SKILL.md             ← Primary file — instructions + refs
    │   └── requirements-template.md  ← Context file — loaded alongside
    ├── create-design/
    │   └── SKILL.md
    ├── review-gate/
    │   └── SKILL.md
    └── implement-task/
        ├── SKILL.md
        └── output/              ← Runtime artifacts (never loaded as context)
```

The parser understands three things:
1. **Directory structure** — where files live determines what they are
2. **YAML frontmatter** — optional typed metadata at the top of `.md` files
3. **Reference syntax** — `{{ref}}` tokens embedded in markdown content

Everything else is prose that gets passed through to the executor as-is.

---

## Directory Layout

### Reserved directories

These top-level directory names have special meaning. The parser uses them for type inference:

| Directory | Resource type | Purpose |
|-----------|--------------|---------|
| `tools/` | tool | Declares what the agent can do — read files, run tests, call APIs |
| `skills/` | skill | Reusable instruction modules — how to do requirements, design, debugging |
| `templates/` | template | Condition definitions used in routing decisions |
| `interactions/` | interaction | Human touchpoints — approval gates, questions, feedback |
| `memory/` | memory | Persistent state that survives across sessions |

A `.md` file placed in `tools/` is automatically classified as a tool, even without frontmatter. The directory name *is* the type declaration.

### Workflow directories

Any top-level directory that is *not* reserved and contains subdirectories with `.md` files is treated as a workflow. The subdirectories are nodes (stages).

```
build-feature/          ← workflow (not a reserved name, has subdirs with .md)
  gather-requirements/  ← node
  create-design/        ← node
  implement-task/       ← node
```

### Artifact directories

Directories named `output/` inside node directories hold runtime artifacts. These are *never* loaded as context — they exist for the agent to write results into, not to read from.

### The root AGENTS.md

Every workspace has a root `AGENTS.md` at `.agentflow/AGENTS.md`. This is the entry point — the first thing any executor reads. It declares the agent's identity, lists available workflows, and references global resources.

### Workflow AGENTS.md

Each workflow directory can have its own `AGENTS.md` that describes the workflow — its purpose, its nodes, and the edges between them. This is the routing map.

---

## The Five-Layer Context Model

AgentFlow organizes context into five layers. The model is inspired by CPU cache hierarchies — always-resident kernel, per-process working set, demand-paged libraries, and disk-backed storage.

| Layer | Name | What | Where | Budget | Lifetime |
|-------|------|------|-------|--------|----------|
| 0 | Identity | Who the agent is | Root `AGENTS.md` | ~200 tokens | Always loaded |
| 1 | Routing | Which stage is active, what nodes exist | Workflow `AGENTS.md` | ~500–800 tokens | Always loaded |
| 2 | Contract | What this stage does — instructions, refs | Node `SKILL.md` | 2k–8k tokens | Current stage only |
| 3 | References | Shared knowledge — tools, skills, memory | Reserved directories | On demand | Resolved per ref |
| 4 | Artifacts | Runtime output | `node/output/` | Never loaded | Written, not read |

### The constraint

Layer 0 + Layer 1 + one active Layer 2 + its resolved Layer 3 references should fit in roughly **5k–8k tokens**. If it does not, the node is too complex and should be split.

### Why layers matter

Without layers, there are two failure modes:
- **Context overload**: load everything and the model drowns in irrelevant instructions
- **Context starvation**: load too little and the model hallucinates or goes off-track

Layers make context loading deterministic. Layers 0 and 1 are always present at low cost. Layer 2 swaps per stage. Layer 3 resolves on demand. Layer 4 is never loaded.

### The analogy

| Layer | CPU cache equivalent |
|-------|---------------------|
| 0 — Identity | L1 cache — always hot, tiny, fastest access |
| 1 — Routing | L1/L2 — the dispatch table |
| 2 — Contract | L2 — the working set, swaps per process |
| 3 — References | L3 — shared across cores, loaded on demand |
| 4 — Artifacts | Disk — cold storage, never in active memory |

---

## Reference Syntax — The Complete Language

The parser recognizes exactly four reference patterns. They are applied in this order to avoid partial matches (conditional edges are checked before plain edges).

### 1. Mention — `{{category/name}}`

```
{{capabilities/read-code}}
{{instructions/requirements-elicitation}}
{{memory/decisions}}
{{skills/review-design}}
```

**What it means:** "Load this resource as context for the current node."

**How the parser handles it:** Extracts `category` and `name`. Resolves to a file: first by path (`category/name.md`), then by frontmatter `name` field as fallback. The resolved content becomes part of the node's Layer 3 context.

**Special case — capabilities:** When the category is `capabilities`, the resource is not loaded as text context. Instead, it is wired as a callable tool that the agent can invoke. The capability's frontmatter defines its parameters and execution type.

### 2. Edge — `{{-> target}}`

```
{{-> nodes/create-design}}
{{-> nodes/review-requirements-gate}}
```

**What it means:** "After this node completes, transition to this target node."

**How the parser handles it:** Creates a directed edge in the workflow graph from the current node to the target. The `nodes/` prefix is conventional but not required — the parser resolves the target by path or name.

### 3. Conditional edge — `{{-> target | templates/condition}}`

```
{{-> nodes/plan-tasks | templates/design-approved}}
{{-> nodes/create-design | templates/design-rejected}}
```

**What it means:** "Transition to this target node IF the condition is met."

**How the parser handles it:** Creates a conditional edge. The condition references a template file whose `check` field describes when this edge should be taken. At runtime, the executor evaluates which condition is satisfied and follows the corresponding edge.

**The pipe `|` is the separator.** Whitespace around it is ignored.

### 4. Data flow — `{{<< output.nodeName}}`

```
{{<< output.gather-requirements}}
{{<< output.create-design}}
```

**What it means:** "Read the output produced by a previous node."

**How the parser handles it:** Creates a data dependency. At runtime, the executor injects the stored output from the named node into the current node's context. This is how information flows forward through the workflow — requirements feed into design, design feeds into task planning.

### Resolution rules

References resolve in two steps:

1. **Path match (primary):** `{{capabilities/read-code}}` looks for `capabilities/read-code.md`
2. **Name match (fallback):** If no file matches the path, search all files for a frontmatter `name` field matching `read-code`

Path-first resolution is deterministic and fast. Name-based fallback handles cases where files are renamed or reorganized.

### Where refs can appear

References work in any markdown context — paragraphs, lists, headings, code blocks (though code blocks are unusual). The parser scans the entire content of every `.md` file for ref patterns.

---

## Frontmatter — Every Schema

Frontmatter is optional YAML metadata at the top of any `.md` file, delimited by `---`. The parser uses [gray-matter](https://github.com/jonschlinkert/gray-matter) to extract it.

Every field is optional unless marked required. A file with no frontmatter is valid — the parser infers what it can from the directory structure.

### AGENTS.md (root or workflow descriptor)

```yaml
---
type: agents              # literal "agents" — identifies this as a descriptor
name: my-workspace        # workspace or workflow name
description: One-sentence purpose
identity:                 # agent identity (root AGENTS.md only)
  name: Senior Engineer
  role: Full-stack developer
  personality: Methodical, thorough
  constraints:
    - Never skip tests
    - Always check diagnostics after edits
---
```

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `type` | string | Yes (literal `"agents"`) | Identifies this file as a descriptor |
| `name` | string | No | Workspace or workflow name |
| `description` | string | No | One-sentence purpose |
| `identity` | object | No | Agent identity (root level only) |
| `identity.name` | string | No | Agent persona name |
| `identity.role` | string | No | What the agent does |
| `identity.personality` | string | No | Behavioral traits |
| `identity.constraints` | string[] | No | Hard rules the agent must follow |

### Node (SKILL.md — step, router, or sub-workflow)

```yaml
---
name: gather-requirements
type: step                # step | router | sub-workflow
description: Understand the feature request and produce requirements
entry: true               # marks this as the workflow entry point
primary: true             # marks this as the primary file in the node directory
agent: requirements-analyst  # optional persona for this stage
model: claude-sonnet      # preferred LLM model
context:
  max_tokens: 3000        # token budget for this node
  inputs:                 # explicit ref declarations with scope
    - ref: skills/requirements-elicitation
      scope: full         # full | summary | signature
    - ref: tools/read-code
      scope: signature
    - ref: memory/user
      scope: full
  exclude:                # refs that should NOT be loaded at this node
    - skills/technical-design
    - skills/task-decomposition
outputs:
  - name: requirements-doc
    format: markdown
    description: Structured requirements with acceptance criteria
---
```

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `name` | string | No | Node identifier |
| `type` | string | No | `step`, `router`, or `sub-workflow` |
| `description` | string | No | What this node does |
| `entry` | boolean | No | `true` marks this as the workflow entry point |
| `primary` | boolean | No | `true` marks this as the primary file in a multi-file node |
| `agent` | string | No | Persona name for this stage |
| `model` | string | No | Preferred LLM model |
| `context` | object | No | Context budget and input declarations |
| `context.max_tokens` | integer | No | Token budget for this node |
| `context.inputs` | array | No | Explicit ref declarations with scope |
| `context.inputs[].ref` | string | Yes (within inputs) | Reference path (e.g., `skills/requirements-elicitation`) |
| `context.inputs[].scope` | string | No | `full`, `summary`, or `signature` |
| `context.exclude` | string[] | No | Refs that should NOT be loaded at this node |
| `outputs` | array | No | What this node produces |
| `outputs[].name` | string | Yes (within outputs) | Output identifier |
| `outputs[].format` | string | No | Output format (markdown, json, diff, etc.) |
| `outputs[].description` | string | No | What this output contains |

#### Node types

**step** — The workhorse. Receives context, uses tools, produces output. Most nodes are steps.

**router** — Lightweight decision point. Evaluates conditions and routes to the next node. Routers should have zero tools and zero skills — if your router needs tools, it is a step.

**sub-workflow** — Delegates to another workflow. The parser recursively parses the referenced workflow and treats it as a nested graph.

#### Primary file selection

When a node directory contains multiple `.md` files, the parser selects the primary file by priority:
1. `primary: true` in frontmatter
2. Filename `main.md`
3. Alphabetically first `.md` file

All other `.md` files in the directory are context files — loaded alongside the primary as additional context.

### Tool

```yaml
---
name: read-code
type: builtin             # builtin | script | mcp
builtin_mapping: readCode # maps to a builtin executor function
description: Read and analyze source code files
parameters:
  path:
    type: string
    description: File or directory path to read
    required: true
  symbol:
    type: string
    description: Optional symbol name to search for
    required: false
outputs:
  - source_code
  - file_structure
---
```

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `name` | string | Yes | Tool identifier |
| `type` | string | No | `builtin`, `script`, or `mcp` |
| `builtin_mapping` | string | When type=builtin | Maps to a builtin executor function |
| `command` | string | When type=script | Shell command to execute |
| `mcp` | string | When type=mcp | MCP server name (from mcp.json) |
| `package` | string | When type=package | Package identifier |
| `description` | string | No | What this tool does |
| `parameters` | object | No | Parameter definitions |
| `parameters.<name>.type` | string | No | `string`, `array`, `integer`, `boolean` |
| `parameters.<name>.description` | string | No | Parameter description |
| `parameters.<name>.required` | boolean | No | Whether the parameter is required |
| `outputs` | string[] | No | What this tool returns |

#### Tool types explained

**builtin** — Maps to a capability the executor agent already has. The `builtin_mapping` field tells the executor which internal function to use. Common builtins: `readCode`, `fsWrite`, `getDiagnostics`, `webSearch`.

**script** — Runs a shell command. The `command` field specifies what to execute. The executor runs it in the project's working directory and returns stdout/stderr.

**mcp** — Connects to an MCP (Model Context Protocol) server. The `mcp` field names the server (configured in `mcp.json`). Parameters are forwarded to the server's tool call.

### Skill

```yaml
---
name: requirements-elicitation
domain: product-engineering
description: Systematic approach to gathering and structuring requirements
tags:
  - requirements
  - user-stories
  - acceptance-criteria
max_tokens: 800
---
```

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `name` | string | No | Skill identifier |
| `description` | string | No | What this skill teaches |
| `domain` | string | No | Knowledge domain |
| `tags` | string[] | No | Searchable tags |
| `max_tokens` | integer | No | Estimated token cost |

Skills are reusable instruction modules. They should be self-contained — a skill should make sense without knowing which node references it. The body contains process steps, anti-patterns, output format guidance, and domain knowledge.

### Template (Condition)

```yaml
---
name: design-approved
type: condition
check: The user has reviewed the technical design and explicitly approved it with no outstanding concerns
---
```

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `name` | string | Yes | Template identifier |
| `type` | string | No | Usually `condition` |
| `check` | string | Yes | The condition to evaluate — must be unambiguous |

Templates define routing conditions. The `check` field is what the executor evaluates to decide which edge to follow at a router node. Write it as a clear, evaluable statement — not vague, not compound.

Good: `"The user has explicitly approved the design with no outstanding concerns"`
Bad: `"The design seems okay"`

### Interaction

```yaml
---
name: review-design
type: approval
timeout: 300
---
```

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `name` | string | Yes | Interaction identifier |
| `type` | string | Yes | `approval`, `freeform`, `choice`, or `confirm` |
| `timeout` | integer | No | Timeout in seconds |

Interactions are human touchpoints. The body describes what to present to the user and what options they have. Interaction types:

- **approval** — Present work for review. User can approve, reject, or edit.
- **freeform** — Ask an open-ended question. User provides free text.
- **choice** — Present 2-4 options. User picks one.
- **confirm** — Yes/no checkpoint before proceeding.

### Memory

```yaml
---
name: decisions
editable: true
description: Important decisions and their reasoning
---
```

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `name` | string | No | Memory identifier |
| `description` | string | No | What this memory stores |
| `editable` | boolean | No | Whether the agent can write to this file |

Memory files are append-friendly persistent state. The agent reads them at session start and writes to them during work. Entries should be date-prefixed (`[YYYY-MM-DD]`). Never store secrets.

Common memory files:
- `user.md` — User preferences, conventions, working style
- `decisions.md` — Choices made and their reasoning
- `lessons.md` — Mistakes and what was learned
- `facts.md` — Domain knowledge accumulated over time
- `MEMORY.md` — Instructions for how to use the memory system (read once)

---

## Resource Types

The parser classifies every `.md` file in the workspace. Classification priority:

1. **Frontmatter type** — `type: tool`, `type: skill`, `type: step`, etc.
2. **Directory inference** — files in `tools/` are tools, files in `skills/` are skills
3. **Node type aliases** — frontmatter values `step`, `router`, `sub-workflow` map to the `node` resource type
4. **Untyped** — files outside reserved directories with no type frontmatter

| Resource type | Frontmatter `type` values | Directory inference |
|--------------|--------------------------|-------------------|
| tool | `builtin`, `script`, `mcp`, `package` | `tools/` |
| skill | `skill` | `skills/` |
| template | `condition`, `template` | `templates/` |
| interaction | `approval`, `freeform`, `choice`, `confirm` | `interactions/` |
| memory | `memory` | `memory/` |
| node | `step`, `router`, `sub-workflow` | Subdirectories of workflow directories |
| agents | `agents` | `AGENTS.md` files |

---

## Workflow Graph Model

An AgentFlow workflow is a directed graph. Nodes are stages. Edges are transitions, optionally conditional. The graph is extracted from the markdown by the parser — edge references become edges, conditional edge references become conditional edges, data flow references become data dependencies.

### Entry points

A node is an entry point if:
1. Its frontmatter has `entry: true`, OR
2. It has no incoming edges (the parser infers it)

A workflow must have at least one entry point.

### Cycles are valid

The parser does not require the graph to be acyclic. Loops are valid and expected:
- Review gates loop back to the previous step on rejection
- Implementation loops iterate until all tasks are complete
- Retry loops re-attempt failed operations

The executor detects infinite loops by counting visits per node (typically capping at 3 visits to the same node).

### Edge types

| Edge type | Syntax | Meaning |
|-----------|--------|---------|
| Unconditional | `{{-> target}}` | Always follow this edge |
| Conditional | `{{-> target \| templates/condition}}` | Follow only if condition is met |

When a node has multiple outgoing edges, the executor evaluates conditions to decide which to follow. If only one edge exists and it is unconditional, the executor follows it automatically.

### Visual representation

```
  gather-req ←───rejected─── review-req-gate
                                  │ approved
  create-design ←──rejected── review-design-gate
                                      │ approved
  plan-tasks ←─────rejected── review-tasks-gate
                                   │ approved
                ┌──────── implement-task ◄──┐
                ▼                           │
          task-gate ──more/failed──────────┘
                │ all-done
          verify-feature
```

---

## Node Anatomy

A node is a directory containing at least one `.md` file. The primary file (usually `SKILL.md`) is the node's contract — it tells the executor what to do at this stage.

A well-structured node primary file has four sections, in order:

### 1. Frontmatter

The YAML metadata block. Declares the node's type, agent persona, context budget, inputs, outputs, and exclusions.

### 2. Context Budget

Immediately after the title. Lists every reference, its estimated token cost, and when to resolve it.

```markdown
## Context Budget

This node costs ~3000 tokens fully loaded. References:
- {{instructions/requirements-elicitation}} (~800 tokens, resolve now — core instruction)
- {{capabilities/source-agent}} (~300 tokens, resolve now — needed for exploration)
- {{capabilities/read-code}} (~100 tokens, resolve on first use)
- {{memory/user}} (~50 tokens, resolve at start)

**Do not resolve** {{instructions/technical-design}} — belongs to a later node.
```

This section serves two purposes:
- It tells the executor what to load and when
- It documents the token budget for the author (and for validation)

### 3. Instructions

Step-by-step work. Reference tools and skills inline where they are used.

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

The data flow ref (`{{<< output.gather-requirements}}`) at the end declares that this node's output should be stored and available to future nodes that reference it.

---

## Context Budgets

Every node should declare its context budget. This is not enforced by the parser (it is metadata), but it is critical for keeping workflows within LLM context limits.

### How to estimate

A rough heuristic: **1 token ≈ 4 characters** of English text. For code and structured text, it is closer to **1 token ≈ 3 characters**.

### Budget guidelines

| Component | Typical budget |
|-----------|---------------|
| Root AGENTS.md (Layer 0) | ~200 tokens |
| Workflow AGENTS.md (Layer 1) | ~500–800 tokens |
| Node SKILL.md (Layer 2) | ~1000–3000 tokens |
| Each resolved skill | ~300–800 tokens |
| Each resolved tool (as context) | ~100–300 tokens |
| Each memory file | ~50–500 tokens |
| **Total per active step** | **~5000–8000 tokens** |

### When to split a node

If a node's total budget (its own content + all resolved refs) exceeds ~8000 tokens, split it. Common splits:
- Separate "explore" from "write" into two steps
- Move complex logic into a skill (loaded on demand, not always)
- Break a multi-phase step into sequential steps with a router between them

### Resolve timing

Each ref in the context budget section should declare when it is resolved:

| Timing | Meaning |
|--------|---------|
| resolve now | Load immediately when the node activates |
| resolve on use | Load only when the agent first references it |
| resolve on write | Load only when the agent needs to write to it |
| resolve at start | Load at the beginning of the session |
| do not resolve | Explicitly excluded — belongs to another node |

---

## Graph Design Patterns

### Pattern 1: Linear flow

The simplest workflow. Stages execute in sequence.

```
requirements → design → tasks → implement → verify
```

Use when: every stage depends on the previous one, no branching needed.

### Pattern 2: Review gates

Insert router nodes between phases. The user reviews output and approves or rejects.

```
requirements → review-req-gate → design → review-design-gate → tasks
```

Review gates are routers with two outgoing conditional edges:
- Approved → next phase
- Rejected → loop back to revise

### Pattern 3: Rejection loops

When the user rejects, the workflow loops back to the producing node with feedback.

```
review-req-gate:
  approved → design
  rejected → requirements (revise based on feedback)
```

The rejection edge carries the user's feedback as context. The producing node re-executes with the original output plus the feedback.

### Pattern 4: Iteration loops

A node executes repeatedly until a termination condition is met.

```
implement-task → task-gate:
  failed    → implement-task (retry with diagnostics)
  more-left → implement-task (next task)
  all-done  → verify-feature
```

The task-completion-gate router checks the task list and routes accordingly. This is the most common pattern for implementation phases.

### Pattern 5: Checkpoint gates

Insert `confirm`-type interactions at major milestones. The user can pause, review progress, and decide whether to continue.

```
implement-task → checkpoint → task-gate
```

### Combining patterns

Real workflows combine all of these. The `build-feature` example uses:
- Linear flow for the overall sequence
- Review gates between every phase
- Rejection loops on every gate
- Iteration loops for implementation
- Checkpoints after major milestones

---

## MCP Integration

The [Model Context Protocol](https://modelcontextprotocol.io) (MCP) is the standard for connecting AI agents to external tools and services. AgentFlow integrates MCP through two mechanisms.

### Tool declarations

Tool `.md` files in `tools/` can declare MCP tools with `type: mcp` frontmatter:

```yaml
---
name: source-agent
type: mcp
mcp: source-agent-server
description: Semantic code search and architectural understanding
parameters:
  query:
    type: string
    description: Natural language query about the codebase
    required: true
  scope:
    type: string
    description: Limit search to a directory or file pattern
    required: false
---
```

The `mcp` field names the server (must match a key in `mcp.json`). Parameters are forwarded to the server's tool call.

### Server configuration

`.agentflow/mcp.json` declares which MCP servers the workspace needs. The format follows the de facto standard used by Claude Desktop, Cursor, VS Code, and Kiro:

```json
{
  "mcpServers": {
    "source-agent-server": {
      "command": "uvx",
      "args": ["source-agent-mcp@latest"],
      "env": {
        "GITHUB_TOKEN": "${env:GITHUB_TOKEN}"
      },
      "required": true,
      "description": "Semantic code search"
    }
  }
}
```

| Field | Standard | Purpose |
|-------|----------|---------|
| `command` | Yes | Executable to run (stdio transport) |
| `args` | Yes | Command arguments |
| `env` | Yes | Environment variables (`${env:VAR}` tokens resolved at connection time) |
| `url` | Yes | HTTP/SSE endpoint (alternative to command) |
| `required` | AgentFlow extension | If `true`, workflow fails if server is unavailable |
| `description` | AgentFlow extension | Human-readable description |
| `registryName` | AgentFlow extension | Name in the MCP registry |
| `version` | AgentFlow extension | Server version |
| `discoveredTools` | AgentFlow extension | Tools discovered via `tools/list` |

The `required` field is the key extension. Required servers that fail to start cause the workflow to abort. Optional servers that fail produce a warning — their tools return errors if called.

### Environment variable tokens

The `${env:VARIABLE_NAME}` syntax in `env` fields is preserved as a literal string during load/save. It is only resolved at connection time from `process.env`. This means secrets never appear in the config file.

---

## The Library

AgentFlow includes a curated library of reusable components. The library lives in the `library/` directory with a `registry.json` index.

### What the library contains

| Category | Count | Examples |
|----------|-------|---------|
| Workflows | 5 | code-review, data-analysis, deploy, onboarding, sales-outreach |
| Skills | 20 | requirements-elicitation, technical-design, systematic-debugging, security-review |
| Tools | 23 | read-code, write-file, run-tests, web-search, git-history, query-database |
| Templates | 17 | is-approved, is-rejected, tests-pass, tests-fail, confidence-high, retry-limit-reached |
| Interactions | 9 | approve, ask-user, escalate, present-options, confirm-deploy, show-diff |
| Memory | 4 | decisions, lessons-learned, user-preferences, project-context |

### How to use library items

Copy items from the library into your `.agentflow/` workspace. The CLI provides a shortcut:

```bash
agentflow add skill systematic-debugging
agentflow add tool run-tests
agentflow add template is-approved
```

Library items are templates — customize them for your project after copying.

---

## Validation Rules

The parser and validator check the following. Validation is permissive by default — most issues are warnings. Strict mode promotes them to errors.

### Always errors (even in permissive mode)

- Broken refs — a `{{ref}}` that does not resolve to any file
- Missing required frontmatter fields (e.g., `name` on templates, `check` on conditions)
- Invalid frontmatter field types (e.g., string where integer expected)

### Warnings (errors in strict mode)

- Schema violations — frontmatter fields that don't match the expected schema
- Cycles in the workflow graph (informational — cycles are valid but noted)
- Unreachable nodes — nodes with no incoming edges and not marked as entry points
- Unknown category prefixes in refs
- Context budget exceeded (declared `max_tokens` vs. estimated actual)
- Output declarations without corresponding `output/` directories
- MCP server references that don't match any entry in `mcp.json`
- Variable tokens that don't follow the `${env:VARIABLE_NAME}` format

### What the validator checks

| Check | Scope | Default severity |
|-------|-------|-----------------|
| Ref resolution | All refs in all files | Error |
| Frontmatter schema | All typed resources | Warning |
| Cycle detection | Workflow graphs | Warning (informational) |
| Unreachable nodes | Workflow graphs | Warning |
| Entry point existence | Each workflow | Error |
| Context budget | Nodes with `max_tokens` | Warning |
| Output declarations | Nodes with `outputs` | Warning |
| Identity structure | Root AGENTS.md | Warning |
| MCP server refs | Tool files with `type: mcp` | Warning |
| Variable format | `env` fields in mcp.json | Warning |

---

## Consumption Model — What Executor Agents Must Do

Any system that executes an AgentFlow workflow — whether it is a custom orchestrator, an LLM reading files directly, or an IDE integration — must handle these responsibilities.

### Level 1: Read-only consumption (any agent)

The simplest consumption model. The agent reads the `.agentflow/` markdown as context and follows the instructions. No graph walking, no tool wiring.

1. Read `.agentflow/AGENTS.md` for identity, constraints, and workflow list
2. Read the workflow's `AGENTS.md` for node summaries and edges
3. Read the current node's `SKILL.md` for instructions
4. Resolve `{{instructions/...}}` and `{{memory/...}}` references as additional context
5. Interpret `{{capabilities/...}}` references as capabilities the agent should use
6. Do the work described in the instructions
7. Follow `{{-> ...}}` edge references to determine what comes next

This works today with zero integration. Any LLM can read the markdown and produce useful output.

### Level 2: Graph-walking execution (orchestrator)

The full execution model. An orchestrator walks the graph node by node, managing context, tools, and state.

**Initialization:**
1. Parse the `.agentflow/` directory into a typed graph
2. Read `mcp.json` and connect to MCP servers
3. Register builtin tools and script tools
4. Identify the workflow entry point

**Per-node execution loop:**
1. Load Layer 0 (identity) + Layer 1 (routing) as the system prompt base
2. Load Layer 2 (current node's SKILL.md content)
3. Resolve Layer 3 refs — load instructions, skills, memory as additional context
4. Wire capabilities — convert `{{capabilities/...}}` refs into callable tool schemas
5. Inject data flows — load `{{<< output.nodeName}}` from stored outputs
6. Call the LLM with the assembled context and available tools
7. Execute any tool calls the LLM makes (read files, write files, run tests, etc.)
8. Loop on tool calls until the LLM produces a final text response
9. Store the node's output for future data flow refs
10. Evaluate routing — at router nodes, check conditions against template `check` fields
11. Advance to the next node

**Termination conditions:**
- No outgoing edges from the current node (workflow complete)
- Max step count reached (safety limit, typically 50)
- Same node visited more than 3 times (likely stuck in a loop)

**Shutdown:**
- Disconnect all MCP server connections
- Log token usage and run metadata

### What the executor must understand about tools

Tools are declarations, not implementations. The `.md` file in `tools/` says "this workflow needs the ability to read code." The executor provides the implementation:

| Tool type | What the executor does |
|-----------|----------------------|
| `builtin` | Maps to the executor's own file/terminal/search capabilities |
| `script` | Runs the declared shell command in the project directory |
| `mcp` | Proxies the call to the named MCP server via the SDK |

The executor converts tool declarations into the LLM provider's tool-calling format (Anthropic tool_use blocks, OpenAI function calls, etc.) and handles the request/response cycle.

### What the executor must understand about routing

At router nodes, the executor must evaluate which outgoing edge to follow:

1. Collect all outgoing edges from the current node
2. For each conditional edge, resolve the template's `check` field
3. Present the conditions and the LLM's output to a routing evaluator
4. The evaluator determines which condition is satisfied
5. Follow the matching edge

If only one unconditional edge exists, follow it automatically. If no edges exist, the workflow is complete.

### What the executor must understand about memory

Memory files are read/write persistent state:
- Read `memory/user.md` and `memory/decisions.md` at session start
- Write to memory files during execution when the agent learns something
- Memory persists across sessions — it is the agent's long-term knowledge
- Never store secrets in memory files

---

## Complete Worked Example

The `build-feature` workflow demonstrates every concept in this guide. Here is the full structure, annotated.

### Workspace structure

```
.agentflow/
├── AGENTS.md                              ← Layer 0: identity + workflow list
├── mcp.json                               ← MCP server configuration
├── tools/
│   ├── read-code.md                       ← builtin tool
│   ├── write-file.md                      ← builtin tool
│   ├── run-tests.md                       ← script tool (npm test)
│   ├── get-diagnostics.md                 ← builtin tool
│   ├── source-agent.md                    ← MCP tool
│   ├── web-search.md                      ← builtin tool
│   └── git-history.md                     ← script tool (git log)
├── skills/
│   ├── requirements-elicitation.md        ← how to gather requirements
│   ├── technical-design.md                ← how to create designs
│   ├── task-decomposition.md              ← how to break work into tasks
│   ├── implementation-discipline.md       ← how to write quality code
│   ├── code-search.md                     ← how to explore codebases
│   ├── security-review.md                 ← security audit checklist
│   ├── api-design.md                      ← API design best practices
│   └── test-analysis.md                   ← how to analyze test results
├── templates/
│   ├── requirements-approved.md           ← condition: user approved requirements
│   ├── requirements-rejected.md           ← condition: user rejected requirements
│   ├── design-approved.md                 ← condition: user approved design
│   ├── design-rejected.md                 ← condition: user rejected design
│   ├── tasks-approved.md                  ← condition: user approved task list
│   ├── tasks-rejected.md                  ← condition: user rejected task list
│   ├── task-complete.md                   ← condition: current task passes verification
│   ├── task-failed.md                     ← condition: current task failed
│   ├── more-tasks-remain.md              ← condition: uncompleted tasks exist
│   ├── all-tasks-done.md                 ← condition: every task is done
│   ├── tests-pass.md                      ← condition: all tests pass
│   └── tests-fail.md                      ← condition: tests are failing
├── interactions/
│   ├── review-requirements.md             ← approval: present requirements for review
│   ├── review-design.md                   ← approval: present design for review
│   ├── review-tasks.md                    ← approval: present task list for review
│   ├── checkpoint.md                      ← confirm: pause and verify before continuing
│   ├── collect-feedback.md                ← freeform: ask for structured feedback
│   └── show-diff.md                       ← confirm: show changes before applying
├── memory/
│   ├── MEMORY.md                          ← instructions for using the memory system
│   ├── user.md                            ← user preferences and conventions
│   ├── decisions.md                       ← important decisions and reasoning
│   ├── lessons.md                         ← mistakes and learnings
│   └── facts.md                           ← domain knowledge
└── build-feature/                         ← THE WORKFLOW
    ├── AGENTS.md                          ← Layer 1: workflow descriptor
    ├── gather-requirements/               ← Node: step, entry: true
    │   ├── SKILL.md                       ← Primary file
    │   └── requirements-template.md       ← Context file (loaded alongside)
    ├── review-requirements-gate/          ← Node: router
    │   └── SKILL.md
    ├── create-design/                     ← Node: step
    │   └── SKILL.md
    ├── review-design-gate/                ← Node: router
    │   └── SKILL.md
    ├── plan-tasks/                        ← Node: step
    │   └── SKILL.md
    ├── review-tasks-gate/                 ← Node: router
    │   └── SKILL.md
    ├── implement-task/                    ← Node: step (runs N times)
    │   └── SKILL.md
    ├── task-completion-gate/              ← Node: router
    │   └── SKILL.md
    └── verify-feature/                    ← Node: step (final)
        └── SKILL.md
```

### Execution flow

1. **gather-requirements** (step, entry) — Explores the codebase, writes a requirements document with numbered requirements and WHEN/THEN acceptance criteria. Uses `skills/requirements-elicitation`, `tools/source-agent`, `tools/read-code`, `tools/write-file`. Reads `memory/user` and `memory/decisions`.

2. **review-requirements-gate** (router) — Presents requirements to the user via `interactions/review-requirements`. Routes:
   - Approved → `create-design` (via `templates/requirements-approved`)
   - Rejected → `gather-requirements` (via `templates/requirements-rejected`)

3. **create-design** (step) — Transforms approved requirements into architecture, data models, API contracts, and testing strategy. Uses `skills/technical-design`, `skills/api-design`, `skills/security-review`. Reads output from `gather-requirements` via data flow.

4. **review-design-gate** (router) — Same pattern. Approved → `plan-tasks`. Rejected → `create-design`.

5. **plan-tasks** (step) — Breaks the design into ordered, atomic implementation tasks with checkpoints. Uses `skills/task-decomposition`. Reads output from both `gather-requirements` and `create-design`.

6. **review-tasks-gate** (router) — Same pattern. Approved → `implement-task`. Rejected → `plan-tasks`.

7. **implement-task** (step, iterative) — Executes one task at a time. Reads the task list, picks the next uncompleted task, writes code, runs diagnostics, runs tests, marks the task complete. Uses `skills/implementation-discipline`, `skills/code-search`, `skills/test-analysis`, and all code tools.

8. **task-completion-gate** (router) — Checks the task list:
   - Task failed → `implement-task` (retry via `templates/task-failed`)
   - More tasks remain → `implement-task` (next task via `templates/more-tasks-remain`)
   - All done → `verify-feature` (via `templates/all-tasks-done`)

9. **verify-feature** (step, final) — Runs the full test suite, checks diagnostics on all modified files, verifies every acceptance criterion, writes a summary. Presents the summary to the user via `interactions/checkpoint` for final sign-off.

### What each node loads

| Node | Layer 2 (own content) | Layer 3 (resolved refs) | Tools wired |
|------|----------------------|------------------------|-------------|
| gather-requirements | ~1500 tok | requirements-elicitation (~800), memory/user (~50), memory/decisions (~100) | source-agent, read-code, write-file |
| review-req-gate | ~300 tok | interactions/review-requirements (~200), 2 templates (~100) | none |
| create-design | ~1200 tok | technical-design (~800), api-design (~500), security-review (~500) | source-agent, read-code, git-history, write-file |
| plan-tasks | ~1000 tok | task-decomposition (~800), memory/decisions (~100) | source-agent, write-file |
| implement-task | ~1500 tok | implementation-discipline (~600), code-search (~500), test-analysis (~300) | read-code, write-file, get-diagnostics, run-tests, source-agent |
| task-completion-gate | ~200 tok | 3 templates (~150) | none |
| verify-feature | ~800 tok | test-analysis (~300), memory/decisions (~100) | run-tests, get-diagnostics, read-code |

---

## AGENTS.md and the Open Standard

[AGENTS.md](https://agents.md) is an open standard under the [Agentic AI Foundation](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation) (Linux Foundation), contributed by OpenAI and supported by Anthropic, Google, AWS, Microsoft, and others. It provides a simple, universal format for giving AI coding agents project-specific guidance.

AgentFlow's AGENTS.md is a superset of this standard. A standard AGENTS.md works in AgentFlow — it becomes the root identity file. AgentFlow adds:
- YAML frontmatter for typed metadata
- The `{{ref}}` syntax for graph relationships
- Per-workflow descriptor files
- Context budget declarations

An agent that only understands the standard AGENTS.md reads AgentFlow's version and gets useful context. An agent that understands AgentFlow's extensions gets structured graph navigation. Both work. This is progressive enhancement applied to agent configuration.

---

## Authoring Checklist

Use this when creating or reviewing a workflow.

### Workspace level
- [ ] Root `AGENTS.md` exists with `type: agents` frontmatter
- [ ] Root `AGENTS.md` has an `identity` block with name, role, and constraints
- [ ] Root `AGENTS.md` is under 800 tokens
- [ ] All `{{ref}}` tokens resolve to existing files
- [ ] `mcp.json` exists if any tools use `type: mcp`

### Workflow level
- [ ] Workflow has an `AGENTS.md` descriptor listing all nodes
- [ ] At least one node is marked `entry: true`
- [ ] Review gates exist between every major phase
- [ ] Rejection loops go back to the correct producing node
- [ ] Iteration loops have termination conditions (e.g., all-tasks-done)

### Node level
- [ ] Every node has a Context Budget section with token estimates
- [ ] Every ref has resolve timing (now / on use / on write)
- [ ] Excluded refs are explicitly listed per node
- [ ] Active stage total (Layer 0 + 1 + 2 + resolved 3) is under 8k tokens
- [ ] Router nodes have zero tools and zero skills
- [ ] Entry node is marked `entry: true` in frontmatter
- [ ] Data flow refs (`{{<< output.X}}`) point to nodes that produce output
- [ ] Edge refs (`{{-> nodes/X}}`) point to nodes that exist in the workflow

### Resource level
- [ ] Every conditional edge has a matching template with a `check` field
- [ ] Template `check` fields are unambiguous and evaluable
- [ ] Tool files declare their type (`builtin`, `script`, or `mcp`)
- [ ] Script tools have a `command` field
- [ ] MCP tools have an `mcp` field matching a server in `mcp.json`
- [ ] Interaction files declare their type (`approval`, `freeform`, `choice`, `confirm`)
- [ ] Memory files are append-friendly with date-prefix conventions
- [ ] Skills are self-contained — they make sense without the referencing node
- [ ] No secrets in any file (use `${env:VAR}` tokens in mcp.json instead)
