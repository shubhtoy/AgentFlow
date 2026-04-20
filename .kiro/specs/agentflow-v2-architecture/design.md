# Design Document: AgentFlow v2 Architecture

## Overview

AgentFlow v2 restructures the platform into a single open-source npm package for authoring, exporting, and consuming AI agent workflows. It consolidates the codebase (eliminating duplicates between the old Fastify server and the Next.js app), uses the already-consolidated taxonomy (6 categories), rewrites the CLI, completes the bidirectional platform export engine, and defines two agent modes (Studio Agent for authoring, Playground Agent for testing).

The `.agentflow/` directory is the canonical workspace format. Users author workflows in the visual studio, then export them to IDE platforms (Kiro, Cursor, Claude Code, VS Code/Copilot, Windsurf) or to Oracle's Open Agent Spec JSON for runtime frameworks (LangGraph, AutoGen, CrewAI via `pyagentspec` adapters). AgentFlow generates Agent Spec JSON only, never Python code. The studio's own AI agent dogfoods the system — it consumes exported Agent Spec workflows converted to LangGraph via `pyagentspec`.

This spec absorbs and supersedes the `platform-export-engine` spec and the `cross-platform-transport` spec. The `taxonomy-consolidation` spec is already fully implemented.

### What's already done

- Taxonomy consolidation: 6 canonical categories (instructions, capabilities, runbooks, memory, hooks, identity) with `src/taxonomy.js` as single source of truth. All tasks complete.
- Parser updated: outputs `WorkflowGraph` with canonical keys only, scope inference via `inferScope()`.
- Example workspace migrated to canonical directories.
- Documentation updated.
- Transport layer prototyped: `src/transport/` has a working prototype of the config-driven adapter pattern (registry, factory, adapter, pipeline, transforms, platform configs for kiro/github/claude/langgraph). This validates the design but is legacy code tied to the old Fastify architecture. The platform-export-engine spec is the blueprint; the prototype proves the approach works.
- **Note:** The `next-app/` codebase (the current working app) does NOT have a transport layer. It has the taxonomy-consolidated parser, all services, git/mcp integration, but zero platform export code. The transport layer must be built new in the v2 package structure.
- **Dead code in next-app:** `services/steering-manager.js` (replaced by instruction-manager), `services/orchestrator-service.js`, `orchestrator.js` — all dead, to be deleted.

### What needs to be built for v2

- Package restructuring (single npm package, `next-app/` → `studio/`, code dedup)
- CLI rewrite
- Default export (universal directory format with resolved refs) — not yet implemented
- Transport layer rewrite (clean implementation of the platform-export-engine spec in the new package structure, using the prototype as reference)
- Hook Abstraction Layer (single class with mapping tables for per-platform hook translation)
- Fidelity Reporter (structured fidelity reports with ✅📋🔄📁 categories)
- Cursor platform config (separate from GitHub Actions)
- Windsurf platform config
- VS Code (Copilot) platform config (separate from GitHub Actions)
- Agent Spec (Tier 2) platform config (Oracle Open Agent Spec JSON)
- `detectPlatform()` auto-detection
- Studio Agent consuming exported Agent Spec → LangGraph workflows
- Playground Agent mode
- LangGraph optional mode

## Part 1: Package Structure

### Single npm package

One package, one `package.json`. The old `agentflow/` Fastify server code is archived to `_archive/agentflow-legacy/`. `next-app/` is the source of truth and becomes `studio/`.

```
agentflow/                           ← repo root, npm package root
├── bin/
│   └── cli.js                       ← rewritten CLI
├── src/
│   ├── parser.js                    ← single copy (from next-app/lib/)
│   ├── taxonomy.js                  ← already done, single source of truth
│   ├── validator.js
│   ├── dry-runner.js
│   ├── token-calculator.js
│   ├── branding.js
│   ├── schemas/
│   ├── services/
│   │   ├── workflow-service.js
│   │   ├── validation-service.js
│   │   ├── git-service.js
│   │   ├── mcp-bridge.js
│   │   ├── hook-registry.js
│   │   ├── event-hook-engine.js
│   │   ├── instruction-manager.js
│   │   ├── scaffold-gen-service.js
│   │   ├── template-service.js
│   │   └── types.js
│   ├── transport/                   ← rewrite from platform-export-engine spec
│   │   ├── export-pipeline.js       ← rewrite (prototype in legacy src/transport/)
│   │   ├── import-pipeline.js       ← rewrite
│   │   ├── transport-registry.js    ← rewrite
│   │   ├── platform-adapter.js      ← rewrite
│   │   ├── adapter-factory.js       ← rewrite
│   │   ├── schemas.js               ← rewrite
│   │   ├── transforms.js            ← rewrite (reuse transform logic from prototype)
│   │   ├── utils.js                 ← rewrite
│   │   ├── hook-abstraction-layer.js ← NEW: single class with mapping tables
│   │   ├── fidelity-reporter.js     ← NEW
│   │   └── platforms/
│   │       ├── kiro.json            ← rewrite (prototype exists)
│   │       ├── cursor.json          ← NEW
│   │       ├── claude-code.json     ← rewrite (prototype as claude.json)
│   │       ├── vscode-copilot.json  ← NEW
│   │       ├── windsurf.json        ← NEW
│   │       ├── github.json          ← rewrite (prototype exists)
│   │       └── agent-spec.json      ← NEW (Oracle Open Agent Spec — single Tier 2 output)
│   ├── git/                         ← existing git integration
│   ├── mcp/                         ← existing MCP integration
│   └── utils/
├── library/                         ← built-in resources (existing)
├── studio/                          ← Next.js app (from next-app/)
│   ├── app/api/                     ← thin wrappers, import from @agentflow/core
│   ├── components/
│   ├── lib/
│   │   ├── service-context.ts       ← imports from @agentflow/core
│   │   └── copilot/
│   │       ├── agent.ts             ← CopilotKit + Agent Spec integration
│   │       └── model-registry.ts
│   ├── store/
│   ├── tsconfig.json                ← paths: { "@agentflow/*": ["../src/*"] }
│   └── ...
├── _archive/agentflow-legacy/       ← old Fastify server (preserved)
├── examples/.agentflow/             ← already migrated to canonical taxonomy
├── docs/
├── langgraph.json
├── package.json
└── README.md
```

