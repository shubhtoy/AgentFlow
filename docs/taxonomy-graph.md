# AgentFlow Taxonomy — Visual Reference

## 1. The Six Resource Categories

```mermaid
graph TD
    AF[".agentflow/"]

    AF --> IDENTITY["AGENTS.md"]
    AF --> INSTRUCTIONS["instructions/"]
    AF --> CAPABILITIES["capabilities/"]
    AF --> RUNBOOKS["skills/"]
    AF --> MEMORY["memory/"]
    AF --> HOOKS["hooks/"]
    AF --> WORKFLOWS["workflows"]

    style AF fill:#f5f5f5,stroke:#333
    style IDENTITY fill:#E8EAF6,stroke:#283593
    style INSTRUCTIONS fill:#E0F7FA,stroke:#00838F
    style CAPABILITIES fill:#FCE4EC,stroke:#D81B60
    style RUNBOOKS fill:#F3E5F5,stroke:#6A1B9A
    style MEMORY fill:#EDE7F6,stroke:#512DA8
    style HOOKS fill:#FFF3E0,stroke:#E65100
    style WORKFLOWS fill:#E3F2FD,stroke:#1565C0
```

| Category | Directory | What it holds | Scopes |
|----------|-----------|---------------|--------|
| Identity | `AGENTS.md` | Who the agent is — name, role, personality, constraints | Singular file |
| Instructions | `instructions/` | Reusable how-to modules the agent follows | `workflow`, `global` |
| Capabilities | `capabilities/` | Tool declarations — what the agent can do | `descriptor`, `config` |
| Skills | `skills/` | Human touchpoints and routing conditions | `interaction`, `condition` |
| Memory | `memory/` | Persistent state across sessions | None |
| Hooks | `hooks/` | Event-driven automation (JSON files) | None |

---

## 2. Instructions

Reusable instruction sets that tell the agent **how** to do things.

```mermaid
graph LR
    INS["instructions/"]

    INS --> WF_SCOPE["Workflow scope"]
    INS --> GL_SCOPE["Global scope"]

    WF_SCOPE --> WF1["requirements-elicitation"]
    WF_SCOPE --> WF2["technical-design"]
    WF_SCOPE --> WF3["task-decomposition"]
    WF_SCOPE --> WF4["implementation-discipline"]
    WF_SCOPE --> WF5["code-search"]
    WF_SCOPE --> WF6["security-review"]

    GL_SCOPE --> GL1["coding-standards"]
    GL_SCOPE --> GL2["debugging"]
    GL_SCOPE --> GL3["refactoring"]

    style INS fill:#E0F7FA,stroke:#00838F
    style WF_SCOPE fill:#B2EBF2,stroke:#00838F
    style GL_SCOPE fill:#80DEEA,stroke:#00838F
```

- **Workflow scope** — loaded only when a specific node references them
- **Global scope** — auto-loaded in every interaction (set via `inclusion: auto` in frontmatter)

---

## 3. Capabilities

Tool declarations — **what** the agent can do. Three types:

```mermaid
graph TD
    CAP["capabilities/"]

    CAP --> BUILTIN["Builtin tools"]
    CAP --> SCRIPT["Script tools"]
    CAP --> MCP["MCP tools"]

    BUILTIN --> B1["read-code"]
    BUILTIN --> B2["write-file"]
    BUILTIN --> B3["get-diagnostics"]
    BUILTIN --> B4["file-search"]
    BUILTIN --> B5["grep-search"]
    BUILTIN --> B6["list-directory"]

    SCRIPT --> S1["run-tests"]
    SCRIPT --> S2["shell-exec"]

    MCP --> M1["source-agent"]
    MCP --> M2["web-search"]

    style CAP fill:#FCE4EC,stroke:#D81B60
    style BUILTIN fill:#F8BBD0,stroke:#D81B60
    style SCRIPT fill:#F48FB1,stroke:#C2185B
    style MCP fill:#EC407A,stroke:#AD1457,color:#fff
```

