# Design Document: MCP Discovery, Tool Resolution & Orchestrator Refactoring

## Overview

This feature adds three interconnected capabilities to AgentFlow:

1. **MCP Registry Integration** — Search, add, and discover tools from the official MCP registry (registry.modelcontextprotocol.io)
2. **MCP Runtime Support** — The orchestrator can connect to MCP servers and execute MCP tools during workflow execution
3. **Orchestrator Refactoring** — Clean ToolProvider abstraction replacing the inline `BUILTIN_EXECUTORS` / `buildToolEntry` mess

The core principle remains: `.agentflow/` workspaces are platform-agnostic markdown. Any agent can consume them. The orchestrator is the reference runtime that proves the format works end-to-end, including MCP tool execution.

## How Any Agent Consumes AgentFlow

The format is designed so that any agent — Kiro, Cursor, Claude Code, or our orchestrator — follows the same pattern:

```
1. Read root AGENTS.md → identity, constraints, workflow list
2. Follow edges to current node → read SKILL.md
3. Resolve {{skills/...}} refs → load as context
4. See {{tools/...}} refs → map to own tool implementations
   - builtin tools (read-code, write-file) → agent already has these
   - mcp tools → agent connects to MCP server using its own MCP client
   - script tools → agent runs the command
5. Do the work described in the node instructions
6. Follow routing edges → evaluate conditions → advance to next node
```

The `.agentflow/mcp.json` file is the contract that tells any consuming agent what MCP servers are required. It's like `package.json` for MCP dependencies:

```
Agent opens .agentflow/ workspace
  → reads mcp.json
  → sees required: true servers
  → checks own MCP config
    → has them → proceed
    → missing → error: "This workflow requires MCP server X. Install info: ..."
```

Our orchestrator does exactly this — but programmatically. It IS the agent.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Official MCP Registry                     │
│         registry.modelcontextprotocol.io/v0.1/servers       │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP GET (search, list)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   MCP Registry Client                        │
│  searchRegistry(query) → server metadata                     │
│  getServerDetails(name) → packages, remotes, description     │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
┌──────────────────────┐  ┌──────────────────────────────────┐
│   mcp.json Manager   │  │     MCP Server Lifecycle         │
│  add/remove servers  │  │  spawn stdio / connect HTTP+SSE  │
│  load/save config    │  │  call tools/list (discovery)     │
│  feature gates       │  │  call tools/call (execution)     │
└──────────┬───────────┘  └──────────────┬───────────────────┘
           │                             │
           ▼                             ▼