### What gets moved

| From | To | Notes |
|---|---|---|
| `next-app/lib/parser.js` | `src/parser.js` | next-app version is canonical, replaces legacy src/ version |
| `next-app/lib/taxonomy.js` | `src/taxonomy.js` | next-app version is canonical, replaces legacy src/ version |
| `next-app/lib/services/` | `src/services/` | next-app versions are canonical, replace legacy src/ versions |
| `next-app/lib/validator.js` | `src/validator.js` | next-app version is canonical |
| `next-app/lib/dry-runner.js` | `src/dry-runner.js` | next-app version is canonical |
| `next-app/lib/token-calculator.js` | `src/token-calculator.js` | next-app version is canonical |
| `next-app/lib/schemas/` | `src/schemas/` | next-app version is canonical |
| `next-app/lib/git/` | `src/git/` | Merge: next-app versions preferred where both exist |
| `next-app/lib/mcp/` | `src/mcp/` | Merge: next-app versions preferred where both exist |
| `next-app/` | `studio/` | Rename, `studio/lib/` becomes thin — imports from `src/` |
| `agentflow/` | `_archive/agentflow-legacy/` | Preserved, not used |
| `tests/` | `tests/` | Stays at root, update imports to test new `src/` code |
| `agentflow/tests/` | merge into `tests/` | Service tests (hook-registry, event-hook-engine, etc.) moved to root `tests/unit/` |

Rule: where `src/` and `next-app/lib/` both have the same file, `next-app/lib/` wins. The `src/` transport layer prototype code is preserved as reference but rewritten.

### What gets deleted

- `next-app/lib/orchestrator.js` — dead
- `next-app/lib/services/orchestrator-service.js` — dead
- `next-app/lib/services/steering-manager.js` — dead (replaced by instruction-manager)
- `next-app/app/api/orchestrator/` — dead
- Orchestrator key in `service-context.ts` — dead
- Duplicate parser/services in `next-app/lib/` after they're moved to `src/`

### Studio → src import strategy

The studio (Next.js app) imports from `src/` using TypeScript path aliases. No `../../` relative imports.

```json
// studio/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@agentflow/*": ["../src/*"]
    }
  }
}
```

```typescript
// studio/next.config.ts
const nextConfig = {
  transpilePackages: ['../src'],
}
```

```typescript
// studio/lib/service-context.ts
import { createWorkflowService } from '@agentflow/services/workflow-service'
import { createValidationService } from '@agentflow/services/validation-service'
```

### Workspace root resolution

```javascript
function resolveRoot() {
  if (process.env.AGENTFLOW_ROOT) return path.resolve(process.env.AGENTFLOW_ROOT)
  if (process.env._AGENTFLOW_CLI_ROOT) return path.resolve(process.env._AGENTFLOW_CLI_ROOT)
  let dir = process.cwd()
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, '.agentflow')
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate
    dir = path.dirname(dir)
  }
  return path.join(process.cwd(), '.agentflow')
}
```

### CLI (rewrite)

The existing `src/cli.js` references old paths and the old Fastify UI server. It will be rewritten to use the same `src/` modules, with the `dev` command starting the Next.js studio instead of the Fastify server, and the `export`/`import` commands using the transport pipeline with `--platform` flag.

#### Commands

| Command | Purpose | Implementation |
|---|---|---|
| `agentflow init [dir]` | Scaffold `.agentflow/` with canonical taxonomy dirs | Creates `instructions/`, `capabilities/`, `runbooks/`, `memory/`, `hooks/`, `AGENTS.md` |
| `agentflow dev [dir]` | Start Next.js studio (visual editor only) | Spawns `next dev` in `studio/` with `AGENTFLOW_ROOT` set |
| `agentflow dev --agent [dir]` | Start studio + LangGraph runtime | Spawns Next.js + LangGraph CLI concurrently (like current `dev:all`) |
| `agentflow parse [dir]` | Parse workspace, output JSON | Calls `parseRoot()`, outputs to stdout or `--output` file |
| `agentflow validate [dir]` | Validate refs and schemas | Calls `validate()`, prints errors/warnings, exits 1 on errors |
| `agentflow export [dir]` | Default export (resolved directory format) | Resolves refs to paths, copies to `--output` dir |
| `agentflow export --platform <name> [dir]` | Platform-specific export | Uses transport pipeline: `ExportPipeline.export(name, graph)` |
| `agentflow export --format <fmt> [dir]` | Format export (json/zip/share) | Raw workspace bundle in specified format |
| `agentflow import --platform <name> --source <dir>` | Platform-specific import | Uses transport pipeline: `ImportPipeline.import(name, sourceDir)` |
| `agentflow import --auto-detect --source <dir>` | Auto-detect platform and import | Calls `detectPlatform()` then `import()` |
| `agentflow graph [dir]` | Print ASCII graph | Parses and prints edge list |
| `agentflow tokens [dir]` | Calculate context token estimates | Calls `calculateTokens()` with scope options |
| `agentflow dry-run [dir]` | Simulate workflow execution | Calls `dryRun()` with workflow/branch options |
| `agentflow add <type> <name>` | Install resource from library | Copies from `library/` to workspace |
| `agentflow search <query>` | Search library + MCP registry | Unified search across local library and MCP registry |
| `agentflow library <action>` | Library management (index/list/search) | Manages `library/registry.json` |
| `agentflow git <subcommand>` | Git integration (init/scan/sync/status/resolve/config) | Delegates to git service |
| `agentflow mcp <subcommand>` | MCP server management (search/add/remove/discover/list) | Delegates to MCP services |

