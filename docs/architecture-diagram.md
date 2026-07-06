# AgentFlow — System Architecture Diagram

Current architecture (Gen-3 taxonomy, TypeScript monorepo, client-side export). This is the one
canonical architecture diagram — see `docs/planning/MASTER-PLAN.md` for the design rationale and
`docs/FEATURE-MAP.md` for the feature inventory.

```mermaid
graph TB
    subgraph USER["User Layer"]
        CLI["CLI (packages/cli/bin/cli.js)<br/>parse | validate | graph | tokens | dry-run<br/>export (walkable / platform / raw / parsed) | import | git | mcp"]
        Studio["Studio (Next.js + ReactFlow)<br/>visual canvas + markdown editor + panels"]
        Host["Host Agents<br/>(Kiro, Claude Code, Cursor, …)<br/>walk the exported directory"]
    end

    subgraph CORE["packages/core (browser-safe, zero Node deps)"]
        ParserCore["parser-core.ts<br/>ref extraction · graph build · resolveRef · identity assembly"]
        RefPaths["ref-paths.ts<br/>resolveRefsToPaths — {{refs}} → relative paths"]
        L0["export/l0-contract.ts<br/>root AGENTS.md generator"]
        Validator["validator/*<br/>schema · structure · refs · mcp"]
        Taxonomy["taxonomy.ts<br/>Gen-3: instructions · capabilities · skills · memory · hooks"]
        Schemas["schemas/*<br/>frontmatter validation (zod)"]
    end

    subgraph CLIPKG["packages/cli (Node)"]
        FsParser["parser.ts<br/>fs-walk → delegates to core"]
        Walkable["export/walkable-export.ts<br/>emit L0 + node dirs + output/ scaffold"]
        Engine["export/engine.ts<br/>platform transforms (configs/platforms/*.yaml)"]
        AgentSpec["export/agent-spec-transform.ts<br/>Agent Spec JSON (off critical path)"]
        Git["git/*  ·  mcp/*  ·  services/*"]
    end

    subgraph STUDIO["studio (Next.js)"]
        Canvas["Canvas · Editor · Validation/MCP/Git/Export panels"]
        ApiClient["lib/api.ts<br/>client-side: parse/validate/export in-browser"]
        Copilot["lib/copilot/*<br/>key-store · model-registry · system-prompt (minimal)"]
    end

    subgraph WS[".agentflow/ workspace — the format"]
        L0f["AGENTS.md — L0 identity (always)"]
        L1f["&lt;workflow&gt;/AGENTS.md — L1 routing"]
        L2f["&lt;workflow&gt;/&lt;node&gt;/SKILL.md — L2 contract"]
        L3f["instructions/ · capabilities/ · skills/ · memory/ · hooks/ — L3 refs"]
        L4f["&lt;node&gt;/output/ — L4 artifacts (never loaded)"]
        Mcp["mcp.json — MCP server config"]
    end

    subgraph REFS["Reference syntax"]
        Mention["{{category/name}} — mention"]
        Edge["{{-> target}} — edge"]
        Cond["{{-> target | condition}} — conditional edge"]
        Data["{{&lt;&lt; output.node}} — data flow"]
        Var["{{\$variable}} — export-time variable (planned, #46)"]
    end

    CLI --> FsParser
    FsParser --> ParserCore
    Studio --> ApiClient
    ApiClient --> ParserCore
    ApiClient --> RefPaths
    Studio --> Copilot

    ParserCore --> Taxonomy
    ParserCore --> Schemas
    Validator --> ParserCore
    RefPaths --> ParserCore

    CLI --> Walkable
    Walkable --> RefPaths
    Walkable --> L0
    CLI --> Engine
    Engine --> AgentSpec

    Walkable -->|writes| Host
    Engine -->|writes| Host

    FsParser -->|reads| WS
    ParserCore -.->|classifies| L3f
    L2f -.-> Mention
    L2f -.-> Edge
    L2f -.-> Cond
    L2f -.-> Data
    L0f -.-> Var
```

## How it fits together

The `.agentflow/` workspace (markdown in directories) is the source of truth. **`packages/core`**
(browser-safe, zero Node deps) parses it into a typed graph, classifies resources against the
Gen-3 taxonomy (5 categories), validates, and resolves `{{refs}}` to relative paths. **`packages/cli`**
is the Node I/O layer: it fs-walks a real workspace, and its export engine emits either a **walkable
directory** (L0 `AGENTS.md` + one dir per node with `SKILL.md` + `output/`, all refs resolved to
plain paths — the primary, host-agnostic output) or **platform-specific layouts** (config-driven by
`configs/platforms/*.yaml`). Agent Spec JSON export exists but is off the critical path.

The **studio** (Next.js + ReactFlow) runs parse/validate/export **client-side** in the browser via
`lib/api.ts` importing core — there is no server-side export route. The copilot layer is currently
minimal (key-store + model-registry + system-prompt).

The **5-layer context model** governs what a host agent loads at each step: L0 identity (always),
L1 routing, L2 node contract, L3 references (on demand), L4 artifacts (never loaded).
