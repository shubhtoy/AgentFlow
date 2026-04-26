# AgentFlow — Architecture & Design Philosophy

This document describes the high-level architecture and design philosophy of AgentFlow. If you want to understand why the format works the way it does, you are in the right place.

For practical authoring guidance, see [authoring-guide.md](authoring-guide.md). For the MCP integration design, see the [MCP discovery spec](../.kiro/specs/mcp-discovery/design.md).

## Contents

- [The Problem](#the-problem)
- [Design Principles](#design-principles)
- [The Format](#the-format)
- [The Five-Layer Context Model](#the-five-layer-context-model)
- [Graph Model](#graph-model)
- [Classification and Resolution](#classification-and-resolution)
- [AGENTS.md and the Open Standard](#agentsmd-and-the-open-standard)
- [MCP Integration](#mcp-integration)
- [Consumption Model](#consumption-model)
- [The ToolProvider Abstraction](#the-toolprovider-abstraction)
- [Relationship to Existing Standards](#relationship-to-existing-standards)
- [What AgentFlow Is Not](#what-agentflow-is-not)

---

## The Problem

LLMs have finite context windows. Every token loaded is a token the model cannot use for reasoning. Agent workflows are complex — they involve identity, instructions, tools, routing logic, shared knowledge, and runtime artifacts. Loading everything at once wastes context. Loading nothing leaves the agent directionless.

AgentFlow answers a specific question: how do you structure agent instructions so that the right context is loaded at the right time, and nothing more?

Most agent frameworks treat context as unlimited. They concatenate system prompts, tool descriptions, conversation history, and retrieved documents into a single prompt. This works for simple tasks. It breaks for multi-step workflows where different stages need different instructions, tools are only relevant at certain points, prior outputs need to flow forward selectively, and the agent needs to maintain identity across stages.

AgentFlow treats context like memory in a constrained system. Every piece of context has a cost (tokens), a scope (which stages need it), and a lifetime (when to load, when to discard). The format encodes all of this in the file structure itself.

---

## Design Principles

### Directory is architecture

The folder layout is the workflow architecture. There is no build step, no compilation, no configuration files to maintain. `ls` shows the structure. `cat` shows the content. Git tracks the history.

```
.agentflow/
  AGENTS.md              — identity and workflow discovery
  tools/                 — tool declarations (builtin, script, MCP)
  skills/                — reusable instruction modules
  templates/             — condition definitions for routing
  interactions/          — human touchpoints
  memory/                — persistent state across sessions
  build-feature/         — a workflow
    gather-requirements/ — a node (stage)
    create-design/
    implement-task/
```

This is inspectable without tooling, version-controllable without adapters, and consumable by any system that can read files.

### Progressive strictness

Frontmatter is optional. Any `.md` file dropped into the workspace works immediately. The parser infers types from directory names — files in `tools/` are tools, files in `skills/` are skills. Validation is permissive by default, strict only when opted into.

The gradient runs from zero ceremony to full specification:

- Drop a file in `tools/` — it is a tool, no frontmatter needed.
- Add `type: mcp` frontmatter — the parser knows it is an MCP tool.
- Add `parameters:` — the parser can generate tool schemas.
- Add `context: { max_tokens: 3000 }` — the runtime can enforce budgets.

The format never forces ceremony on simple cases.

### Platform agnostic

AgentFlow workspaces are consumed by any AI system — Kiro, Claude Code, Cursor, GPT, or a custom orchestrator. The format is markdown files in directories. The consuming agent decides how to interpret them.

Two consumption levels exist. At Level 1, any agent reads the `.agentflow/` markdown as context. This works today with zero integration. At Level 2, an orchestrator walks the graph node by node, loading only the current stage's context, executing tools, evaluating routing conditions, and advancing. The reference runtime demonstrates Level 2.

### Refs encode intent

The `{{ref}}` syntax encodes semantic intent, not just links:

```
{{capabilities/read-code}}                       — mention: make this capability available
{{instructions/requirements-elicitation}}         — mention: load these instructions
{{-> create-design}}                             — edge: transition to this node
{{-> plan-tasks | skills/design-approved}}     — conditional edge: transition if condition met
{{<< output.gather-requirements}}                — data flow: read output from that stage
```

The parser extracts these into a typed graph. Mentions become context. Edges become transitions. Data flows become state dependencies. The markdown is simultaneously human-readable documentation and machine-parseable workflow definition.

### Zero code dependency

AgentFlow is a format, not a framework. The `.agentflow/` directory contains only markdown files, YAML frontmatter, and one optional JSON file (`mcp.json`). There is no code to install, no SDK to import, no build step to run.

The tooling that exists — the parser, CLI, validator, orchestrator, visual editor — is convenience infrastructure. Remove all of it and the `.agentflow/` directory still works. An LLM can read the markdown files directly as context. A human can read them as documentation. A shell script can concatenate the files into a prompt. Any agent framework can parse the frontmatter and follow the refs.

The reference runtime exists to prove the format works end-to-end. It is one possible consumer, not the only one.

---

## The Format

AgentFlow uses standard markdown with three extensions: YAML frontmatter, a reference syntax, and directory conventions. There are no custom file formats, no binary data, and no proprietary markup.

### Frontmatter

Optional YAML metadata at the top of any `.md` file, delimited by `---`:

```yaml
---
name: gather-requirements
type: step
entry: true
agent: requirements-analyst
context:
  max_tokens: 3000
  inputs:
    - ref: skills/requirements-elicitation
      scope: full
    - ref: tools/read-code
      scope: signature
outputs:
  - name: requirements-doc
    format: markdown
---
```

Frontmatter is parsed by [gray-matter](https://github.com/jonschlinkert/gray-matter). Every field is optional. A file with no frontmatter is valid.

### Reference syntax

Four reference types, distinguished by prefix:

| Syntax | Semantic type | Purpose |
|--------|--------------|---------|
| `{{category/name}}` | mention | Load this resource as context |
| `{{-> target}}` | edge | Transition to this node |
| `{{-> target \| condition}}` | conditional edge | Transition if condition is met |
| `{{<< output.nodeName}}` | data flow | Read output from a previous node |

References are extracted by regex. They work in any markdown context — paragraphs, lists, headings.

### Reserved directories

| Directory | Resource type | Purpose |
|-----------|--------------|---------|
| `tools/` | tool | What the agent can do |
| `skills/` | skill | Reusable instruction modules |
| `templates/` | template | Condition definitions for routing |
| `interactions/` | interaction | Human touchpoints |
| `memory/` | memory | Persistent state across sessions |

Any other top-level directory containing subdirectories with `.md` files is treated as a workflow. Subdirectories within workflows are nodes.

### Node structure

Each node is a directory containing at least one `.md` file:

```
build-feature/
  gather-requirements/
    SKILL.md          — primary file (instructions and refs)
    context.md        — optional additional context
    output/           — runtime artifacts (excluded from context)
      requirements.md
```

The primary file is selected by priority: `primary: true` frontmatter, then `main.md` by filename, then alphabetical first. All other `.md` files in the directory are context files loaded alongside the primary. The `output/` directory holds runtime artifacts that are never loaded as context.

---

## The Five-Layer Context Model

AgentFlow organizes context into five layers with clear scoping rules. The model is inspired by how operating systems manage memory hierarchies — always-resident kernel, per-process working set, demand-paged libraries, and disk-backed storage.

| Layer | Name | What | Where | Budget | Lifetime |
|-------|------|------|-------|--------|----------|
| 0 | Identity | Who the agent is | Root `AGENTS.md` | ~200 tokens | Always loaded |
| 1 | Routing | Which stage is active | Workflow `AGENTS.md` | ~500–800 tokens | Always loaded |
| 2 | Contract | What this stage does | Node `SKILL.md` | 2k–8k tokens | Current stage only |
| 3 | References | Shared knowledge | `tools/`, `skills/`, `memory/` | On demand | Resolved per ref |
| 4 | Artifacts | Runtime output | `node/output/` | Never loaded | Written, not read |

The constraint: Layer 0 + Layer 1 + one active Layer 2 + its resolved Layer 3 references should fit in roughly 5k–8k tokens. If it does not, the node is too complex and should be split.

Without layers, there are two failure modes. Context overload: load everything and the model drowns in irrelevant instructions. Context starvation: load too little and the model hallucinates or goes off-track. Layers make context loading deterministic. Layers 0 and 1 are always present at low cost. Layer 2 swaps per stage. Layer 3 resolves on demand. Layer 4 is never loaded.

The analogy to CPU caches is direct. Layer 0 is L1 — always hot, tiny, fastest access. Layer 2 is L2 — the working set, swaps per process. Layer 3 is L3 — shared across cores, loaded on demand. Layer 4 is disk — cold storage, never in active memory.

---

## Graph Model

An AgentFlow workflow is a directed graph. Nodes are stages (steps, routers, or sub-workflows). Edges are transitions, optionally conditional. References encode relationships between nodes and shared resources.

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

The common patterns are linear flow (stages execute in sequence), review gates (router nodes that branch on approval or rejection), rejection loops (rejected work returns for revision), and iteration loops (implement, check, implement again until done).

The graph is extracted from the markdown by the parser. Edge references become edges. Conditional edge references become conditional edges. Data flow references become data dependencies. The parser does not require the graph to be acyclic — loops are valid and expected for iteration patterns.

---

## Classification and Resolution

### Resource classification

Every `.md` file in the workspace is classified by priority:

1. Frontmatter type takes priority — `type: tool`, `type: skill`, `type: mcp`.
2. Directory inference — files in `tools/` are tools, files in `skills/` are skills.
3. Untyped — files outside reserved directories with no type frontmatter.

### Reference resolution

References resolve in two steps. First, path match: `{{capabilities/read-code}}` looks for `capabilities/read-code.md`. Second, name match as fallback: search all files for a frontmatter `name` field matching `read-code`.

Path-first resolution is deterministic and fast. Name-based fallback handles cases where files are renamed or reorganized.

---

## AGENTS.md and the Open Standard

[AGENTS.md](https://agents.md) is an open standard under the [Agentic AI Foundation](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation) (Linux Foundation), contributed by OpenAI and supported by Anthropic, Google, AWS, Microsoft, and others. It provides a simple, universal format for giving AI coding agents project-specific guidance. The standard is intentionally minimal — just markdown with whatever headings you want. No required fields, no schema.

AgentFlow's AGENTS.md is a superset of this standard. A standard AGENTS.md works in AgentFlow — it becomes the root identity file. AgentFlow adds YAML frontmatter for typed metadata, the `{{ref}}` syntax for graph relationships, per-workflow descriptor files, and context budget declarations.

An agent that only understands the standard AGENTS.md reads AgentFlow's version and gets useful context. An agent that understands AgentFlow's extensions gets structured graph navigation. Both work. This is progressive enhancement applied to agent configuration.

---

## MCP Integration

The [Model Context Protocol](https://modelcontextprotocol.io) (MCP) is the standard for connecting AI agents to external tools and services. AgentFlow integrates MCP at two levels.

At authoring time, tool `.md` files in `.agentflow/tools/` can declare MCP tools with `type: mcp` frontmatter. When tools are discovered from a running MCP server via `tools/list`, the parameters in the generated `.md` file come from the server's `inputSchema` — they are not hand-guessed.

At the workspace level, `.agentflow/mcp.json` declares which MCP servers a workflow needs. The format follows the de facto standard used by Claude Desktop, Cursor, VS Code, and Kiro:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "${env:GITHUB_TOKEN}" },
      "required": true,
      "description": "GitHub API integration"
    }
  }
}
```

The standard fields — `command`, `args`, `env` — are readable by any MCP client. AgentFlow adds extension fields (`required`, `description`, `registry`, `discoveredTools`) that other clients ignore. This means `.agentflow/mcp.json` is both a standard MCP configuration file and an AgentFlow feature gate manifest.

The `required` field is the key extension. When the orchestrator starts a workflow, it reads `mcp.json`, connects to all servers, and fails immediately if a required server is unavailable. Optional servers that fail produce a warning; their tools return errors if called. This is analogous to `package.json` for MCP dependencies — the workflow declares what it needs, and the runtime enforces it.

---

## Consumption Model

Any AI agent can consume an AgentFlow workspace by reading the markdown files:

1. Read `.agentflow/AGENTS.md` for identity, constraints, and workflow list.
2. Read the workflow's `AGENTS.md` for node summaries and edges.
3. Read the current node's `SKILL.md` for instructions and references.
4. Resolve `{{instructions/...}}` references as additional context.
5. Map `{{capabilities/...}}` references to the agent's own tool implementations.
6. Do the work described in the instructions.
7. Follow edge references to advance to the next node.

The agent does not need AgentFlow tooling. The reference syntax is human-readable enough that an LLM can follow it. The directory structure is self-documenting.

The reference runtime walks the graph programmatically: it parses the workspace into a typed graph, initializes a ToolProvider (connecting MCP servers and registering builtins), then for each node assembles context from layers 0–3, resolves tools, calls the LLM with tools available, executes tool calls, evaluates routing, and advances. On shutdown it disconnects all MCP servers.

---

## The ToolProvider Abstraction

Tools in AgentFlow are declarations — they say "this workflow needs X." The host agent provides the implementation. Different hosts implement tools differently:

| Tool type | Declaration | Orchestrator implementation | Other agents |
|-----------|-------------|---------------------------|--------------|
| builtin | `type: builtin` | `fs.readFileSync()`, `child_process` | Agent's built-in file/terminal tools |
| script | `type: script` | `child_process.exec()` | Agent's terminal tool |
| mcp | `type: mcp` | `@modelcontextprotocol/sdk` | Agent's own MCP client |

The orchestrator never knows whether a tool is builtin, script, or MCP. It receives a uniform `{ name, schema, execute }` interface from the ToolProvider:

```javascript
class ToolProvider {
  async initialize(graph) {}
  getToolsForNode(node, graph) {}
  async shutdown() {}
}
```

`NodeToolProvider` is the reference implementation for standalone execution. Future providers could delegate to Kiro's tools, Cursor's tools, or any other agent's native capabilities.

---

## Relationship to Existing Standards

| Standard | Relationship |
|----------|-------------|
| [AGENTS.md](https://agents.md) (AAIF, Linux Foundation) | AgentFlow's AGENTS.md is a superset. Standard files work in AgentFlow. |
| [MCP](https://modelcontextprotocol.io) (AAIF, Linux Foundation) | AgentFlow uses MCP for tool integration. `mcp.json` follows the de facto config standard with extensions. |
| [MCP Registry](https://registry.modelcontextprotocol.io) | AgentFlow can search and install servers from the official registry. |
| Markdown, YAML frontmatter | The format is standard markdown with YAML frontmatter. |
| JSON-RPC 2.0 | MCP's wire protocol. Handled by `@modelcontextprotocol/sdk`, not implemented directly. |

AgentFlow does not compete with these standards. It builds on them. The format is markdown. The agent configuration is AGENTS.md. The tool protocol is MCP. AgentFlow's contribution is the context layering model, the reference syntax for graph encoding, and the directory-as-architecture principle.

---

## What AgentFlow Is Not

AgentFlow is not an agent framework. It does not provide LLM abstractions, chain-of-thought mechanisms, or memory management. It is a format for defining what agents should do.

It is not a runtime. The reference orchestrator proves the format works, but any agent can consume the format without it.

It is not a visual tool. The visual editor is a convenience for authoring. The source of truth is always the markdown files on disk.

It is not a proprietary format. Everything is standard markdown, YAML, and JSON. There are no binary formats, no lock-in, and no required tooling. Remove all the code and the `.agentflow/` directory still works.





graph TB
    subgraph "User Layer"
        CLI["CLI<br/>(bin/cli.js)<br/>parse | validate | export | graph | ui"]
        Studio["Studio UI<br/>(Next.js App)<br/>Visual Editor + Canvas + Chat"]
        ExtAgent["External Agents<br/>(Kiro, Cursor, Claude Code,<br/>VS Code Copilot, Windsurf)"]
    end

    subgraph "API Layer (Studio)"
        APIRoutes["Next.js API Routes<br/>/api/hooks, /api/data, etc."]
        CopilotKit["CopilotKit + LangGraph<br/>AI Chat Integration"]
    end

    subgraph "Transport Layer"
        direction TB
        TransportReg["TransportRegistry"]
        ExportPipe["ExportPipeline"]
        ImportPipe["ImportPipeline"]
        PlatformAdapter["PlatformAdapter<br/>(declarative JSON config)"]
        FidelityReporter["FidelityReporter"]
        Transforms["Transforms<br/>(markdown ↔ platform format)"]

        subgraph "Platform Configs"
            KiroCfg["kiro.json"]
            CursorCfg["cursor.json"]
            ClaudeCfg["claude-code.json"]
            VSCopilotCfg["vscode-copilot.json"]
            WindsurfCfg["windsurf.json"]
            AgentSpecCfg["agent-spec.json"]
            OpenClawCfg["openclaw.json"]
        end
    end

    subgraph "Core Engine"
        direction TB
        Parser["Parser<br/>(parser.js)<br/>Frontmatter + Ref Extraction<br/>+ Graph Construction"]
        Validator["Validator<br/>(validator.js)<br/>Schema + Refs + Cycles<br/>+ Unreachable Nodes"]
        Taxonomy["Taxonomy Registry<br/>(taxonomy.js)<br/>instructions | capabilities<br/>skills | memory | hooks"]
        TokenCalc["Token Calculator<br/>(token-calculator.js)"]
        DryRunner["Dry Runner<br/>(dry-runner.js)<br/>Simulated Workflow Execution"]
        Exporter["Exporter<br/>(exporter.js + structured-exporter.js)"]
        PrettyPrint["Pretty Printer<br/>(pretty-printer.js)"]
        Library["Library<br/>(library.js)<br/>search | add | index"]
    end

    subgraph "Services Layer"
        direction TB
        WorkflowSvc["WorkflowService<br/>parse, save, create, delete,<br/>move, buildTree"]
        ValidationSvc["ValidationService"]
        ExportSvc["ExportService"]
        ImportSvc["ImportService"]
        HookRegistry["HookRegistry<br/>loadAll, getHooksForEvent,<br/>addHook, removeHook"]
        EventHookEngine["EventHookEngine<br/>emit events → evaluate<br/>conditions → execute actions"]
        InstructionMgr["InstructionManager"]
        TemplateSvc["TemplateService"]
        ScaffoldGen["ScaffoldGenService"]
        GitSvc["GitService"]
        McpBridge["MCP Bridge"]
    end

    subgraph "MCP Integration"
        direction TB
        McpConfigMgr["Config Manager<br/>(mcp/config-manager.js)<br/>loadMcpConfig, resolveEnvTokens"]
        ToolProvider["ToolProvider<br/>(mcp/tool-provider.js)<br/>Base class + NodeToolProvider"]
        ServerLifecycle["Server Lifecycle<br/>(server-lifecycle.js)<br/>discoverTools via stdio/HTTP"]
        ToolScaffolder["Tool Scaffolder<br/>(tool-scaffolder.js)"]
        RegistryClient["Registry Client<br/>(registry-client.js)<br/>searchRegistry, getServer"]
        UnifiedSearch["Unified Search<br/>(unified-search.js)"]

        subgraph "Tool Types"
            Builtin["Builtin Tools<br/>(readCode, fsWrite,<br/>getDiagnostics, webSearch)"]
            ScriptTool["Script Tools<br/>(shell commands)"]
            McpTool["MCP Tools<br/>(external servers)"]
        end
    end

    subgraph "Git Integration"
        GitMgr["Git Manager"]
        RepoScanner["Repo Scanner"]
        SyncEngine["Sync Engine"]
        GitConfig["Config Manager"]
    end

    subgraph ".agentflow/ Workspace (The Format)"
        direction TB
        RootAgents["AGENTS.md<br/>(Layer 0 — Identity)"]
        
        subgraph "Reserved Dirs (Layer 3 — References)"
            Instructions["instructions/<br/>(skills, steering)"]
            Capabilities["capabilities/<br/>(tools: builtin, script, MCP)"]
            Skills["skills/<br/>(conditions, interactions)"]
            Memory["memory/<br/>(persistent state)"]
            Hooks["hooks/<br/>(event-driven JSON)"]
        end

        subgraph "Workflow (e.g. build-feature/)"
            WfAgents["AGENTS.md<br/>(Layer 1 — Routing)"]
            
            subgraph "Nodes (Layer 2 — Contract)"
                Node1["gather-requirements/<br/>SKILL.md + context files"]
                Node2["create-design/<br/>SKILL.md"]
                Node3["implement-task/<br/>SKILL.md"]
            end

            subgraph "Artifacts (Layer 4 — Never Loaded)"
                Output["node/output/"]
            end
        end

        McpJson["mcp.json<br/>(MCP server config)"]
    end

    subgraph "Reference Syntax (Graph Edges)"
        Mention["{{category/name}}<br/>→ mention (load context)"]
        Edge["{{-> target}}<br/>→ edge (transition)"]
        CondEdge["{{-> target | condition}}<br/>→ conditional edge"]
        DataFlow["{{<< output.node}}<br/>→ data flow"]
    end

    %% User → API connections
    CLI --> Parser
    CLI --> Validator
    CLI --> Exporter
    CLI --> DryRunner
    CLI --> Library
    Studio --> APIRoutes
    APIRoutes --> WorkflowSvc
    APIRoutes --> ValidationSvc
    APIRoutes --> ExportSvc
    APIRoutes --> HookRegistry
    Studio --> CopilotKit
    ExtAgent --> TransportReg

    %% Transport connections
    TransportReg --> PlatformAdapter
    PlatformAdapter --> Transforms
    PlatformAdapter --> KiroCfg
    PlatformAdapter --> CursorCfg
    PlatformAdapter --> ClaudeCfg
    PlatformAdapter --> VSCopilotCfg
    PlatformAdapter --> WindsurfCfg
    PlatformAdapter --> AgentSpecCfg
    PlatformAdapter --> OpenClawCfg
    ExportPipe --> TransportReg
    ExportPipe --> FidelityReporter
    ImportPipe --> TransportReg

    %% Core Engine connections
    Parser --> Taxonomy
    Parser --> McpConfigMgr
    Validator --> Parser
    DryRunner --> Parser
    DryRunner --> Validator
    TokenCalc --> Parser

    %% Services → Core
    WorkflowSvc --> Parser
    WorkflowSvc --> Taxonomy
    ValidationSvc --> Validator
    ExportSvc --> ExportPipe
    ImportSvc --> ImportPipe
    EventHookEngine --> HookRegistry

    %% MCP connections
    ToolProvider --> Builtin
    ToolProvider --> ScriptTool
    ToolProvider --> McpTool
    McpTool --> ServerLifecycle
    ServerLifecycle --> McpConfigMgr
    ToolScaffolder --> ServerLifecycle
    UnifiedSearch --> RegistryClient
    McpBridge --> ToolProvider

    %% Git connections
    GitSvc --> GitMgr
    GitSvc --> RepoScanner
    GitSvc --> SyncEngine
    GitSvc --> GitConfig

    %% Workspace connections
    Parser -->|"reads"| RootAgents
    Parser -->|"reads"| WfAgents
    Parser -->|"reads"| Node1
    Parser -->|"reads"| Node2
    Parser -->|"reads"| Node3
    Parser -->|"classifies"| Instructions
    Parser -->|"classifies"| Capabilities
    Parser -->|"classifies"| Skills
    Parser -->|"classifies"| Memory
    Parser -->|"classifies"| Hooks
    McpConfigMgr -->|"reads"| McpJson

    %% Ref syntax → graph
    Node1 -.->|"contains"| Mention
    Node1 -.->|"contains"| Edge
    Node1 -.->|"contains"| CondEdge
    Node1 -.->|"contains"| DataFlow

    %% Node transitions
    Node1 -->|"{{-> create-design}}"| Node2
    Node2 -->|"{{-> implement-task}}"| Node3
    Node3 -->|"writes to"| Output

    %% Styling
    classDef workspace fill:#1a1a2e,stroke:#e94560,color:#fff
    classDef core fill:#16213e,stroke:#0f3460,color:#fff
    classDef service fill:#0f3460,stroke:#533483,color:#fff
    classDef mcp fill:#533483,stroke:#e94560,color:#fff
    classDef transport fill:#2d4059,stroke:#ea5455,color:#fff
    classDef user fill:#222831,stroke:#00adb5,color:#fff

    class RootAgents,WfAgents,Node1,Node2,Node3,Output,Instructions,Capabilities,Skills,Memory,Hooks,McpJson workspace
    class Parser,Validator,Taxonomy,TokenCalc,DryRunner,Exporter,PrettyPrint,Library core
    class WorkflowSvc,ValidationSvc,ExportSvc,ImportSvc,HookRegistry,EventHookEngine,InstructionMgr,TemplateSvc,ScaffoldGen,GitSvc,McpBridge service
    class McpConfigMgr,ToolProvider,ServerLifecycle,ToolScaffolder,RegistryClient,UnifiedSearch,Builtin,ScriptTool,McpTool mcp
    class TransportReg,ExportPipe,ImportPipe,PlatformAdapter,FidelityReporter,Transforms transport
    class CLI,Studio,ExtAgent,APIRoutes,CopilotKit user
