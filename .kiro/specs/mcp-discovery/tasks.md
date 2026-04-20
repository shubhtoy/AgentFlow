# Implementation Plan: MCP Discovery, Tool Resolution & Orchestrator Refactoring

## Overview

This plan implements MCP registry integration, tool discovery/scaffolding, orchestrator refactoring with a ToolProvider abstraction, and MCP runtime execution. Tasks are ordered so each step builds on the previous, starting with the config layer, then registry client, then discovery/scaffolding, then orchestrator refactoring, and finally CLI wiring.

## Tasks

- [x] 1. Implement MCP Config Manager (`src/mcp/config-manager.js`)
  - [x] 1.1 Create `loadMcpConfig(rootDir)` and `saveMcpConfig(rootDir, config)`
    - Load `.agentflow/mcp.json`, parse JSON, return `{ servers, errors }`
    - Return `{ servers: {}, errors: [] }` when file does not exist
    - Return parse errors in `errors` array for malformed JSON
    - Preserve `${env:VAR}` tokens as literal strings during load/save (never resolve)
    - _Requirements: 2.7, 2.8, 2.9, 9.1, 15.1_

  - [ ]* 1.2 Write property tests for loadMcpConfig / saveMcpConfig
    - **Property 1: mcp.json round-trip preservation**
    - **Property 2: Config absence produces empty result**
    - **Property 3: Malformed JSON produces errors**
    - **Validates: Requirements 2.7, 2.8, 2.9, 9.1, 15.1**

  - [x] 1.3 Create `addServer(rootDir, name, registryEntry, opts)` and `removeServer(rootDir, name, opts)`
    - Convert registry package metadata to standard MCP fields (`command`/`args` for stdio, `url` for HTTP/SSE)
    - Support `--required` flag setting `required: true`
    - Support `--env KEY=VALUE` populating the `env` object
    - Store AgentFlow extension fields (`required`, `description`, `registry`, `registryName`, `version`, `discoveredTools`)
    - `removeServer` deletes the entry; with `removeTools` option, also deletes generated tool `.md` files from `discoveredTools`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 9.1, 9.2_

  - [ ]* 1.4 Write property tests for addServer / removeServer
    - **Property 4: Registry-to-config field conversion**
    - **Property 5: Add then remove is identity**
    - **Property 6: Environment variable pass-through**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

  - [x] 1.5 Create `resolveEnvTokens(env)` utility
    - Resolve `${env:VAR}` tokens from `process.env` at connection time only
    - Used by MCP_Tool_Manager and MCP_Server_Lifecycle, never during load/save
    - _Requirements: 15.1, 15.2_

- [x] 2. Checkpoint — Config Manager
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement MCP Registry Client (`src/mcp/registry-client.js`)
  - [x] 3.1 Create `searchRegistry(query, opts)` and `getServer(serverName)`
    - HTTP GET to `registry.modelcontextprotocol.io/v0.1/servers` with query params
    - Parse response, return array of `McpRegistryEntry` objects with name, description, packages, remotes
    - Respect `opts.limit` to cap results
    - Throw descriptive error when registry API is unreachable
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 3.2 Write property tests for searchRegistry
    - **Property 7: Search result limit enforcement**
    - **Property 8: Search result completeness**
    - **Validates: Requirements 1.2, 1.3, 1.5**

- [x] 4. Implement MCP Server Lifecycle (`src/mcp/server-lifecycle.js`)
  - [x] 4.1 Create `discoverTools(serverEntry, opts)`
    - Use `@modelcontextprotocol/sdk` to spawn stdio or connect HTTP/SSE
    - Call `tools/list` and return tool schemas
    - Always clean up (kill process / disconnect) in a `finally` block, even on error
    - Support `--timeout` option (default 30000ms)
    - Resolve `${env:VAR}` tokens via `resolveEnvTokens()` before spawning
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 14.1, 14.2, 15.2_

