# Requirements Document

## Introduction

This document defines the requirements for MCP Discovery, Tool Resolution, and Orchestrator Refactoring in AgentFlow. The feature enables searching and adding MCP servers from the official registry, discovering and scaffolding MCP tools at authoring time, executing MCP tools at runtime through a clean ToolProvider abstraction, and unifying local library search with MCP registry search. The orchestrator is refactored to replace inline tool code with a pluggable ToolProvider pattern.

## Glossary

- **MCP_Registry_Client**: HTTP client module that queries the official MCP registry at `registry.modelcontextprotocol.io/v0.1/servers` for server metadata.
- **MCP_Config_Manager**: Module that loads, saves, adds, and removes server entries in the `.agentflow/mcp.json` configuration file.
- **MCP_Server_Lifecycle**: Module that spawns stdio processes or connects to HTTP/SSE endpoints for temporary MCP server interactions (tool discovery).
- **Tool_Scaffolder**: Module that converts MCP `tools/list` responses into `.md` tool files in the `.agentflow/tools/` directory.
- **Tool_Provider**: Abstract interface that resolves and executes tools for the orchestrator, hiding tool type (builtin, script, MCP) from the caller.
- **Node_Tool_Provider**: Concrete implementation of Tool_Provider for the standalone Node.js runtime, managing builtin tools, script tools, and MCP tools.
- **MCP_Tool_Manager**: Sub-component of Node_Tool_Provider that manages MCP server connections, tool listing, and tool execution via the MCP SDK.
- **Orchestrator**: The AgentFlow runtime that walks workflow graphs, assembles context, invokes tools, and evaluates routing conditions.
- **Unified_Search**: Function that combines local library search results with MCP registry search results into a single result set.
- **mcp.json**: The `.agentflow/mcp.json` configuration file declaring MCP server dependencies for a workspace.
- **Feature_Gate**: The `required` flag on an MCP server entry in mcp.json that controls whether a workflow can start without that server.

## Requirements

### Requirement 1: MCP Registry Search

**User Story:** As a workflow author, I want to search the official MCP registry for servers, so that I can discover available MCP integrations for my workflows.

#### Acceptance Criteria

1. WHEN a user invokes `agentflow mcp search <query>`, THE MCP_Registry_Client SHALL send an HTTP GET request to the official MCP registry API and return matching server entries.
2. WHEN the MCP registry API returns results, THE MCP_Registry_Client SHALL include the server name, description, available packages, and remote endpoints for each entry.
3. WHEN the `--limit <n>` flag is provided, THE MCP_Registry_Client SHALL return at most `n` results.
4. IF the MCP registry API is unreachable, THEN THE MCP_Registry_Client SHALL throw an error with a descriptive message indicating the registry is unavailable.
5. WHEN search results are displayed, THE CLI SHALL format each result showing the server name, description, and available transport types (stdio, streamable-http, SSE).

### Requirement 2: MCP Server Configuration Management

**User Story:** As a workflow author, I want to add and remove MCP servers from my workspace configuration, so that I can declare which MCP integrations my workflow depends on.

#### Acceptance Criteria

1. WHEN a user invokes `agentflow mcp add <server-name>`, THE MCP_Config_Manager SHALL create or update `.agentflow/mcp.json` with the server entry derived from registry metadata.
2. WHEN adding a server, THE MCP_Config_Manager SHALL convert registry package metadata into standard MCP config fields (`command`, `args` for stdio; `url` for HTTP/SSE).
3. WHEN the `--required` flag is provided, THE MCP_Config_Manager SHALL set the `required` field to `true` on the server entry.
4. WHEN the `--env KEY=VALUE` flag is provided, THE MCP_Config_Manager SHALL include the specified environment variables in the server entry's `env` object.
5. WHEN a user invokes `agentflow mcp remove <server-name>`, THE MCP_Config_Manager SHALL remove the named server entry from mcp.json.
6. WHEN the `--remove-tools` flag is provided with `mcp remove`, THE MCP_Config_Manager SHALL also delete the generated tool `.md` files listed in the server's `discoveredTools` array.
7. WHEN `mcp.json` does not exist, THE MCP_Config_Manager SHALL return an empty configuration object `{ servers: {}, errors: [] }` without producing errors.
8. IF `mcp.json` contains malformed JSON, THEN THE MCP_Config_Manager SHALL return parse errors in the `errors` array of the result object.
9. THE MCP_Config_Manager SHALL preserve `${env:VAR}` tokens as literal strings during load and save operations without resolving them.