#### How `dev` works

```javascript
// bin/cli.js — dev command
const root = resolveRoot()
process.env.AGENTFLOW_ROOT = root

if (opts.agent) {
  // Start both Next.js and LangGraph concurrently
  spawn('npx', ['concurrently', '-k',
    `next dev --dir ${studioDir}`,
    `npx @langchain/langgraph-cli dev --port 2024`
  ])
} else {
  // Start Next.js only
  spawn('next', ['dev'], { cwd: studioDir })
}
```

#### How `export --platform` works

```javascript
// bin/cli.js — export command
const root = resolveRoot()
const graph = parseRoot(root)

if (opts.platform) {
  // Platform-specific export via transport pipeline
  const registry = new TransportRegistry()
  const factory = new AdapterFactory(builtInPlatformsDir, userTransportDir)
  factory.registerAll(registry)
  const result = await exportToPlatform(opts.platform, graph, { outputPath: opts.output }, registry)
  // Write result.files to output dir/zip/json
} else if (opts.format) {
  // Format export (json/zip/share) — raw workspace bundle
  const result = await exportService.exportWorkspace({ format: opts.format, outputPath: opts.output })
} else {
  // Default export — resolved directory format
  const result = await defaultExport(graph, { outputPath: opts.output })
}
```

## Part 2: Taxonomy (already implemented)

The taxonomy consolidation is complete. 6 canonical categories, single `src/taxonomy.js` registry, parser outputs canonical graph, all services/UI/CLI updated. See `taxonomy-consolidation` spec tasks — all marked done.

| Category | Directory | Absorbs | Scope differentiation |
|---|---|---|---|
| instructions | `instructions/` | skills + steering | `scope: workflow` vs `scope: global` |
| capabilities | `capabilities/` | tools + protocols | `scope: descriptor` vs `scope: config` |
| runbooks | `runbooks/` | interactions + templates | `scope: interaction` vs `scope: condition` |
| memory | `memory/` | unchanged | — |
| hooks | `hooks/` | unchanged | — |
| identity | `AGENTS.md` | unchanged | singular file |

## Part 3: Two Agent Modes

### Studio Agent (authoring)

- The studio's built-in AI agent consumes exported Agent Spec JSON via CopilotKit
- CopilotKit has native Agent Spec support (AG-UI integration) — no custom JS reader needed
- At runtime, CopilotKit uses LangGraph as the execution backend for Agent Spec workflows
- Workflows like `agent-builder`, `help`, `author` are authored in `.agentflow/`, exported to Agent Spec JSON, and fed to CopilotKit which runs them via LangGraph
- This is dogfooding: the agent that helps build workflows is itself an AgentFlow workflow, exported through the same pipeline
- Scoped to `.agentflow/` only via `safePath()` for workspace operations
- Tools: `readWorkspaceFile`, `listWorkspaceDirectory`, `searchWorkspace`, plus frontend tools

### Playground Agent (testing)

- Also consumes an exported workflow via Agent Spec JSON → CopilotKit → LangGraph
- The workflow the user just built gets exported to Agent Spec, then run through CopilotKit/LangGraph
- Scoped to whatever the workflow's MCP servers and capabilities declare
- Tools wired from the workflow's capabilities + MCP bridge
- Separate chat interface in the studio UI
- Activated when user clicks "Test" on a workflow
- `safePath()` boundary expands to the project root

### LangGraph as runtime

- LangGraph is the execution runtime consumed by CopilotKit for running Agent Spec workflows
- `npx agentflow dev` starts only the Next.js studio — no agent runtime
- `npx agentflow dev --agent` starts studio + LangGraph runtime (CopilotKit connects to it)
- Without the agent runtime: visual editor, validation, dry-run, token calculator, export, import all work
- Chat panel shows "AI agent not available" when LangGraph runtime is unreachable


## Part 4: Platform Export Engine (full spec)

This section is the complete design for the transport layer, absorbed from the `platform-export-engine` spec. The legacy `src/transport/` prototype validates the approach; this is the blueprint for the v2 rewrite.

### Core principle

Nothing gets skipped. Every AgentFlow file maps to something on every platform. Fidelity categories:
- ✅ **Native** — mapped to the platform's native format
- 📋 **On-demand** — available as reference files the agent reads when needed
- 🔄 **Translated** — format converted (hooks, MCP config)
- 📁 **Preserved** — copied as-is to the target

### Selective context preservation