| Type | What it does | Example |
|------|-------------|---------|
| `builtin` | Maps to the agent runtime's native ability | `read-code` calls the host's file reader |
| `script` | Runs a shell command | `run-tests` executes `npm test` |
| `mcp` | Connects to an MCP server | `source-agent` queries a codebase index |

---

## 4. Skills

Two distinct purposes merged into one category:

```mermaid
graph TD
    RUN["skills/"]

    RUN --> INTERACTIONS["Interactions"]
    RUN --> CONDITIONS["Conditions"]

    INTERACTIONS --> I1["review-design"]
    INTERACTIONS --> I2["review-requirements"]
    INTERACTIONS --> I3["review-tasks"]
    INTERACTIONS --> I4["checkpoint"]
    INTERACTIONS --> I5["confirm-destructive"]
    INTERACTIONS --> I6["collect-feedback"]
    INTERACTIONS --> I7["escalate-to-human"]
    INTERACTIONS --> I8["show-diff"]

    CONDITIONS --> C1["design-approved"]
    CONDITIONS --> C2["design-rejected"]
    CONDITIONS --> C3["requirements-approved"]
    CONDITIONS --> C4["requirements-rejected"]
    CONDITIONS --> C5["tasks-approved"]
    CONDITIONS --> C6["all-tasks-done"]
    CONDITIONS --> C7["tests-pass"]
    CONDITIONS --> C8["tests-fail"]

    style RUN fill:#F3E5F5,stroke:#6A1B9A
    style INTERACTIONS fill:#E1BEE7,stroke:#6A1B9A
    style CONDITIONS fill:#CE93D8,stroke:#4A148C
```

- **Interactions** — human touchpoints: approvals, confirmations, feedback prompts
- **Conditions** — boolean checks used in conditional edges to route the workflow

---

## 5. Scope Inference

When you don't set `scope:` explicitly, the system infers it:

```mermaid
flowchart TD
    START["File in category directory"] --> HAS_SCOPE{Explicit scope in frontmatter?}

    HAS_SCOPE -->|Yes| USE_IT["Use declared scope"]

    HAS_SCOPE -->|No| WHICH{Which category?}

    WHICH -->|instructions| HAS_INCLUSION{Has inclusion field?}
    HAS_INCLUSION -->|Yes| GLOBAL["scope: global"]
    HAS_INCLUSION -->|No| WORKFLOW["scope: workflow"]

    WHICH -->|capabilities| HAS_TYPE{type is builtin, script, mcp, or package?}
    HAS_TYPE -->|Yes| DESCRIPTOR["scope: descriptor"]
    HAS_TYPE -->|No| CONFIG["scope: config"]

    WHICH -->|skills| IS_COND{type is condition?}
    IS_COND -->|Yes| CONDITION["scope: condition"]
    IS_COND -->|No| INTERACTION["scope: interaction"]

    WHICH -->|memory or hooks| NULL_SCOPE["scope: null"]

    style USE_IT fill:#E8F5E9,stroke:#2E7D32
    style GLOBAL fill:#E0F7FA,stroke:#00838F
    style WORKFLOW fill:#E0F7FA,stroke:#00838F
    style DESCRIPTOR fill:#FCE4EC,stroke:#D81B60
    style CONFIG fill:#FCE4EC,stroke:#D81B60
    style CONDITION fill:#F3E5F5,stroke:#6A1B9A
    style INTERACTION fill:#F3E5F5,stroke:#6A1B9A
    style NULL_SCOPE fill:#ECEFF1,stroke:#546E7A
```

---

## 6. The Five-Layer Context Model

Every token loaded is a token the model can't reason with. Layers control what gets loaded and when.

```mermaid
graph TD
    L0["Layer 0: Identity"]
    L1["Layer 1: Routing"]
    L2["Layer 2: Contract"]
    L3["Layer 3: References"]
    L4["Layer 4: Artifacts"]

    L0 --> L1
    L1 --> L2
    L2 --> L3
    L3 -.->|never loaded| L4

    style L0 fill:#FFEBEE,stroke:#C62828
    style L1 fill:#FFF3E0,stroke:#E65100
    style L2 fill:#E3F2FD,stroke:#1565C0
    style L3 fill:#E8F5E9,stroke:#2E7D32
    style L4 fill:#ECEFF1,stroke:#78909C
```