- [x] 5. Implement Tool Scaffolder (`src/mcp/tool-scaffolder.js`)
  - [x] 5.1 Create `scaffoldTools(rootDir, serverName, tools, opts)`
    - Generate one `.md` file per tool in `.agentflow/tools/`
    - Frontmatter: `type: mcp`, `mcp: <server-name>`, `name`, `description`, `parameters`, `generated: true`, `generatedAt: <ISO>`
    - Convert MCP `inputSchema` (JSON Schema) to AgentFlow parameter frontmatter format
    - Skip existing files unless `opts.overwrite` is true; warn on skip
    - Update `discoveredTools` array in mcp.json server entry via config-manager
    - Generated files must pass `parseMarkdownFile()` and `classifyResource()`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 5.2 Write property tests for scaffoldTools
    - **Property 9: Scaffolded tool file validity**
    - **Property 10: Discovery idempotence**
    - **Property 11: discoveredTools array matches generated files**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.7, 4.8, 13.1**

- [x] 6. Checkpoint — Discovery Pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Refactor Orchestrator with ToolProvider abstraction
  - [x] 7.1 Create ToolProvider interface and NodeToolProvider (`src/mcp/tool-provider.js`)
    - Define `ToolProvider` base class with `initialize(graph)`, `getToolsForNode(node, graph)`, `shutdown()`
    - Implement `NodeToolProvider` extending `ToolProvider`
    - Move `BUILTIN_EXECUTORS` from `src/orchestrator.js` into a `BuiltinToolRegistry` within NodeToolProvider
    - Move `executeScript()` from `src/orchestrator.js` into a `ScriptToolExecutor` within NodeToolProvider
    - `getToolsForNode()` returns unified `[{ name, schema, execute }]` for builtin, script, and MCP tools
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 7.2 Implement McpToolManager within NodeToolProvider
    - On `initialize()`: read mcp.json, connect to each server using `@modelcontextprotocol/sdk`
    - Required servers that fail → throw error with server name and install instructions
    - Optional servers that fail → log warning, continue
    - `execute(server, tool, args)` → proxy `tools/call` JSON-RPC to the connected server
    - `shutdown()` → terminate all server processes and close connections, even if individual shutdowns fail
    - Handle server crashes during execution: report error for specific tool call without terminating workflow
    - _Requirements: 5.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 14.3_

  - [ ]* 7.3 Write property tests for ToolProvider initialization
    - **Property 12: Required server failure halts initialization**
    - **Property 13: Optional server failure allows continuation**
    - **Property 20: Shutdown cleans up all servers**
    - **Validates: Requirements 6.2, 6.3, 6.5, 7.1, 7.2, 7.4, 14.1, 14.2, 14.3**

  - [x] 7.4 Refactor `src/orchestrator.js` to use ToolProvider
    - Remove `BUILTIN_EXECUTORS`, `buildToolEntry()`, `buildNodeTools()`, `executeScript()` from orchestrator
    - Import and use `NodeToolProvider` in `runWorkflow()`
    - Call `toolProvider.initialize(graph)` at startup
    - Replace `buildNodeTools(node, graph)` calls with `toolProvider.getToolsForNode(node, graph)`
    - Call `toolProvider.shutdown()` in a `finally` block at workflow end
    - _Requirements: 5.4, 10.1, 10.2_

  - [x] 7.5 Add usage tracking to LLM provider functions and runWithTools
    - Modify `callAnthropic` to return `data.usage` alongside `text`/`toolCalls`
    - Modify `callOpenAI` to return normalized usage (`prompt_tokens` → `input_tokens`, `completion_tokens` → `output_tokens`)
    - Modify `runWithTools` to accumulate usage across tool rounds and return `{ text, usage }`
    - Update `runWorkflow` to store per-node usage in `state.usage`, print summary at end
    - Write JSON run log to `.agentflow/runs/{timestamp}-{workflowId}.json` on non-dry-run completion
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [ ]* 7.6 Write property tests for usage tracking
    - **Property 20: Usage accumulation correctness**
    - **Property 23: OpenAI usage normalization**
    - **Validates: Requirements 16.1, 16.2, 16.3, 16.6**

  - [ ]* 7.7 Write unit tests for refactored orchestrator
    - Verify orchestrator uses ToolProvider interface without knowledge of tool types
    - Verify existing builtin and script tools still work after refactoring
    - Verify backward compatibility: workspaces without mcp.json work identically
    - _Requirements: 5.4, 10.1, 10.2, 10.3_