Each SKILL.md node has `context.inputs` with specific refs at specific scopes, and `exclude` lists. This selective loading is preserved across all export types — default, Tier 1, and Tier 2.

Only `AGENTS.md` and `instructions/*.md` with `inclusion: auto` become always-loaded. Everything else is on-demand, using each platform's native mechanism:
- Kiro: `inclusion: manual` steering files
- Cursor: `.mdc` rules with `alwaysApply: false` (agent-requested)
- Windsurf: `.md` rules with `trigger: model_decision`
- Claude Code: `.claude/skills/` (loaded on demand)
- VS Code: `.github/instructions/*.instructions.md` (path-scoped)
- Default export: files stay as separate on-demand files in the directory structure

### Tiers

**Default export (universal directory format)** — the `.agentflow/` directory structure with all refs resolved, context layers flattened, instructions inlined into SKILL.md files. This is the standard portable agent output. Any AI tool that reads markdown files can consume it without needing the AgentFlow parser. This is what `npx agentflow export` produces with no `--platform` flag.

The default export preserves selective context — it does NOT dump everything as always-loaded:

| AgentFlow Source | What it becomes | Why |
|---|---|---|
| `AGENTS.md` (root) | Always-loaded identity/instructions | Always on |
| `instructions/*.md` (global, `inclusion: auto`) | Always-loaded rules | These ARE meant to be always-on |
| `instructions/*.md` (workflow, no inclusion) | On-demand reference files | NOT always loaded — only when a SKILL.md references them |
| `capabilities/*.md` | On-demand reference files | Loaded by SKILL.md `context.inputs`, not globally |
| `runbooks/*.md` | On-demand reference files | Loaded by SKILL.md `context.inputs`, not globally |
| `memory/*.md` | On-demand reference files | Loaded at session start per SKILL.md |
| `hooks/*.json` | Preserved as-is | Event automation |
| `mcp.json` | Preserved as-is | Tool connections |
| `<workflow>/` (entire directory) | Kept as directory structure | The SKILL.md files handle their own context loading |

Only TWO things become "always loaded": root `AGENTS.md` and `instructions/*.md` with `inclusion: auto`. Everything else stays as files the agent reads when needed. The SKILL.md `context.inputs` with specific refs at specific scopes, and `exclude` lists, are preserved — not flattened away.

The default export:
- Resolves `{{ref}}` syntax in SKILL.md files → replaces with file path references (e.g. `{{instructions/code-search}}` → `instructions/code-search.md`) so the output doesn't depend on the AgentFlow parser
- No content inlining — refs become paths only, the referenced files exist in the output directory
- Preserves the directory structure (workflows, nodes, resources)
- Preserves `context.inputs` scope declarations and `context.exclude` lists in frontmatter
- Preserves `AGENTS.md` identity and workflow descriptors
- Preserves `mcp.json` and `hooks/*.json` as-is
- All referenced files are guaranteed to exist in the output directory
- Output is a self-contained directory that works without the AgentFlow parser

**Tier 1** — IDE platforms (Kiro, Cursor, Claude Code, VS Code/Copilot, Windsurf): bidirectional export + import. Translates the workspace into each platform's native file layout.

**Tier 2** — Runtime frameworks: Oracle Open Agent Spec JSON. The official `pyagentspec` package has adapters for LangGraph, AutoGen, CrewAI. AgentFlow generates Agent Spec JSON only, never Python code. The legacy prototype had a `langgraph.json` config that generated Python directly — that approach is replaced by Agent Spec as the single Tier 2 output format.

### Components

| Component | Purpose |
|---|---|
| `ExportPipeline` | Orchestrates export: resolve adapter → delegate → validate output → build fidelity report |
| `ImportPipeline` | Orchestrates import: resolve adapter → delegate → validate AgentFlow layout → build report. Includes `detectPlatform()` auto-detection. |
| `TransportRegistry` | Registry of platform adapters keyed by name. Enforces uniqueness. Filters by capability (export-only vs bidirectional). |
| `PlatformAdapter` | Single generic class. Reads export/import rules from JSON config, applies transforms. No subclasses. |
| `AdapterFactory` | Discovers platform configs (built-in + user overrides in `.agentflow/transport/`), deep-merges, validates with zod, creates adapters. Adding a new platform = dropping a JSON file. |
| `TransformRegistry` | Named transform functions referenced by string in platform configs. |
| `HookAbstractionLayer` | Single class with `HOOK_EVENT_MAP`, `HOOK_ACTION_MAP`, `HOOK_STRUCTURE_MAP` as internal lookup tables. No per-platform adapter subclasses. |
| `FidelityReporter` | Builds human-readable + machine-readable fidelity report. No "skip" category. |

### Platform config schema

```javascript
const PlatformConfigSchema = z.object({
  name: z.string().min(1),
  displayName: z.string(),
  version: z.string().default('1.0.0'),
  tier: z.enum(['ide', 'runtime']),
  capabilities: z.array(z.enum(['export', 'import'])),
  detectMarkers: z.array(z.string()).optional(),
  exportRules: z.array(ExportRuleSchema),
  importRules: z.array(ImportRuleSchema).optional(),
});

const ExportRuleSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.enum(['single-file', 'glob-copy', 'glob-transform', 'merge-into', 'passthrough']),
  fidelity: z.enum(['native', 'on-demand', 'translated', 'preserved']),
  transform: z.string().optional(),
  note: z.string().optional(),
  contextMode: z.enum(['always-loaded', 'on-demand']).optional(),
  mergeTarget: z.string().optional(),
});

const ImportRuleSchema = z.object({
  platformPath: z.string(),
  agentflowTarget: z.string(),
  type: z.enum(['single-file', 'glob-transform', 'extract-from', 'passthrough']),
  fidelity: z.enum(['native', 'on-demand', 'translated', 'preserved']),
  reverseTransform: z.string().optional(),
  note: z.string().optional(),
});
```