| Layer | Name | Source | Budget | Lifetime |
|-------|------|--------|--------|----------|
| 0 | Identity | Root `AGENTS.md` | ~200 tokens | Always loaded |
| 1 | Routing | Workflow `AGENTS.md` | ~500–800 tokens | Always loaded |
| 2 | Contract | Active node's `SKILL.md` | 2k–8k tokens | Current stage only |
| 3 | References | `instructions/`, `capabilities/`, `memory/` | On demand | Resolved per ref |
| 4 | Artifacts | `node/output/` | Zero — never loaded | Write-only |

**Hard constraint:** L0 + L1 + active L2 + resolved L3 ≤ ~8k tokens total.

---

## 7. Reference Syntax

Four ref types connect everything in the system:

```mermaid
flowchart LR
    MENTION["Mention"] -->|resolves to| CONTEXT["Layer 3 context"]
    EDGE["Edge"] -->|creates| TRANSITION["Graph transition"]
    COND_EDGE["Conditional Edge"] -->|creates| COND_TRANS["Gated transition"]
    DATA_FLOW["Data Flow"] -->|injects| PREV_OUTPUT["Previous node output"]

    style MENTION fill:#E0F7FA,stroke:#00838F
    style EDGE fill:#E3F2FD,stroke:#1565C0
    style COND_EDGE fill:#FFF3E0,stroke:#E65100
    style DATA_FLOW fill:#E8F5E9,stroke:#2E7D32
```

| Type | Syntax | What it does |
|------|--------|-------------|
| Mention | `{{capabilities/read-code}}` | Load this resource as context |
| Edge | `{{-> nodes/create-design}}` | Go to this node next |
| Conditional Edge | `{{-> nodes/plan-tasks \| skills/design-approved}}` | Go to this node if condition is met |
| Data Flow | `{{<< output.gather-requirements}}` | Read output from a previous node |

---

## 8. Node Types

Three kinds of nodes compose a workflow:

```mermaid
graph LR
    STEP["Step"]
    ROUTER["Router"]
    SUBWF["Sub-workflow"]

    style STEP fill:#E3F2FD,stroke:#1565C0
    style ROUTER fill:#FFF8E1,stroke:#F57F17
    style SUBWF fill:#F3E5F5,stroke:#6A1B9A
```

| Type | Purpose | Has capabilities? | Has instructions? |
|------|---------|-------------------|-------------------|
| Step | Does work — reads code, writes files, runs tests | Yes | Yes |
| Router | Decision point — routes based on conditions | No | No |
| Sub-workflow | Delegates to another complete workflow | Inherited | Inherited |

---

## 9. Workflow Graph Pattern

A typical workflow with review gates and rejection loops:

```mermaid
flowchart TD
    GR["gather-requirements"]:::step
    RRG["review-requirements-gate"]:::router
    CD["create-design"]:::step
    RDG["review-design-gate"]:::router
    PT["plan-tasks"]:::step
    RTG["review-tasks-gate"]:::router
    IT["implement-task"]:::step
    TCG["task-completion-gate"]:::router
    VF["verify-feature"]:::step

    GR --> RRG
    RRG -->|approved| CD
    RRG -->|rejected| GR
    CD --> RDG
    RDG -->|approved| PT
    RDG -->|rejected| CD
    PT --> RTG
    RTG -->|approved| IT
    RTG -->|rejected| PT
    IT --> TCG
    TCG -->|more tasks| IT
    TCG -->|all done| VF

    classDef step fill:#E3F2FD,stroke:#1565C0
    classDef router fill:#FFF8E1,stroke:#F57F17
```