┌──────────────────────┐  ┌──────────────────────────────────┐
│ .agentflow/mcp.json  │  │     Tool Scaffolder              │
│ server declarations  │  │  tools/list → tool .md files     │
│ with install info    │  │  inputSchema → parameters FM     │
│ required flags       │  │  (authoring-time only)           │
└──────────────────────┘  └──────────────┬───────────────────┘
                                         │
                                         ▼
                          ┌──────────────────────────────────┐
                          │  .agentflow/tools/*.md            │
                          │  (hand-authored + MCP-discovered) │
                          └──────────────────────────────────┘
                                         │
                          ┌──────────────┴───────────────────┐
                          ▼                                  ▼
                    parseRoot()                      Orchestrator
                    (existing)                    (refactored runtime)
```

## Part 1: MCP Discovery (Authoring Time)

### User Flows

```bash
# Search the official registry
agentflow mcp search "github"
→ io.github.modelcontextprotocol/github — GitHub API (npm, stdio)

# Add a server to the workspace
agentflow mcp add io.github.modelcontextprotocol/github
→ Added to .agentflow/mcp.json

# Discover tools by spinning up the server temporarily
agentflow mcp discover io.github.modelcontextprotocol/github
→ Starting server... connected
→ Found 8 tools: create_issue, list_issues, ...
→ Scaffolded 8 tool files in .agentflow/tools/
→ Server stopped.

# Now use in workflows: {{tools/github-create-issue}}
```

### mcp.json Schema

The format follows the de facto `mcp.json` standard used by Claude Desktop, Cursor, VS Code, Kiro, and other MCP clients. The core fields (`command`, `args`, `env`) are the standard — any MCP client can read this file and connect to the servers. AgentFlow adds extension fields (`required`, `description`, `discoveredTools`, `registry`, `version`) that other clients simply ignore.

This means `.agentflow/mcp.json` is both:
- A standard MCP config file (readable by any MCP-aware agent)
- An AgentFlow feature gate manifest (enforceable by our orchestrator)

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${env:GITHUB_TOKEN}"
      },
      "required": true,
      "description": "GitHub API integration",
      "registry": "modelcontextprotocol",
      "registryName": "io.github.modelcontextprotocol/github",
      "version": "2025.11.28",
      "discoveredTools": ["github-create-issue", "github-list-issues"]
    },
    "analytics": {
      "url": "https://analytics.example.com/mcp",
      "env": {},
      "required": false,
      "description": "Real-time analytics",
      "discoveredTools": ["analytics-query-metrics"]
    }
  }
}
```

Standard fields (understood by any MCP client):
- `command` + `args` — how to spawn a stdio server (standard)
- `url` — streamable-http or SSE remote endpoint (standard)
- `env` — environment variables, supports `${env:VAR}` tokens (standard)

AgentFlow extension fields (ignored by other clients, enforced by our orchestrator):
- `required` — feature gate: workflow won't run without this server
- `description` — human-readable purpose
- `registry` — which registry this came from (e.g. `"modelcontextprotocol"`)
- `registryName` — full qualified name in the registry
- `version` — server version from registry
- `discoveredTools` — which tool `.md` files were generated from this server

### Generated Tool .md File

```yaml
---
name: github-create-issue
type: mcp
mcp: io.github.modelcontextprotocol/github
description: Create a new issue in a GitHub repository
parameters:
  owner:
    type: string
    description: Repository owner
    required: true
  repo:
    type: string
    description: Repository name
    required: true
  title:
    type: string
    description: Issue title
    required: true
generated: true
generatedAt: "2026-03-22T10:00:00Z"
---

# Create GitHub Issue

Create a new issue in a GitHub repository.

## MCP Server
Server: `io.github.modelcontextprotocol/github`
Package: `npm @modelcontextprotocol/server-github`
```

The `parameters` here are legitimate — they came from the server's `tools/list` `inputSchema`, not hand-guessed. The `generated: true` flag distinguishes auto-scaffolded tools from hand-authored ones.

### MCP Registry API

The official registry at `registry.modelcontextprotocol.io/v0.1/servers` returns:

```javascript
{
  servers: [{
    server: {
      name: "io.github.modelcontextprotocol/github",
      description: "GitHub API integration",
      version: "2025.11.28",
      packages: [{
        registryType: "npm",       // npm | pypi | oci | mcpb | nuget
        identifier: "@modelcontextprotocol/server-github",
        transport: { type: "stdio" }
      }],
      remotes: [{
        type: "streamable-http",   // streamable-http | sse
        url: "https://...",
        headers: [{ name, description, isRequired, isSecret }]
      }]
    },
    _meta: { ... }
  }]
}
```

### Discovery Components

**McpRegistryClient** — HTTP client for the official registry:
```javascript
async function searchRegistry(query, opts = {})  // → McpRegistryEntry[]
async function getServer(serverName)              // → McpRegistryEntry | null
```

**McpConfigManager** — manages `.agentflow/mcp.json`:
```javascript
function loadMcpConfig(rootDir)                   // → { servers, errors }
function saveMcpConfig(rootDir, servers)
function addServer(rootDir, name, registryEntry, opts)  // → McpServerEntry
// Converts registry packages/remotes → standard command/args/url fields
// Adds AgentFlow extensions (required, registry, discoveredTools)
function removeServer(rootDir, serverName, opts)
```

**McpServerLifecycle** — temporary server processes for tool discovery:
```javascript
async function discoverTools(serverEntry, opts)   // → McpToolInfo[]
// Uses @modelcontextprotocol/sdk for protocol handling
// Spawns stdio process OR connects HTTP/SSE
// Calls tools/list, returns tool schemas
// Always cleans up (kills process / disconnects)
```

**ToolScaffolder** — converts `tools/list` response to `.md` files:
```javascript
function scaffoldTools(rootDir, serverName, tools, opts)  // → string[] (paths)
// Converts inputSchema (JSON Schema) → AgentFlow parameters frontmatter
// Writes .md files to tools/ directory
// Updates mcp.json discoveredTools array
```

## Part 2: Orchestrator Refactoring

### Current Problems

The orchestrator (`src/orchestrator.js`) has three issues:

1. `BUILTIN_EXECUTORS` — hardcoded tool implementations inline
2. `buildToolEntry()` — guesses parameter schemas for known builtins, builds Anthropic-format schemas
3. No MCP support — MCP tools return `{ error: "not connected" }`

### New Design: ToolProvider Pattern

```
orchestrator.js (cleaned up)
  ├── assembleContext()     — unchanged (context assembly per node)
  ├── evaluateRouting()     — unchanged (condition evaluation at routers)
  ├── runWorkflow()         — graph walker, uses ToolProvider instead of inline tools
  └── runWithTools()        — agent loop, unchanged

tool-provider.js (new, replaces inline tool code)
  ├── ToolProvider (interface)
  │     async initialize(graph)
  │     getToolsForNode(node, graph) → [{ name, schema, execute }]
  │     async shutdown()
  │
  └── NodeToolProvider (standalone runtime implementation)
        ├── BuiltinToolRegistry
        │     readCode(args, ctx)      → reads files
        │     fsWrite(args, ctx)       → writes files
        │     getDiagnostics(args)     → syntax checks
        │     webSearch(args)          → stub / real search
        │
        ├── ScriptToolExecutor
        │     execute(command, args)   → runs shell commands
        │
        └── McpToolManager
              initialize(mcpConfig)    → spawn/connect servers from mcp.json
              getTools(serverName)     → tools/list via MCP SDK
              execute(server, tool, args) → tools/call via MCP SDK
              shutdown()               → kill/disconnect all servers
```

### How It Works at Runtime

```
1. agentflow run -w build-feature --provider anthropic

2. Orchestrator starts:
   - parseRoot() → graph with tools, workflows, mcpServers
   - toolProvider = new NodeToolProvider()
   - toolProvider.initialize(graph)
     → reads mcp.json
     → checks required servers
     → spawns/connects MCP servers
     → calls tools/list on each to get available tools

3. At each node:
   - node has refs: {{tools/read-code}}, {{tools/github-create-issue}}, {{tools/run-tests}}
   - toolProvider.getToolsForNode(node, graph):
     - read-code → type: builtin → BuiltinToolRegistry.readCode
     - github-create-issue → type: mcp, mcp: 'io.github.../github'
       → McpToolManager has this server connected
       → returns { schema: (from tools/list), execute: proxy to tools/call }
     - run-tests → type: script → ScriptToolExecutor
   - Returns unified [{ name, schema, execute }]
   - Orchestrator doesn't know or care about tool types

4. Agent loop:
   - Passes tool schemas to LLM
   - LLM calls a tool → orchestrator calls execute()
   - MCP tool calls go through SDK to the actual server process
   - Results fed back to LLM
   - Repeat until final text response

5. Shutdown:
   - toolProvider.shutdown()
   - MCP server processes killed, connections closed
```

### ToolProvider Interface

```javascript
/**
 * ToolProvider abstracts tool resolution and execution.
 * The orchestrator calls this — it never knows about tool types.
 *
 * Different platforms provide their own implementations:
 * - NodeToolProvider: standalone runtime (builtins + scripts + MCP)
 * - (future) KiroToolProvider: delegates to Kiro's built-in tools
 * - (future) CursorToolProvider: delegates to Cursor's tools
 */