### Built-in transforms

| Transform | Direction | Purpose |
|---|---|---|
| `md-to-mdc-always` | export | Markdown → Cursor .mdc with `alwaysApply: true` |
| `md-to-mdc-agent-requested` | export | Markdown → Cursor .mdc with `alwaysApply: false` |
| `mdc-to-md` | import | Cursor .mdc → markdown |
| `identity-to-claude-md` | export | AGENTS.md → CLAUDE.md |
| `claude-md-to-identity` | import | CLAUDE.md → AGENTS.md |
| `instruction-to-claude-skill` | export | Instruction → `.claude/skills/` |
| `claude-skill-to-instruction` | import | `.claude/skills/` → instruction |
| `identity-to-windsurf-rule` | export | AGENTS.md → `.windsurf/rules/identity.md` |
| `identity-to-kiro-steering` | export | AGENTS.md → `.kiro/steering/identity.md` |
| `instructions-append-to-claude-md` | export | Merge auto instructions into CLAUDE.md |
| `instructions-to-copilot-instructions` | export | Merge auto instructions into `.github/copilot-instructions.md` |
| `mcp-remap` | export | mcp.json → platform-specific MCP config |
| `mcp-reverse` | import | Platform MCP config → mcp.json |
| `graph-to-agent-spec` | export | Workflow graph → Agent Spec JSON |
| `workflow-to-skill-dirs` | export | Workflow → SKILL.md directory structure |
| `workflow-to-claude-skills` | export | Workflow → `.claude/skills/` structure |
| `capability-to-mdc` | export | Capability → Cursor .mdc (agent-requested) |
| `runbook-to-mdc` | export | Runbook → Cursor .mdc (agent-requested) |
| `hooks-to-instructions` | export | Hooks → natural language instructions (for platforms without hook support) |

### Complete platform mapping (all platforms)

| AgentFlow Concept | Kiro | Cursor | Claude Code | VS Code (Copilot) | Windsurf | Agent Spec |
|---|---|---|---|---|---|---|
| `AGENTS.md` (identity) | `.kiro/steering/identity.md` (auto) | `AGENTS.md` (native) | `CLAUDE.md` | `AGENTS.md` (native) | `.windsurf/rules/identity.md` (always_on) | `spec.description` + top-level agent |
| `instructions/*.md` (auto/global) | `.kiro/steering/{name}.md` (auto) | `.cursor/rules/{name}.mdc` (alwaysApply:true) | Append to `CLAUDE.md` | `.github/copilot-instructions.md` (merged) | `.windsurf/rules/{name}.md` (always_on) | Embedded in agent `systemPrompt` |
| `instructions/*.md` (workflow/skill) | `.kiro/steering/{name}.md` (manual) | `.cursor/rules/{name}.mdc` (agent-requested) | `.claude/skills/{name}/SKILL.md` | `.github/instructions/{name}.instructions.md` | `.windsurf/rules/{name}.md` (model_decision) | Embedded in node agent `systemPrompt` |
| `capabilities/*.md` (builtin) | `.kiro/steering/capabilities/{name}.md` (manual) | `.cursor/rules/{name}.mdc` (agent-requested) | `.claude/skills/{name}/context/capabilities.md` | `.github/instructions/{name}.instructions.md` | `.windsurf/rules/{name}.md` (model_decision) | Agent Spec `Tool` (type: builtin) |
| `capabilities/*.md` (script) | `.kiro/steering/capabilities/{name}.md` (manual) | `.cursor/rules/{name}.mdc` (agent-requested) | `.claude/skills/{name}/context/capabilities.md` | `.github/instructions/{name}.instructions.md` | `.windsurf/rules/{name}.md` (model_decision) | Agent Spec `ServerTool` (type: script) |
| `capabilities/*.md` (mcp) | `.kiro/steering/capabilities/{name}.md` (manual) | `.cursor/rules/{name}.mdc` (agent-requested) | `.claude/skills/{name}/context/capabilities.md` | `.github/instructions/{name}.instructions.md` | `.windsurf/rules/{name}.md` (model_decision) | Agent Spec `MCPTool` + `MCPToolBox` |
| `runbooks/*.md` (condition) | `.kiro/steering/runbooks/{name}.md` (manual) | `.cursor/rules/{name}.mdc` (agent-requested) | `.claude/skills/{name}/context/runbooks.md` | `.github/instructions/{name}.instructions.md` | `.windsurf/rules/{name}.md` (model_decision) | `BranchingNode` mapping in Flow |
| `runbooks/*.md` (interaction) | `.kiro/steering/runbooks/{name}.md` (manual) | `.cursor/rules/{name}.mdc` (agent-requested) | `.claude/skills/{name}/context/runbooks.md` | `.github/instructions/{name}.instructions.md` | `.windsurf/rules/{name}.md` (model_decision) | `InputMessageNode` (human-in-the-loop) |
| `memory/*.md` | `.kiro/memory/{name}.md` | `memory/{name}.md` | `memory/{name}.md` | `memory/{name}.md` | `memory/{name}.md` | `spec.context` / preserved files |
| `hooks/*.json` | `.kiro/hooks/{name}.json` (translated) | `hooks/{name}.json` (preserved) | `.claude/settings.json` → hooks[] (translated) | `.github/hooks/{name}.json` (native) | `hooks/{name}.json` (preserved) | Not mapped (preserved as files) |
| `mcp.json` | `.kiro/settings/mcp.json` | `.cursor/mcp.json` | `.claude/settings.json` → mcpServers | `.vscode/mcp.json` | `.windsurf/mcp.json` | `MCPTool`/`MCPToolBox` + `StdioTransport`/`SSETransport` |
| `<workflow>/AGENTS.md` | `.kiro/specs/{name}/design.md` | `.cursor/rules/{name}.mdc` (agent-requested) | `.claude/skills/{name}/SKILL.md` | `.github/instructions/{name}.instructions.md` | `.windsurf/rules/{name}.md` (model_decision) | Agent Spec `Flow` definition |
| `<workflow>/*/SKILL.md` (step) | `.kiro/specs/{name}/tasks/` or SKILL.md dirs | SKILL.md dirs (native) | `.claude/skills/{wf}-{node}/SKILL.md` | SKILL.md dirs (native) | SKILL.md dirs (native) | `AgentNode` in Flow |
| `<workflow>/*/SKILL.md` (router) | `.kiro/specs/{name}/tasks/` | SKILL.md dirs (native) | `.claude/skills/{wf}-{node}/SKILL.md` | SKILL.md dirs (native) | SKILL.md dirs (native) | `BranchingNode` in Flow |
| `custom/*` (arbitrary files) | Copy as-is | Copy as-is | Copy as-is | Copy as-is | Copy as-is | Preserved as files |