Key patterns visible here:
- **Linear flow** — steps execute in sequence
- **Review gates** — router nodes that branch on approval/rejection
- **Rejection loops** — rejected work returns to the previous step for revision
- **Iteration loops** — implement → check → implement again until done

---

## 10. Full Directory Structure

```mermaid
graph TD
    ROOT[".agentflow/"]

    ROOT --> AGENTS["AGENTS.md"]
    ROOT --> MCPJSON["mcp.json"]
    ROOT --> INST_DIR["instructions/"]
    ROOT --> CAPS_DIR["capabilities/"]
    ROOT --> RUN_DIR["skills/"]
    ROOT --> MEM_DIR["memory/"]
    ROOT --> HOOKS_DIR["hooks/"]
    ROOT --> BF["build-feature/"]

    INST_DIR --> INST1["requirements-elicitation.md"]
    INST_DIR --> INST2["coding-standards.md"]

    CAPS_DIR --> CAP1["read-code.md"]
    CAPS_DIR --> CAP2["source-agent.md"]
    CAPS_DIR --> CAP3["run-tests.md"]

    RUN_DIR --> RUN1["design-approved.md"]
    RUN_DIR --> RUN2["review-design.md"]

    MEM_DIR --> MEM1["user.md"]
    MEM_DIR --> MEM2["decisions.md"]
    MEM_DIR --> MEM3["lessons.md"]

    HOOKS_DIR --> HOOK1["lint-on-save.json"]
    HOOKS_DIR --> HOOK2["diagnostics-after-write.json"]

    BF --> BF_AGENTS["AGENTS.md"]
    BF --> NODE1["gather-requirements/"]
    BF --> NODE2["review-gate/"]
    BF --> NODE3["implement-task/"]

    NODE1 --> SKILL1["SKILL.md"]
    NODE3 --> SKILL3["SKILL.md"]
    NODE3 --> OUTPUT["output/"]

    style ROOT fill:#f5f5f5,stroke:#333
    style AGENTS fill:#E8EAF6,stroke:#283593
    style INST_DIR fill:#E0F7FA,stroke:#00838F
    style CAPS_DIR fill:#FCE4EC,stroke:#D81B60
    style RUN_DIR fill:#F3E5F5,stroke:#6A1B9A
    style MEM_DIR fill:#EDE7F6,stroke:#512DA8
    style HOOKS_DIR fill:#FFF3E0,stroke:#E65100
    style BF fill:#E3F2FD,stroke:#1565C0
```

---

## 11. How It All Connects

A single node referencing resources across categories:

```mermaid
flowchart TD
    SKILL["gather-requirements SKILL.md"]

    SKILL -->|"mentions"| CAP_RC["capabilities/read-code"]
    SKILL -->|"mentions"| CAP_WF["capabilities/write-file"]
    SKILL -->|"mentions"| CAP_SA["capabilities/source-agent"]
    SKILL -->|"mentions"| INST_RE["instructions/requirements-elicitation"]
    SKILL -->|"mentions"| MEM_U["memory/user"]
    SKILL -->|"mentions"| MEM_D["memory/decisions"]
    SKILL -->|"edge"| NEXT["nodes/review-requirements-gate"]
    SKILL -->|"data flow"| OUT["output.gather-requirements"]

    style SKILL fill:#E3F2FD,stroke:#1565C0
    style CAP_RC fill:#FCE4EC,stroke:#D81B60
    style CAP_WF fill:#FCE4EC,stroke:#D81B60
    style CAP_SA fill:#FCE4EC,stroke:#D81B60
    style INST_RE fill:#E0F7FA,stroke:#00838F
    style MEM_U fill:#EDE7F6,stroke:#512DA8
    style MEM_D fill:#EDE7F6,stroke:#512DA8
    style NEXT fill:#FFF8E1,stroke:#F57F17
    style OUT fill:#E8F5E9,stroke:#2E7D32
```

This is the core idea: a SKILL.md file uses `{{ref}}` syntax to pull in exactly the capabilities, instructions, and memory it needs — nothing more. The context model ensures only the active node's references are loaded, keeping total token usage under budget.