class ToolProvider {
  /**
   * Initialize the provider. For NodeToolProvider, this spawns MCP servers.
   * @param {object} graph - Parsed WorkflowGraph from parseRoot()
   */
  async initialize(graph) {}

  /**
   * Get tools available for a specific node.
   * @param {object} node - The current workflow node
   * @param {object} graph - The full WorkflowGraph
   * @returns {{ name: string, schema: object, execute: Function }[]}
   */
  getToolsForNode(node, graph) {}

  /**
   * Clean up. Kill MCP server processes, close connections.
   */
  async shutdown() {}
}
```

### MCP Tool Execution Flow

```
LLM says: call tool "github-create-issue" with { owner: "acme", repo: "app", title: "Bug" }
  │
  ▼
orchestrator.runWithTools() finds executor in toolMap
  │
  ▼
McpToolManager.execute("io.github.modelcontextprotocol/github", "create_issue", args)
  │
  ▼
@modelcontextprotocol/sdk sends JSON-RPC tools/call to the server process
  │
  ▼
MCP server executes the tool, returns result
  │
  ▼
Result flows back through SDK → McpToolManager → orchestrator → fed to LLM
```

### Usage Tracking (Part of Orchestrator Refactoring)

Since we're already redesigning the orchestrator's call flow, we add per-node and per-workflow token/cost tracking with zero new modules — just return data that's already there.

**Why here, not separate:** `callAnthropic` and `callOpenAI` already receive `data.usage` from the API. We're just not returning it. The refactoring touches these functions anyway, so we pipe usage through at the same time.

#### Changes to Existing Functions

**1. `callAnthropic` / `callOpenAI` — return usage alongside text/toolCalls**

Both API responses already contain usage data. We just include it in the return value:

```javascript
// callAnthropic — data.usage has { input_tokens, output_tokens }
return { text, toolCalls, stopReason: data.stop_reason, usage: data.usage || null };