### Requirement 3: MCP Tool Discovery

**User Story:** As a workflow author, I want to discover available tools from an MCP server, so that I can scaffold tool definition files for use in my workflows.

#### Acceptance Criteria

1. WHEN a user invokes `agentflow mcp discover <server-name>`, THE MCP_Server_Lifecycle SHALL start the specified server using its configured transport (stdio spawn or HTTP/SSE connect).
2. WHEN connected to an MCP server, THE MCP_Server_Lifecycle SHALL call `tools/list` via the MCP SDK and return the list of available tools with their input schemas.
3. WHEN discovery completes (successfully or with error), THE MCP_Server_Lifecycle SHALL stop the server process or disconnect the HTTP/SSE connection.
4. IF the server fails to start within the configured timeout, THEN THE MCP_Server_Lifecycle SHALL terminate the connection attempt and report a timeout error.
5. WHEN the `--timeout <ms>` flag is provided, THE MCP_Server_Lifecycle SHALL use the specified value as the connection timeout instead of the default 30000ms.

### Requirement 4: Tool File Scaffolding

**User Story:** As a workflow author, I want discovered MCP tools to be scaffolded as `.md` files, so that I can reference them in workflow nodes using `{{tools/...}}` syntax.

#### Acceptance Criteria

1. WHEN tools are discovered from an MCP server, THE Tool_Scaffolder SHALL generate one `.md` file per tool in the `.agentflow/tools/` directory.
2. THE Tool_Scaffolder SHALL include `type: mcp`, `mcp: <server-name>`, `name`, `description`, and `parameters` fields in the generated frontmatter.
3. WHEN generating parameter definitions, THE Tool_Scaffolder SHALL convert the MCP `inputSchema` (JSON Schema) into AgentFlow parameter frontmatter format.
4. THE Tool_Scaffolder SHALL set `generated: true` and `generatedAt: <ISO timestamp>` in the frontmatter of every generated tool file.
5. WHEN a tool file already exists and the `--overwrite` flag is not set, THE Tool_Scaffolder SHALL skip that file and warn the user.
6. WHEN the `--overwrite` flag is set, THE Tool_Scaffolder SHALL replace existing tool files with newly generated content.
7. WHEN scaffolding completes, THE Tool_Scaffolder SHALL update the `discoveredTools` array in the corresponding mcp.json server entry with the list of generated tool file names.
8. THE Tool_Scaffolder SHALL produce tool files that pass `parseMarkdownFile()` and `classifyResource()` validation.

### Requirement 5: Orchestrator ToolProvider Abstraction

**User Story:** As a platform developer, I want the orchestrator to use a ToolProvider interface for tool resolution and execution, so that tool types (builtin, script, MCP) are abstracted from the workflow execution logic.

#### Acceptance Criteria

1. THE Tool_Provider SHALL expose an `initialize(graph)` method that prepares tool backends based on the parsed WorkflowGraph.
2. THE Tool_Provider SHALL expose a `getToolsForNode(node, graph)` method that returns an array of `{ name, schema, execute }` objects for the tools referenced by the given node.
3. THE Tool_Provider SHALL expose a `shutdown()` method that releases all resources (MCP server processes, connections).
4. THE Orchestrator SHALL use only the Tool_Provider interface for tool resolution and execution, without knowledge of whether a tool is builtin, script, or MCP.
5. WHEN `getToolsForNode()` resolves a tool with `type: builtin`, THE Node_Tool_Provider SHALL return the corresponding builtin executor function.
6. WHEN `getToolsForNode()` resolves a tool with `type: script`, THE Node_Tool_Provider SHALL return a script executor that runs the configured command.
7. WHEN `getToolsForNode()` resolves a tool with `type: mcp`, THE Node_Tool_Provider SHALL return an executor that proxies `tools/call` to the connected MCP server via the MCP SDK.

