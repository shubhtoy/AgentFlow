# Tasks: Agent Runtime (LangSmith Studio-Style)

Tasks are grouped into parallel tracks. Tracks A, B, C can run simultaneously. Track D depends on A+B. Track E depends on all.

## Track A: Backend — MCP Bridge + Agent Config (no UI dependency)

- [x] 1. MCP Bridge service
  - [x] 1.1 Install `@modelcontextprotocol/sdk` in `agentflow/` (already present)
  - [x] 1.2 Create `agentflow/src/services/mcp-bridge.js` — `createMCPBridge(ctx)` that reads `protocols.json`, spawns MCP servers as child processes via stdio, implements `initialize()`, `getToolDefinitions()`, `callTool(server, tool, args)`, `shutdown()`. Uses `@modelcontextprotocol/sdk` Client for JSON-RPC communication
  - [x] 1.3 Create default `protocols.json` in workspace root with 5 official MCP servers (filesystem, git, memory, fetch, sequentialthinking) — filesystem sandboxed to `rootDir`
  - **Reqs**: 2.1–2.8

- [x] 2. Agent config service + provider support
  - [x] 2.1 Install `@anthropic-ai/sdk` and `openai` packages in `agentflow/`
  - [x] 2.2 Create `agentflow/src/services/agent-config-service.js` — `createAgentConfigService(ctx)` with `getConfig()`, `setConfig(params)` (validates API key with test call), `getProviders()` (returns provider list with models)
  - [x] 2.3 Create `agentflow/src/schemas/agent-schemas.js` — Zod schemas for agent config, chat request, SSE events
  - **Reqs**: 1.3, 1.5, 6.1, 6.2

- [x] 3. Agent chat service
  - [x] 3.1 Create `agentflow/src/services/agent-chat-service.js` — `createAgentChatService(ctx)` with `chat()` async generator. Loads workflow context from disk (reads AGENTS.md + SKILL.md files), builds system prompt, attaches MCP tool definitions, calls LLM provider API with streaming, handles tool-use loop (max 20 iterations), yields SSE events
  - [x] 3.2 Implement Anthropic streaming + tool use (Messages API with `stream: true`, handle `content_block_start/delta/stop` + `tool_use` blocks)
  - [x] 3.3 Implement OpenAI streaming + tool use (Chat Completions API with `stream: true`, handle `tool_calls` in delta chunks)
  - **Reqs**: 3.1–3.9

- [x] 4. Agent routes + server wiring
  - [x] 4.1 Create `agentflow/src/routes/agent-routes.js` — `GET /api/agent/providers`, `POST /api/agent/config`, `POST /api/agent/chat` (SSE), `GET /api/agent/tools`
  - [x] 4.2 Register agent routes in `agentflow/src/server.js`, initialize MCP bridge on startup, shutdown on close
  - [x] 4.3 Simplify `orchestrator-routes.js` — already clean: only utility routes (info, context, dry-run, tokens, export), no chat code
  - **Reqs**: 6.1–6.5, 7.1–7.3

## Track B: Frontend — Agent Chat UI (no backend dependency for structure)

- [x] 5. Zustand agent slice
  - [x] 5.1 Create `ui/src/store/slices/agent-slice.ts` — state: messages (AgentMessage[]), isStreaming (boolean), error (string | null), providerConfig ({ provider, model, hasKey }). Actions: addMessage, updateLastMessage, setStreaming, setError, setConfig, reset
  - [x] 5.2 Integrate agent slice into `ui/src/store/create-store.ts` (replace builder-slice references)
  - **Reqs**: 4.1–4.7

- [x] 6. SetupForm component
  - [x] 6.1 Create `ui/src/components/agent/SetupForm.tsx` — provider dropdown (Anthropic/OpenAI), API key password input, model dropdown (populated per provider), "Connect" button. Stores in localStorage (`af:provider`, `af:apiKey`, `af:model`). Validates via `POST /api/agent/config`
  - **Reqs**: 1.1–1.6

- [x] 7. StreamProvider + SSE parser (rewrite)
  - [x] 7.1 Rewrite `ui/src/components/agent/StreamProvider.tsx` — React context adapted from `agent-chat-ui` Stream.tsx (MIT). Opens SSE to `/api/agent/chat`, parses 5 event types (text_delta, tool_call, tool_result, error, done), accumulates assistant text, tracks tool calls, handles cancel via AbortController. Includes API key from localStorage in request
  - [x] 7.2 SSE parsing inlined into StreamProvider (no separate hook needed — simpler)
  - **Reqs**: 4.1–4.8

- [x] 8. Thread + message renderers (rewrite)
  - [x] 8.1 Rewrite `ui/src/components/agent/Thread.tsx` — adapted from `agent-chat-ui` thread.tsx (MIT). Stick-to-bottom scroll via `use-stick-to-bottom`, scroll-to-bottom button, streaming indicator, markdown rendering
  - [x] 8.2 Create `ui/src/components/agent/ToolCallCard.tsx` — collapsible card showing tool name, input JSON (syntax highlighted), result, status badge (pending/success/error)
  - [x] 8.3 Create `ui/src/components/agent/MessageInput.tsx` — clean agent-specific input with stop button
  - **Reqs**: 5.1–5.6

## Track C: Cleanup (parallel with A and B)

- [x] 9. Remove old code
  - [x] 9.1 Delete `agentflow/src/services/builder-chat-service.js` — `validateScaffold()` moved to `scaffold-gen-service.js`
  - [x] 9.2 Clean up `agentflow/src/schemas/index.js` — builder schemas kept (still needed for scaffold create)
  - [x] 9.3 Clean up `agentflow/src/routes/builder-routes.js` — uses `scaffoldGen.validateScaffold` now
  - [x] 9.4 Remove old `ui/src/components/chat/StreamProvider.tsx`, `use-sse-parser.ts`, `Thread.tsx`, `MessageInput.tsx`, `AgentPreviewSidebar.tsx` (replaced by agent/ versions)
  - [x] 9.5 Remove `ui/src/store/slices/builder-slice.ts` (replaced by agent-slice)
  - [x] 9.6 Remove inline orchestrator chat/run/run-stream routes from `server.js` (superseded by `/api/agent/chat`)
  - [x] 9.7 Update `OrchestratorChat.tsx` FAB to use `/api/agent/chat` SSE endpoint
  - **Reqs**: 7.1–7.6

## Track D: Integration (after A + B)

- [x] 10. Wire frontend to backend
  - [x] 10.1 Update `ui/src/components/chat/ChatMode.tsx` — use new agent StreamProvider, show SetupForm when config missing, show Thread when configured
  - [ ] 10.2 Update `ui/src/App.tsx` — wire agent config check on mount
  - [ ] 10.3 Verify SSE streaming end-to-end: submit message → backend loads context → calls LLM → streams events → Thread renders
  - [ ] 10.4 Verify tool calls end-to-end: LLM requests tool → MCP bridge routes to server → result streams back → ToolCallCard renders
  - **Reqs**: 3.1–3.9, 4.1–4.8, 5.1–5.6

## Track E: Verification (after all)

- [ ] 11. End-to-end verification
  - [ ] 11.1 Verify provider config flow: setup form → validate key → store → chat works
  - [ ] 11.2 Verify MCP tools: filesystem read/write, git status, memory create/search all work through the agent
  - [ ] 11.3 Verify tool-use loop cap: agent stops after 20 tool calls
  - [ ] 11.4 Verify error handling: invalid API key, MCP server crash, network disconnect — all handled gracefully
  - [ ] 11.5 Verify mode switching: Graph Mode ↔ Chat Mode preserves state
  - **Reqs**: All
