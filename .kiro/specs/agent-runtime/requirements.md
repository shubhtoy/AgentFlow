# Requirements: Agent Runtime (LangSmith Studio-Style)

## Introduction

This document defines the requirements for replacing the custom orchestrator with a LangSmith Studio-style agent runtime. The agent is a thin LLM proxy that injects workflow context as system prompt, bridges official MCP servers for tools, and streams responses via SSE. The frontend adapts the `agent-chat-ui` (MIT) patterns: setup form, StreamProvider, Thread with tool call visualization.

## Glossary

- **Agent_Runtime**: The backend service that proxies LLM calls with workflow context and MCP tools
- **MCP_Bridge**: Service that spawns and manages official MCP servers as child processes via stdio
- **Provider_Config**: User's LLM provider settings (provider, API key, model) stored in localStorage
- **StreamProvider**: React context managing SSE connection, messages, and streaming state
- **Thread**: Chat message list with stick-to-bottom scroll and tool call visualization
- **SetupForm**: Configuration form for LLM provider settings, shown when config is missing
- **Tool_Call**: An LLM function call routed to an MCP server and back
- **SSE_Event**: Server-sent event from the agent chat endpoint

## Requirements

### Requirement 1: Provider Configuration

**User Story:** As a user, I want to configure my own LLM provider so that I can use my preferred model (Anthropic Claude, OpenAI GPT, etc.) with the agent.

#### Acceptance Criteria

1. WHEN provider config is missing (no `af:provider` or `af:apiKey` in localStorage), THE SetupForm SHALL render instead of the chat interface
2. THE SetupForm SHALL collect: provider (Anthropic/OpenAI dropdown), API key (password input), and model (dropdown populated per provider)
3. WHEN the user submits the form, THE SetupForm SHALL validate the API key by calling `POST /api/agent/config` and display an error if invalid
4. WHEN config is valid, THE SetupForm SHALL store settings in localStorage (`af:provider`, `af:apiKey`, `af:model`) and show the chat interface
5. THE API key SHALL only be stored in localStorage on the client — never persisted server-side
6. THE user SHALL be able to change provider settings via a settings button in the chat header

### Requirement 2: MCP Bridge

**User Story:** As a user, I want the agent to have real tools (filesystem, git, memory, web fetch, reasoning) so that it can actually perform actions in my workspace.

#### Acceptance Criteria

1. THE MCP_Bridge SHALL spawn official MCP servers as child processes using stdio transport on server startup
2. THE MCP_Bridge SHALL support these servers from `@modelcontextprotocol`: `server-filesystem`, `server-git`, `server-memory`, `server-fetch`, `server-sequentialthinking`
3. THE MCP_Bridge SHALL read server configuration from `protocols.json` in the workspace root
4. THE MCP_Bridge SHALL expose a `getToolDefinitions()` method returning all tool schemas in LLM function-calling format
5. THE MCP_Bridge SHALL expose a `callTool(server, tool, args)` method that routes calls to the correct MCP server
6. THE MCP_Bridge SHALL sandbox the filesystem server to the workspace `rootDir`
7. THE MCP_Bridge SHALL gracefully handle MCP server crashes by logging the error and marking the server as unavailable
8. THE MCP_Bridge SHALL kill all child processes on server shutdown

### Requirement 3: Agent Chat (Backend)

**User Story:** As a user, I want to chat with an agent that understands my AgentFlow workspace and can use tools to help me build and modify workflows.

#### Acceptance Criteria

1. THE agent chat handler SHALL load workflow context by reading AGENTS.md and SKILL.md files from the workspace directory
2. THE agent chat handler SHALL build a system prompt from the loaded workflow content — the LLM reads the markdown directly, no custom parser
3. THE agent chat handler SHALL attach MCP tool definitions to the LLM request as function/tool schemas
4. THE agent chat handler SHALL call the configured LLM provider API with streaming enabled
5. WHEN the LLM returns a `tool_use` response, THE handler SHALL route the call to the MCP_Bridge, get the result, and continue the LLM conversation
6. THE handler SHALL stream SSE events to the client: `text_delta`, `tool_call`, `tool_result`, `error`, `done`
7. THE handler SHALL always emit a `done` event as the final SSE event
8. THE handler SHALL support both Anthropic and OpenAI APIs with their respective streaming and tool-use formats
9. THE handler SHALL limit the tool-use loop to a maximum of 20 iterations to prevent runaway agents

### Requirement 4: SSE Streaming (Frontend)

**User Story:** As a user, I want real-time streaming responses so I see the agent's thinking and tool usage as it happens.

#### Acceptance Criteria

1. THE StreamProvider SHALL open an SSE connection to `POST /api/agent/chat` on submit
2. THE StreamProvider SHALL parse SSE events by type: `text_delta`, `tool_call`, `tool_result`, `error`, `done`
3. THE StreamProvider SHALL accumulate `text_delta` events into the current assistant message
4. THE StreamProvider SHALL track tool calls with their results for visualization
5. WHEN a `done` event arrives, THE StreamProvider SHALL finalize the assistant message and set `isStreaming` to false
6. WHEN a network error occurs, THE StreamProvider SHALL preserve all message history and show an error
7. THE StreamProvider SHALL support cancellation via AbortController
8. THE StreamProvider SHALL include the API key from localStorage in each request (Authorization header)

### Requirement 5: Thread & Message Rendering

**User Story:** As a user, I want clearly formatted chat messages with tool call visualization so I can see what the agent is doing.

#### Acceptance Criteria

1. THE Thread SHALL render user messages as right-aligned bubbles and assistant messages as left-aligned markdown blocks
2. THE Thread SHALL auto-scroll to bottom on new content using `use-stick-to-bottom`, with a scroll-to-bottom button when scrolled up
3. THE Thread SHALL display tool calls as collapsible cards showing: tool name, input parameters (JSON), result, and status (pending/success/error)
4. THE Thread SHALL render assistant message content using `react-markdown` with `remark-gfm`
5. WHILE streaming, THE Thread SHALL show an animated indicator on the current assistant message
6. THE Thread SHALL be adapted from LangChain's `agent-chat-ui` Thread component pattern (MIT)

### Requirement 6: Agent Routes

**User Story:** As a developer, I want well-defined API endpoints for the agent runtime.

#### Acceptance Criteria

1. `GET /api/agent/providers` SHALL return the list of supported providers with their available models
2. `POST /api/agent/config` SHALL validate the provided API key by making a test call to the provider
3. `POST /api/agent/chat` SHALL accept `{ messages, provider, model, apiKey }` and return an SSE stream
4. `GET /api/agent/tools` SHALL return the list of available MCP tools with their schemas
5. THE existing utility routes (dry-run, tokens, export) SHALL remain functional at their current paths

### Requirement 7: Scrapped Components

**User Story:** As a developer, I want the old orchestrator and builder chat code removed so the codebase is clean.

#### Acceptance Criteria

1. `orchestrator-service.js` SHALL be replaced — `buildWorkspaceContext()` replaced by direct file reading in agent-chat-service
2. `orchestrator-routes.js` SHALL be simplified — remove the chat-related code, keep utility routes (dry-run, tokens, export)
3. `builder-chat-service.js` SHALL be deleted — fully superseded by agent-chat-service
4. The current `StreamProvider.tsx` SHALL be rewritten to use the new agent SSE format
5. The current `use-sse-parser.ts` SHALL be rewritten for the simpler agent event types
6. `builder-slice.ts` in the Zustand store SHALL be replaced with a simpler `agent-slice.ts`