### Requirement 6: MCP Runtime Execution

**User Story:** As a workflow user, I want MCP tools to execute during workflow runs, so that workflows can interact with external services through MCP servers.

#### Acceptance Criteria

1. WHEN `Node_Tool_Provider.initialize()` is called, THE MCP_Tool_Manager SHALL read mcp.json and connect to each declared MCP server using the standard transport fields.
2. WHEN an MCP server has `required: true` and fails to connect, THE MCP_Tool_Manager SHALL throw an error that prevents the workflow from starting, including the server name and install instructions.
3. WHEN an MCP server has `required: false` (or `required` is absent) and fails to connect, THE MCP_Tool_Manager SHALL log a warning and continue initialization.
4. WHEN the LLM invokes an MCP tool during the agent loop, THE MCP_Tool_Manager SHALL send a `tools/call` JSON-RPC request to the appropriate MCP server and return the result.
5. WHEN `shutdown()` is called, THE MCP_Tool_Manager SHALL terminate all spawned server processes and close all HTTP/SSE connections.
6. IF an MCP server process crashes during workflow execution, THEN THE MCP_Tool_Manager SHALL report the error for the specific tool call without terminating the entire workflow.

### Requirement 7: Feature Gate Enforcement

**User Story:** As a workflow author, I want to mark MCP servers as required, so that workflows fail fast when critical dependencies are unavailable.

#### Acceptance Criteria

1. WHEN a server entry in mcp.json has `required: true`, THE Node_Tool_Provider SHALL verify the server is connectable during `initialize()`.
2. IF a required server fails to connect during initialization, THEN THE Node_Tool_Provider SHALL throw an error that halts workflow startup with a message identifying the server and how to install it.
3. WHEN all required servers connect successfully, THE Node_Tool_Provider SHALL proceed with workflow execution.
4. WHEN an optional server's tools are invoked but the server is unavailable, THE MCP_Tool_Manager SHALL return an error result for that specific tool call.

### Requirement 8: Unified Search

**User Story:** As a workflow author, I want to search both the local library and the MCP registry in a single query, so that I can discover all available resources without running separate commands.

#### Acceptance Criteria

1. WHEN a user invokes `agentflow search <query>`, THE Unified_Search SHALL query both the local library and the MCP registry and return combined results.
2. WHEN returning results, THE Unified_Search SHALL annotate each result with its source (`local` or `mcp`).
3. WHEN the `--local-only` flag is provided, THE Unified_Search SHALL skip the MCP registry query.
4. WHEN the `--mcp-only` flag is provided, THE Unified_Search SHALL skip the local library query.
5. WHEN the `--mcp-only` flag is provided and the MCP registry is unreachable, THE Unified_Search SHALL report the registry error without returning partial results.

### Requirement 9: mcp.json Standard Compatibility

**User Story:** As a workflow author, I want `.agentflow/mcp.json` to be compatible with standard MCP clients, so that any MCP-aware agent can read the server declarations.

#### Acceptance Criteria

1. THE MCP_Config_Manager SHALL produce mcp.json files that contain the standard `mcpServers` top-level key with standard fields (`command`, `args`, `env`, `url`) for each server entry.
2. THE MCP_Config_Manager SHALL store AgentFlow extension fields (`required`, `description`, `registry`, `registryName`, `version`, `discoveredTools`) alongside standard fields without modifying the standard field structure.
3. WHEN mcp.json is loaded by a third-party MCP client that ignores unknown fields, THE mcp.json file SHALL provide sufficient standard fields for that client to connect to the declared servers.

### Requirement 10: Backward Compatibility

**User Story:** As an existing AgentFlow user, I want my workspaces without MCP configuration to continue working identically, so that the new features do not break existing workflows.

#### Acceptance Criteria

1. WHEN a workspace has no `mcp.json` file, THE Orchestrator SHALL parse and execute workflows identically to the behavior before this feature was added.
2. WHEN a workspace has no `mcp.json` file, THE Node_Tool_Provider SHALL initialize without errors and provide builtin and script tools as before.
3. WHEN existing tool `.md` files contain `type: mcp` and `mcp: <server>` frontmatter fields, THE parser SHALL continue to parse them correctly.