### Fidelity summary per platform

| Fidelity | Kiro | Cursor | Claude Code | VS Code | Windsurf | Agent Spec |
|---|---|---|---|---|---|---|
| ✅ Native | identity, instructions (auto), workflows | identity, instructions (auto), SKILL.md, AGENTS.md | identity, instructions, skills, workflows | identity, instructions, SKILL.md, AGENTS.md, hooks | identity, instructions (auto), SKILL.md | identity, instructions, capabilities, workflows |
| 📋 On-demand | instructions (workflow), capabilities, runbooks | instructions (workflow), capabilities, runbooks | capabilities, runbooks (in skill context/) | instructions (workflow), capabilities, runbooks | instructions (workflow), capabilities, runbooks | interactions (as instructions) |
| 🔄 Translated | hooks, mcp | mcp | hooks, mcp | mcp | mcp | conditions, interactions, mcp |
| 📁 Preserved | memory, custom | memory, hooks, custom | memory, custom | memory, custom | memory, hooks, custom | memory, hooks, custom |

### Selective context degradation per platform

| Feature | AgentFlow | Kiro | Cursor | Claude Code | VS Code | Windsurf | Agent Spec |
|---|---|---|---|---|---|---|---|
| On-demand loading | Deterministic (`context.inputs`) | Manual (`#` mention) | AI-decided (description match) | On-demand (skill loading) | Path-scoped (file match) | AI-decided (model_decision) | Deterministic (Flow state) |
| Scope granularity | full/signature/summary/metadata | full only | full only | full only | full only | full only | full (system prompt) |
| Exclude lists | Deterministic | Not enforced | Not enforced | Not enforced | Not enforced | Not enforced | Enforced (Flow routing) |
| Token budget | Per-node `max_tokens` | No equivalent | No equivalent | No equivalent | No equivalent | No equivalent | No equivalent |
| Execution order | Graph edges (enforced) | Prompt text (advisory) | Prompt text (advisory) | Prompt text (advisory) | Prompt text (advisory) | Prompt text (advisory) | Graph edges (enforced ✅) |
| Data flow | `{{<< output.X}}` resolved | File path in text | File path in text | File path in text | File path in text | File path in text | `DataFlowEdge` (enforced ✅) |
| Conditional routing | `{{-> X \| condition}}` | Prompt text | Prompt text | Prompt text | Prompt text | Prompt text | `BranchingNode` + `ControlFlowEdge` (enforced ✅) |

Agent Spec is the only target that preserves execution order, data flow, and conditional routing because it has an actual graph runtime (`Flow` with `ControlFlowEdge` + `DataFlowEdge`). All IDE platforms degrade these to prompt-level instructions that the agent follows voluntarily.

### Hook Abstraction Layer

Single `HookAbstractionLayer` class with internal mapping tables. No per-platform adapter subclasses. Called by hook transforms in the transform registry.

**Canonical format** uses PascalCase events and `command`/`prompt` action types, aligned with Claude Code/VS Code de facto standard.

**Event mapping:**

**Event mapping:**

| Canonical (PascalCase) | Kiro (camelCase) | Claude Code | VS Code | Cursor/Windsurf |
|---|---|---|---|---|
| `PreToolUse` | `preToolUse` | `PreToolUse` | `PreToolUse` | passthrough |
| `PostToolUse` | `postToolUse` | `PostToolUse` | `PostToolUse` | passthrough |
| `Stop` | `agentStop` | `Stop` | `Stop` | passthrough |
| `UserPromptSubmit` | `promptSubmit` | `UserPromptSubmit` | `UserPromptSubmit` | passthrough |
| `PreCompact` | — | `PreCompact` | `PreCompact` | passthrough |
| `SubagentStart` | — | `SubagentStart` | `SubagentStart` | passthrough |
| `SubagentStop` | — | `SubagentStop` | `SubagentStop` | passthrough |
| `FileEdited` | `fileEdited` | — | — | passthrough |
| `FileCreated` | `fileCreated` | — | — | passthrough |
| `FileDeleted` | `fileDeleted` | — | — | passthrough |