// callOpenAI — data.usage has { prompt_tokens, completion_tokens, total_tokens }
// Normalize to Anthropic's field names for consistency
return {
  text, toolCalls, stopReason: choice.finish_reason,
  usage: data.usage
    ? { input_tokens: data.usage.prompt_tokens, output_tokens: data.usage.completion_tokens }
    : null
};
```

**2. `runWithTools` — accumulate usage across tool rounds**

```javascript
async function runWithTools(messages, toolMap, callLLM, opts, log) {
  let totalUsage = { input_tokens: 0, output_tokens: 0 };
  // ... existing loop ...
  while (round < maxToolRounds) {
    const response = await callLLM(conversation, { ... });
    if (response.usage) {
      totalUsage.input_tokens += response.usage.input_tokens;
      totalUsage.output_tokens += response.usage.output_tokens;
    }
    // ... rest of existing loop unchanged ...
  }
  return { text: response.text, usage: totalUsage };
}
```

`runWithTools` currently returns a string (`response.text`). After refactoring it returns `{ text, usage }`. The one call site in `runWorkflow` destructures this.

**3. `runWorkflow` — store per-node usage, print summary, persist run log**

```javascript
// In the state object, add:
state.usage = {};  // nodeId → { input_tokens, output_tokens }

// After each node's runWithTools call:
const result = await runWithTools(messages, toolMap, callLLM, llmOpts, log);
llmResponse = result.text;
state.usage[nodeId] = result.usage;

// At workflow end, print summary:
console.log('\n--- Token Usage ---');
let totalIn = 0, totalOut = 0;
for (const [id, u] of Object.entries(state.usage)) {
  console.log(`  ${id}: ${u.input_tokens} in / ${u.output_tokens} out`);
  totalIn += u.input_tokens;
  totalOut += u.output_tokens;
}
console.log(`  TOTAL: ${totalIn} in / ${totalOut} out`);
```

**4. Persist run logs to `.agentflow/runs/`**

After workflow completion, write a JSON log:

```javascript
// At end of runWorkflow, before returning state:
const runLog = {
  workflowId,
  provider,
  model: opts.model || null,
  startedAt: startTime,       // captured at top of runWorkflow
  completedAt: new Date().toISOString(),
  steps: state.stepCount,
  nodesVisited: Object.keys(state.visitCounts),
  usage: state.usage,
  totalUsage: { input_tokens: totalIn, output_tokens: totalOut },
};