### Requirement 11: Validation of MCP Tool References

**User Story:** As a workflow author, I want validation to catch broken MCP tool references, so that I can fix configuration issues before running a workflow.

#### Acceptance Criteria

1. WHEN a tool file has `type: mcp` and references a server via the `mcp` field, AND mcp.json exists, THE validator SHALL verify that the referenced server exists in mcp.json.
2. IF a tool references an MCP server that is not declared in mcp.json, THEN THE validator SHALL produce a validation error identifying the tool and the missing server.
3. WHEN a server is removed from mcp.json but generated tool files referencing it remain, THE validator SHALL produce a warning about orphaned tool files.

### Requirement 12: MCP Server Listing

**User Story:** As a workflow author, I want to list the MCP servers configured in my workspace, so that I can review the current MCP dependencies.

#### Acceptance Criteria

1. WHEN a user invokes `agentflow mcp list`, THE CLI SHALL display all servers declared in mcp.json with their name, description, required status, and transport type.
2. WHEN mcp.json does not exist or is empty, THE CLI SHALL display a message indicating no MCP servers are configured.

### Requirement 13: Discovery Idempotence

**User Story:** As a workflow author, I want repeated discovery runs to produce consistent results, so that tool files remain stable when the server's tool list has not changed.

#### Acceptance Criteria

1. WHEN `agentflow mcp discover` is run twice with `--overwrite` against the same server whose tool list has not changed, THE Tool_Scaffolder SHALL produce identical tool file content both times.

### Requirement 14: Lifecycle Cleanup

**User Story:** As a workflow author, I want MCP server processes to be cleaned up after discovery and workflow execution, so that no orphan processes remain.

#### Acceptance Criteria

1. WHEN `discoverTools()` completes successfully, THE MCP_Server_Lifecycle SHALL terminate the server process or close the connection.
2. WHEN `discoverTools()` fails with an error, THE MCP_Server_Lifecycle SHALL still terminate the server process or close the connection.
3. WHEN `Node_Tool_Provider.shutdown()` is called, THE MCP_Tool_Manager SHALL terminate all managed server processes and close all connections, even if individual shutdown operations fail.

### Requirement 15: Security of MCP Configuration

**User Story:** As a workflow author, I want environment variable tokens in mcp.json to remain unresolved in storage, so that secrets are not leaked into configuration files or logs.

#### Acceptance Criteria

1. THE MCP_Config_Manager SHALL preserve `${env:VAR}` tokens as literal strings when reading and writing mcp.json.
2. THE MCP_Config_Manager SHALL resolve `${env:VAR}` tokens only at the point of spawning a server process or establishing a connection.
3. THE Orchestrator SHALL not log resolved environment variable values from mcp.json.

### Requirement 16: Usage Tracking

**User Story:** As a workflow operator, I want to see per-node and total token usage after a workflow run, so that I can understand LLM consumption and debug cost-heavy nodes.

#### Acceptance Criteria

1. WHEN an LLM call completes, THE Orchestrator SHALL return usage data (input_tokens, output_tokens) from `callAnthropic` and `callOpenAI` alongside the text and toolCalls from the API response.
2. WHEN a node's agent loop completes, THE Orchestrator SHALL accumulate usage across all LLM calls within `runWithTools` and return the accumulated usage alongside the text response.
3. WHEN a node finishes execution, THE Orchestrator SHALL store the per-node usage in `state.usage` keyed by nodeId.
4. WHEN a workflow completes, THE Orchestrator SHALL print a per-node and total token usage summary to the console showing input_tokens and output_tokens for each node and the totals.
5. WHEN a workflow completes in non-dry-run mode, THE Orchestrator SHALL write a JSON run log to `.agentflow/runs/{timestamp}-{workflowId}.json` containing workflowId, provider, per-node usage, totalUsage, steps, and ISO timestamps for startedAt and completedAt.
6. WHEN OpenAI usage fields are received, THE Orchestrator SHALL normalize `prompt_tokens` to `input_tokens` and `completion_tokens` to `output_tokens` for consistency with Anthropic field names.