- [x] 8. Checkpoint — Orchestrator Refactoring
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Extend parser and validator for MCP support
  - [x] 9.1 Update `parseRoot()` in `src/parser.js` to load mcp.json
    - Call `loadMcpConfig()` and attach `mcpServers` to the WorkflowGraph
    - Existing workspaces without mcp.json must produce identical graphs (backward compat)
    - Existing `type: mcp` tool files continue to parse correctly
    - _Requirements: 10.1, 10.3_

  - [x] 9.2 Add MCP validation rules to `src/validator.js`
    - Validate that `type: mcp` tools reference a server declared in mcp.json
    - Produce error when referenced server is missing from mcp.json
    - Produce warning for orphaned tool files (server removed but tool files remain)
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ]* 9.3 Write property tests for MCP validation
    - **Property 16: Server-tool referential integrity**
    - **Property 17: Orphaned tool detection**
    - **Property 18: Backward compatibility of parsing**
    - **Validates: Requirements 10.1, 10.3, 11.1, 11.2, 11.3**

- [x] 10. Implement Unified Search (`src/mcp/unified-search.js`)
  - [x] 10.1 Create `unifiedSearch(registry, query, opts)`
    - Combine local library `search()` results with `searchRegistry()` results
    - Annotate each result with `source: 'local'` or `source: 'mcp'`
    - Support `opts.localOnly` and `opts.mcpOnly` flags for filtering
    - When `--mcp-only` and registry unreachable, report error without partial results
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 10.2 Write property tests for unified search
    - **Property 14: Unified search source annotation**
    - **Property 15: Unified search source filtering**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

- [x] 11. Wire CLI commands in `src/cli.js`
  - [x] 11.1 Add `agentflow mcp search <query>` command
    - Call `searchRegistry()`, format results showing name, description, transport types
    - Support `--limit <n>` flag
    - _Requirements: 1.1, 1.5_

  - [x] 11.2 Add `agentflow mcp add <server-name>` and `agentflow mcp remove <server-name>` commands
    - `add`: fetch from registry via `getServer()`, call `addServer()`, support `--required` and `--env`
    - `remove`: call `removeServer()`, support `--remove-tools`
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6_

  - [x] 11.3 Add `agentflow mcp discover <server-name>` command
    - Call `discoverTools()` then `scaffoldTools()`, support `--timeout` and `--overwrite`
    - _Requirements: 3.1, 3.5, 4.5, 4.6_

  - [x] 11.4 Add `agentflow mcp list` command
    - Display all servers from mcp.json with name, description, required status, transport type
    - Show message when no servers configured
    - _Requirements: 12.1, 12.2_

  - [ ]* 11.5 Write property test for mcp list output
    - **Property 19: MCP list output completeness**
    - **Validates: Requirement 12.1**

  - [x] 11.6 Add `agentflow search <query>` unified search command
    - Call `unifiedSearch()`, support `--local-only` and `--mcp-only` flags
    - _Requirements: 8.1, 8.3, 8.4_

- [x] 12. Final checkpoint — Full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All new modules go under `src/mcp/` to keep the feature self-contained
- The orchestrator refactoring (task 7) is the riskiest change — existing orchestrator tests must continue passing
- Property tests validate universal correctness properties from the design document
- `@modelcontextprotocol/sdk` must be added as a dependency before tasks 4 and 7.2