**Action mapping:**

| Canonical | Kiro | Claude Code / VS Code | Cursor/Windsurf |
|---|---|---|---|
| `command` | `runCommand` | `command` | passthrough |
| `prompt` | `askAgent` | `prompt` | passthrough |

**Structure mapping:**

| Platform | Format |
|---|---|
| Kiro | Individual `.kiro/hooks/{name}.json` files |
| Claude Code | Array in `.claude/settings.json` → `hooks[]` |
| VS Code | Individual `.github/hooks/{name}.json` files |
| Cursor/Windsurf | Passthrough as `hooks/{name}.json` (reference only) |

**Translation flow:**
```
AgentFlow hook → toCanonical() → CanonicalHook → fromCanonical(platform) → Platform hook
Platform hook  → fromPlatform(platform) → CanonicalHook → toAgentFlow() → AgentFlow hook
```

**Validation rules:**
- Every hook MUST appear in output — no silent drops
- Untranslatable events produce a warning + hook is preserved
- Round-trip: AgentFlow → Canonical → Platform → Canonical → AgentFlow preserves all semantic content
- Platform-specific fields preserved in `_platformExtensions` during import

### Fidelity report

```javascript
const FidelityReport = {
  platform: string,
  direction: 'export' | 'import',
  entries: FidelityEntry[],  // { source, target, fidelity, note }
  summary: { native: number, onDemand: number, translated: number, preserved: number },
  markdown: string,
}
```

No "skip" category. `summary.native + onDemand + translated + preserved === entries.length`.

### Key functions with formal specifications

**ExportPipeline.export()** — Preconditions: platformName registered, graph valid and validated, adapter supports export. Postconditions: files contain only relative paths, every workspace file in exactly one fidelity category, no "skip" entries, no side effects on input graph.

**ImportPipeline.import()** — Preconditions: platformName registered, sourceDir readable, adapter supports import. Postconditions: files form valid AgentFlow layout, AGENTS.md present (or warning), dryRun writes nothing, no partial output on failure.

**PlatformAdapter.exportWorkspace()** — Preconditions: config rules valid, transforms registered, graph valid. Postconditions: files keys are relative paths, fidelityEntries covers all matched rules, no filesystem I/O. Loop invariant: every file in input graph accounted for in at least one fidelity entry.

**PlatformAdapter.importWorkspace()** — Preconditions: import rules valid, sourceDir readable, transforms registered. Postconditions: files are valid AgentFlow paths, hooks translated through HAL, MCP normalized. Loop invariant: no conflicting output for same target path.

**HookAbstractionLayer.translateForExport()** — Preconditions: hooks valid, platform supported. Postconditions: all hooks included (none dropped), warnings for untranslatable features, passthrough for Cursor/Windsurf.

**HookAbstractionLayer.translateForImport()** — Preconditions: platform hooks in source format. Postconditions: all hooks converted to AgentFlow format, platform-specific fields preserved in `_platformExtensions`.

**ImportPipeline.detectPlatform()** — Preconditions: projectDir readable. Postconditions: returns platform name or null, most specific markers win, pure function.

**graphToAgentSpec()** — Preconditions: graph has at least one workflow with nodes and edges. Postconditions: each workflow → one Agent Spec Flow, each node → one Agent Spec Agent, each capability → one Agent Spec Tool, edge conditions → routing logic, hooks preserved as files (Agent Spec v26.1.0 has no hooks concept).

## Part 5: Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Workspace root resolution priority

*For any* combination of environment variables (`AGENTFLOW_ROOT`, `_AGENTFLOW_CLI_ROOT`) and directory structure, `resolveRoot()` should return the workspace root following the priority chain: `AGENTFLOW_ROOT` > `_AGENTFLOW_CLI_ROOT` > walk-up search for `.agentflow/` > default `cwd/.agentflow/`.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 2: No file loss in parsing

*For any* valid `.agentflow/` workspace directory, `parseRoot(dir)` should account for every `.md` file in exactly one of: a canonical category, `customFiles`, or a workflow node — with no file appearing in more than one bucket and no file missing.

**Validates: Requirement 6.1**

### Property 3: Idempotent parsing

*For any* valid `.agentflow/` workspace directory, calling `parseRoot(dir)` twice without changes should produce identical `WorkflowGraph` output.

**Validates: Requirement 6.2**

### Property 4: Canonical keys and valid scopes

*For any* valid `.agentflow/` workspace, the `WorkflowGraph` produced by `parseRoot()` should contain only canonical keys from the Taxonomy_Registry, and every resource entry in instructions, capabilities, and runbooks should have a `.scope` value that is valid for its category.

**Validates: Requirements 5.4, 6.3**

### Property 5: Export path safety

*For any* WorkflowGraph and any platform config, all output file paths produced by `ExportPipeline.export()` should be relative paths containing no `..` traversal segments and no absolute path prefixes.

**Validates: Requirements 8.2, 21.1, 21.2, 21.3**

### Property 6: Complete fidelity coverage

*For any* WorkflowGraph and any platform config, every workspace file should appear in exactly one fidelity category (native, on-demand, translated, or preserved) in the FidelityReport, with `summary.native + summary.onDemand + summary.translated + summary.preserved === entries.length` and zero "skip" entries.