const runsDir = path.join(rootDir, 'runs');
fs.mkdirSync(runsDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = path.join(runsDir, `${timestamp}-${workflowId}.json`);
fs.writeFileSync(logPath, JSON.stringify(runLog, null, 2));
log(`Run log saved to ${logPath}`);
```

Run logs go to `.agentflow/runs/{timestamp}-{workflowId}.json`. This directory should be `.gitignore`d by default since it contains per-run data.

#### What We're NOT Doing

- No cost calculation (prices change, not our problem)
- No streaming token counting
- No separate usage module or class
- No database — just JSON files
- No UI — just console summary + JSON log

### Feature Gate Enforcement

When `NodeToolProvider.initialize()` reads `mcp.json`:

```javascript
async initialize(graph) {
  const mcpConfig = loadMcpConfig(graph.rootDir);

  for (const [name, server] of Object.entries(mcpConfig.servers)) {
    try {
      // Connect using standard fields: command/args (stdio) or url (HTTP)
      const client = await this.mcpManager.connect(name, server);
      // Get available tools
      const tools = await client.listTools();
      this.mcpTools.set(name, { client, tools });
    } catch (err) {
      if (server.required) {
        throw new Error(
          `Required MCP server "${name}" failed to start: ${err.message}\n` +
          `Install: ${server.command} ${(server.args || []).join(' ')}`
        );
      }
      // Optional server — warn and continue
      console.warn(`Optional MCP server "${name}" unavailable: ${err.message}`);
    }
  }
}
```

Required servers that fail to connect → hard error, workflow won't start.
Optional servers that fail → warning, MCP tools from that server return errors if called.

## Part 3: Unified Search & CLI

### CLI Commands

```
agentflow mcp search <query>              Search the official MCP registry
  --limit <n>                             Max results (default: 20)

agentflow mcp add <server-name>           Add a server to .agentflow/mcp.json
  --required                              Mark as required
  --env <KEY=VALUE>                       Set env vars (repeatable)

agentflow mcp remove <server-name>        Remove a server from mcp.json
  --remove-tools                          Also delete generated tool .md files

agentflow mcp discover <server-name>      Start server, discover tools, scaffold .md files
  --timeout <ms>                          Connection timeout (default: 30000)
  --overwrite                             Overwrite existing tool files

agentflow mcp list                        List servers in mcp.json with status

agentflow search <query>                  Unified search (local library + MCP registry)
  --local-only                            Skip MCP registry
  --mcp-only                              Skip local library
```

### Unified Search

```javascript
async function unifiedSearch(registry, query, opts = {}) {
  const results = [];

  // Local library results
  if (!opts.mcpOnly) {
    const local = search(registry, query);
    results.push(...local.map(r => ({ source: 'local', ...r })));
  }

  // MCP registry results
  if (!opts.localOnly) {
    const mcp = await searchRegistry(query, { limit: opts.mcpLimit || 10 });
    results.push(...mcp.map(r => ({
      source: 'mcp',
      type: 'server',
      name: r.server.name,
      description: r.server.description,
      packages: r.server.packages,
      remotes: r.server.remotes,
    })));
  }

  return results;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: mcp.json round-trip preservation

*For any* valid mcp.json configuration (including `${env:VAR}` tokens, standard fields, and AgentFlow extension fields), loading the file and saving it back should produce a file with identical content — no tokens resolved, no fields dropped, no structure modified.

**Validates: Requirements 2.9, 9.1, 9.2, 15.1**

### Property 2: Config absence produces empty result

*For any* workspace directory that does not contain an `mcp.json` file, `loadMcpConfig()` should return `{ servers: {}, errors: [] }` with no errors.

**Validates: Requirements 2.7, 10.1, 10.2**

### Property 3: Malformed JSON produces errors

*For any* string that is not valid JSON, loading it as mcp.json should return a result with a non-empty `errors` array and an empty `servers` object.

**Validates: Requirement 2.8**

### Property 4: Registry-to-config field conversion

*For any* valid MCP registry entry containing packages (npm/pypi with stdio transport) or remotes (streamable-http/SSE), `addServer()` should produce a server entry with the correct standard fields: `command`/`args` for stdio packages, `url` for remote endpoints.

**Validates: Requirements 2.1, 2.2**

### Property 5: Add then remove is identity

*For any* valid server name and registry entry, adding the server to mcp.json and then removing it should result in mcp.json not containing that server entry.

**Validates: Requirements 2.1, 2.5**

### Property 6: Environment variable pass-through

*For any* set of KEY=VALUE pairs provided via `--env`, the resulting server entry's `env` object should contain all specified keys with their corresponding values.

**Validates: Requirement 2.4**

### Property 7: Search result limit enforcement

*For any* positive integer `n` and any MCP registry response, `searchRegistry(query, { limit: n })` should return at most `n` results.

**Validates: Requirement 1.3**

### Property 8: Search result completeness

*For any* valid MCP registry API response, each parsed result should contain the server name, description, packages array, and remotes array.

**Validates: Requirements 1.2, 1.5**

### Property 9: Scaffolded tool file validity

*For any* list of MCP tool definitions returned by `tools/list`, every `.md` file generated by the Tool_Scaffolder should pass `parseMarkdownFile()` and `classifyResource()`, and its frontmatter should contain `type: mcp`, `mcp: <server-name>`, `name`, `description`, `parameters`, `generated: true`, and a valid ISO `generatedAt` timestamp.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.8**

### Property 10: Discovery idempotence

*For any* MCP server whose `tools/list` response has not changed, running the Tool_Scaffolder twice with `--overwrite` should produce identical tool file content both times.

**Validates: Requirement 13.1**

### Property 11: discoveredTools array matches generated files

*For any* scaffolding operation, the `discoveredTools` array in the mcp.json server entry should contain exactly the names of the tool files that were generated.

**Validates: Requirement 4.7**

### Property 12: Required server failure halts initialization

*For any* mcp.json configuration where a server has `required: true`, if that server fails to connect, `Node_Tool_Provider.initialize()` should throw an error containing the server name and install instructions, preventing workflow startup.

**Validates: Requirements 6.2, 7.1, 7.2**

### Property 13: Optional server failure allows continuation

*For any* mcp.json configuration where a server has `required: false` (or `required` is absent), if that server fails to connect, `Node_Tool_Provider.initialize()` should complete successfully and log a warning.

**Validates: Requirements 6.3, 7.4**

### Property 14: Unified search source annotation

*For any* query and any combination of local library entries and MCP registry results, every item in the unified search output should have a `source` field set to either `'local'` or `'mcp'`, and the combined results should be the union of both sources.

**Validates: Requirements 8.1, 8.2**

### Property 15: Unified search source filtering

*For any* query, when `--local-only` is set all results should have `source === 'local'`, and when `--mcp-only` is set all results should have `source === 'mcp'`.

**Validates: Requirements 8.3, 8.4**

### Property 16: Server-tool referential integrity

*For any* tool file with `type: mcp` and `mcp: X`, if mcp.json exists, validation should pass only if `mcpServers[X]` is declared in mcp.json; otherwise validation should produce an error identifying the tool and the missing server.

**Validates: Requirements 11.1, 11.2**

### Property 17: Orphaned tool detection

*For any* mcp.json where a server has been removed but generated tool files still reference it via the `mcp` frontmatter field, validation should produce a warning about orphaned tool files.

**Validates: Requirement 11.3**

### Property 18: Backward compatibility of parsing

*For any* valid AgentFlow workspace that does not contain mcp.json, `parseRoot()` should produce an identical WorkflowGraph to the behavior before this feature was added. Existing tool `.md` files with `type: mcp` frontmatter should continue to parse correctly.

**Validates: Requirements 10.1, 10.3**

### Property 19: MCP list output completeness

*For any* mcp.json with server entries, the `mcp list` output should include the name, description, required status, and transport type for every declared server.

**Validates: Requirement 12.1**

### Property 20: Usage accumulation correctness

*For any* workflow execution where `callAnthropic` or `callOpenAI` returns usage data, the `totalUsage` reported by `runWithTools` should equal the sum of `input_tokens` and `output_tokens` across all LLM calls in that node's agent loop. The per-node usage stored in `state.usage` should equal the value returned by `runWithTools` for that node.

**Validates: Requirements 16.1, 16.2, 16.3**

### Property 21: Run log persistence

*For any* completed workflow execution (not dry-run), a JSON file should be written to `.agentflow/runs/` containing `workflowId`, `provider`, `usage` (per-node), `totalUsage`, `steps`, and valid ISO timestamps for `startedAt` and `completedAt`.

**Validates: Requirement 16.5**

### Property 22: Shutdown cleans up all servers

*For any* set of managed MCP server connections, `shutdown()` should attempt to terminate every server process and close every connection, even if individual shutdown operations throw errors.

**Validates: Requirements 6.5, 14.1, 14.2, 14.3**

### Property 23: OpenAI usage normalization

*For any* OpenAI API response containing `prompt_tokens` and `completion_tokens`, `callOpenAI` should return usage with `input_tokens` equal to `prompt_tokens` and `output_tokens` equal to `completion_tokens`, matching the Anthropic field naming convention.

**Validates: Requirement 16.6**

## Error Handling

| Scenario | Response | Recovery |
|----------|----------|----------|
| `mcp.json` doesn't exist | `{ servers: {}, errors: [] }` | None needed |
| `mcp.json` malformed JSON | Parse error in `mcpServers.errors` | User fixes JSON |
| Registry API unreachable | `searchRegistry` throws | Retry or work offline |
| Required MCP server fails to start | `initialize()` throws, workflow won't start | Fix server config/install |
| Optional MCP server fails | Warning logged, tools return error if called | Fix or remove server |
| Tool name collision | Prefix with server slug, warn user | Use `--prefix` flag |
| Server removed but tools remain | Validation warning | `mcp remove --remove-tools` |

## Minimal Code Changes Review

This section documents a deliberate review of scope to avoid over-engineering.

### File Count Assessment

New files introduced by this feature:
- `src/mcp/config-manager.js` — mcp.json load/save/add/remove (necessary, distinct concern)
- `src/mcp/registry-client.js` — HTTP client for official registry (necessary, external API)
- `src/mcp/server-lifecycle.js` — spawn/connect MCP servers for discovery (necessary, uses SDK)
- `src/mcp/tool-scaffolder.js` — generate .md files from tools/list (necessary, distinct operation)
- `src/mcp/tool-provider.js` — ToolProvider + NodeToolProvider (necessary, replaces inline mess)
- `src/mcp/unified-search.js` — combine local + MCP search (small, could be inlined in CLI)

**Verdict:** 6 new files under `src/mcp/`. Each has a clear single responsibility. The alternative — putting everything in orchestrator.js — is what we're trying to fix. `unified-search.js` is the most debatable (it's ~30 lines) but keeps CLI clean.

### ToolProvider Pattern — Is It Over-Engineered?

The ToolProvider has 3 methods: `initialize()`, `getToolsForNode()`, `shutdown()`. That's the minimum interface to abstract tool resolution from the orchestrator. We're NOT building:
- A plugin registry
- Dynamic provider loading
- Provider configuration files
- Multiple provider implementations (just NodeToolProvider for now)

The "future KiroToolProvider / CursorToolProvider" comments in the design are aspirational context, not scope. We build NodeToolProvider only.

**Verdict:** The pattern is justified. Without it, MCP tool execution would be another blob of inline code in orchestrator.js alongside the existing `BUILTIN_EXECUTORS` mess.

### Usage Tracking — Scope Check

Usage tracking adds ~30 lines across 3 existing functions (callAnthropic, callOpenAI, runWithTools) plus ~15 lines in runWorkflow for summary + JSON persistence. No new files, no new modules, no new classes. It piggybacks on the orchestrator refactoring we're already doing.

**Verdict:** Minimal. The data is already there — we're just not throwing it away.

### Tasks That Could Be Combined

- Tasks 1.1 + 1.3 (config load/save + add/remove) could be one task since they're the same file. Kept separate for reviewability.
- Tasks 9.1 + 9.2 (parser + validator updates) could be one task. Kept separate because parser and validator are different files.
- Task 10 (unified search) could be deferred to a follow-up if we want to ship MCP support faster.

### What We're NOT Building

- No MCP server hosting/proxy
- No tool marketplace UI
- No automatic dependency resolution between MCP servers
- No cost calculation or billing integration
- No streaming support for MCP tools
- No MCP server health monitoring or auto-restart

## Dependencies

- `@modelcontextprotocol/sdk` (MIT) — MCP protocol client for server lifecycle, `tools/list`, `tools/call`
- Existing: `gray-matter`, `fs`, `path`, `node:child_process`, `node:fetch`
- No agent frameworks. The orchestrator IS the agent framework.

## Security Considerations

- `mcp.json` may contain `${env:VAR}` references to secrets — never resolve or log these
- Server commands from the registry are executed locally during `discover` and `run` — warn user
- Remote server URLs may require auth headers — handle via `${env:VAR}`
- Generated tool files should not contain secrets from discovery
- Registry API responses are untrusted — validate structure before using