**Validates: Requirements 8.3, 8.4, 16.2, 16.3**

### Property 7: Export immutability

*For any* WorkflowGraph, calling `ExportPipeline.export()` should not modify the input graph — the graph should be deep-equal before and after the export operation.

**Validates: Requirement 8.5**

### Property 8: Default export ref resolution

*For any* workspace containing `{{ref}}` syntax in SKILL.md files, the default export should resolve all refs to file path references, and every referenced file path should point to a file that exists in the output directory.

**Validates: Requirements 7.1, 7.6, 22.3**

### Property 9: Default export selective context

*For any* default export, only `AGENTS.md` and `instructions/*.md` files with `inclusion: auto` should be classified as always-loaded; all other resources should remain on-demand.

**Validates: Requirements 7.8, 14.1**

### Property 10: Hook no-drop guarantee

*For any* set of AgentFlow hooks and any target platform, `HookAbstractionLayer.translateForExport()` should produce output containing every input hook — the output count should equal the input count with zero silent drops.

**Validates: Requirements 15.4**

### Property 11: Hook round-trip fidelity

*For any* valid AgentFlow hook, exporting to a platform format and then importing back should preserve all semantic content (event type, action type, and configuration).

**Validates: Requirements 15.7, 22.2**

### Property 12: Full export-import round-trip

*For any* valid `.agentflow/` workspace and any Tier 1 platform, exporting and then importing back should preserve all resources with correct categories and scopes.

**Validates: Requirement 22.1**

### Property 13: Transport registry uniqueness

*For any* sequence of adapter registrations, the TransportRegistry should reject duplicate platform names and maintain exactly one adapter per name.

**Validates: Requirement 10.1**

### Property 14: Config deep-merge precedence

*For any* pair of built-in and user override platform configs, the AdapterFactory deep-merge should produce a result where user override values take precedence over built-in values at every level.

**Validates: Requirement 10.4**

### Property 15: Platform auto-detection

*For any* project directory containing platform-specific marker files, `detectPlatform()` should return the correct platform name matching the most specific markers, or null when no markers match.

**Validates: Requirement 9.6**

### Property 16: Import produces valid AgentFlow layout

*For any* valid platform source directory and registered platform, `ImportPipeline.import()` should produce files that form a valid AgentFlow layout with no conflicting target paths.

**Validates: Requirements 9.2, 11.5**

### Property 17: Import atomicity

*For any* import that fails partway through processing, the ImportPipeline should produce no partial output — either the full result is returned or nothing is written.

**Validates: Requirement 9.5**

### Property 18: safePath boundary enforcement

*For any* file path, `safePath()` in Studio Agent mode should reject paths outside `.agentflow/`, and in Playground Agent mode should reject paths outside the project root.

**Validates: Requirements 18.2, 19.6**

### Property 19: Agent Spec structural mapping

*For any* WorkflowGraph with workflows, nodes, capabilities, and edges, the Agent Spec export should map each workflow to one Flow, each node to one Agent, each capability to one Tool, and edge conditions to routing logic with `ControlFlowEdge`, `DataFlowEdge`, and `BranchingNode` preserved.

**Validates: Requirements 13.4, 14.3**

### Property 20: Init scaffolding completeness

*For any* valid target directory, `agentflow init` should produce a `.agentflow/` directory containing all 6 canonical taxonomy directories (`instructions/`, `capabilities/`, `runbooks/`, `memory/`, `hooks/`) and an `AGENTS.md` file.

**Validates: Requirement 4.1**

### Property 21: Validate exit code correctness

*For any* workspace, `agentflow validate` should exit with code 0 when no errors are present and exit with code 1 when validation errors exist.

**Validates: Requirement 4.5**

## Part 6: Testing Strategy

Tests live at the repo root `tests/` directory, testing `src/` code. The existing test suite (`tests/unit/`, `tests/integration/`, `tests/generators/`) covers parser, taxonomy, transport, git, mcp, and CLI. Service tests from `agentflow/tests/` (hook-registry, event-hook-engine, export-service, import-service, instruction-manager) are migrated to `tests/unit/`.

**Unit tests** (`tests/unit/`):
- Parser: ref extraction, classification, scope inference, canonical graph output (existing)
- Taxonomy: registry lookups, scope inference, derived constants (existing)
- Transport: each transform function, platform adapter with mock configs (existing prototype, rewrite for v2)
- Hook Abstraction Layer: event/action mapping for each platform, round-trip translation
- Fidelity Reporter: summary counts, markdown output
- Services: workflow-service, validation-service, hook-registry, instruction-manager (migrate from `agentflow/tests/`)

**Integration tests** (`tests/integration/`):
- Taxonomy consolidation: parse example workspace → verify canonical graph (existing)
- Transport E2E: parse → export to each platform → verify all files present, no drops (existing prototype, extend for v2)
- Round-trip: parse → export to platform → import back → verify graph equality (for each Tier 1 platform)
- Default export: parse → default export → verify directory structure, resolved refs, selective context preserved
- Agent Spec: parse → export to Agent Spec → validate against Agent Spec JSON schema

**Property tests** (`tests/property/`):
- Scope inference determinism: random frontmatter + valid category → consistent result
- No file loss: random workspace file tree → parseRoot accounts for every file
- Complete export: random graph + any platform config → verifyCompleteExport returns true

Test runner: vitest (config at `vitest.config.js`).
