# Tasks: Chat Builder + Onboarding (Spec 2 of 4)

> **⚠️ PARTIALLY SUPERSEDED**: Track A tasks 2 (builder system prompt + chat service) and 4.1 (builder chat SSE endpoint) are **superseded** by the Agent Runtime spec. Track B task 6.1 (StreamProvider) is superseded — rewritten in agent-runtime. UI components (Thread, MessageInput, AgentPreviewSidebar, ChatMode) are complete but will be updated by agent-runtime spec.
>
> **Status Summary**:
> - Track A: Tasks 1, 3 ✅ COMPLETE | Task 2 ❌ SUPERSEDED | Task 4.1 ❌ SUPERSEDED, 4.2 ✅ COMPLETE
> - Track B: Tasks 5, 7, 8, 9 ✅ COMPLETE | Task 6.1 ❌ SUPERSEDED (rewritten by agent-runtime)
> - Track C: ✅ COMPLETE
> - Track D: ✅ COMPLETE
> - Track E: ❌ SUPERSEDED (integration depends on agent-runtime)

Tasks are grouped into parallel tracks. Tasks within the same track are sequential. Tracks A, B, C, and D can all run simultaneously from the start. Track E depends on A+B+C completing.

## Track A: Backend — Schemas + Services (no UI dependency)

- [x] 1. Builder Zod schemas + scaffold validation
  - [x] 1.1 Create `src/schemas/builder-schemas.js` with 4 phase-specific Zod schemas: IntentResponseSchema, ToolSelectionResponseSchema, NodeStructureResponseSchema, ReviewResponseSchema, plus AgentScaffoldSchema for full scaffold validation
  - [x] 1.2 Create `validateScaffold()` function in `src/services/builder-chat-service.js` — validates kebab-case name, single entry node, valid edge refs, library tools exist, MCP tools have mcpServer, router node purity, non-empty instructions. Returns `ServiceResult<ValidatedScaffold>`
  - [x] 1.3 Re-export new schemas from `src/schemas/index.js`
  - **Reqs**: 7.1–7.8, 6.9

- [x] ~~2. Builder system prompt + chat service~~ **SUPERSEDED by Agent Runtime spec**
  - [x] ~~2.1 Create `src/services/builder-prompt.js`~~ **SUPERSEDED** — deleted; agent reads workflow markdown directly
  - [x] ~~2.2 Create `src/services/builder-chat-service.js`~~ **SUPERSEDED** — replaced by `agent-chat-service.js`
  - [x] ~~2.3 Implement phase transition logic~~ **SUPERSEDED** — LLM handles phases via `agent-builder` workflow
  - **Reqs**: ~~5.1–5.7, 6.1–6.7, 9.1–9.6, 10.1–10.2, 10.6~~ SUPERSEDED

- [x] 3. Scaffold generation service
  - [x] 3.1 Create `src/services/scaffold-gen-service.js` — `createScaffoldGenService(ctx)` with `generateWorkspace(scaffold, targetDir)`. Generates root AGENTS.md (≤800 tokens), workflow AGENTS.md, node SKILL.md files with correct frontmatter + refs, copies library resources, generates conditional edge templates
  - [x] 3.2 Implement roundtrip verification: after writing, call `parseRoot()` + `validate()` — if errors, rollback (delete dir) and return ServiceResult error. All writes via `atomicWrite()`
  - **Reqs**: 8.1–8.9, 10.5

- [x] 4. Builder routes + server wiring
  - [x] 4.1 Create `src/routes/builder-routes.js` — `POST /api/builder/chat` (SSE streaming endpoint), `POST /api/builder/create` (scaffold generation endpoint). SSE format: `data: ` prefix JSON lines with `type` field on every event
  - [x] 4.2 Register builder routes in `src/server.js`
  - **Reqs**: 6.8, 12.1–12.2

## Track B: UI — Chat Components (no backend dependency)

- [x] 5. Install deps + Zustand builder slice
  - [x] 5.1 Install `use-stick-to-bottom` package in `ui/`
  - [x] 5.2 Create `ui/src/store/slices/builder-slice.ts` — state: messages (ChatMessage[]), scaffold (AgentScaffold | null), currentPhase (BuilderPhase), isStreaming (boolean), error (string | null). Actions: addMessage, updateScaffold, setPhase, setStreaming, setError, resetBuilder
  - [x] 5.3 Integrate builder slice into `ui/src/store/create-store.ts`
  - **Reqs**: 13.1–13.4

- [x] 6. StreamProvider + SSE parser
  - [x] 6.1 Create `ui/src/components/chat/StreamProvider.tsx` — React context adapted from LangChain `agent-chat-ui` Stream.tsx (MIT). Manages SSE connection to `/api/builder/chat`, parses 7 event types, deep-merges scaffold deltas, handles cancel via AbortController, preserves history on errors
  - [x] 6.2 Create `ui/src/components/chat/use-sse-parser.ts` — SSE line buffering + JSON parsing hook (handles partial chunks, skips malformed JSON)
  - **Reqs**: 2.1–2.8, 12.3–12.6

- [x] 7. Thread + message renderers
  - [x] 7.1 Create `ui/src/components/chat/Thread.tsx` — adapted from LangChain `agent-chat-ui` thread.tsx (MIT). Stick-to-bottom scroll via `use-stick-to-bottom`, scroll-to-bottom button, streaming indicator
  - [x] 7.2 Create `ui/src/components/chat/MessageInput.tsx` — text input with send button, disabled while streaming, Cmd+Enter to send
  - [x] 7.3 Create message renderers in `ui/src/components/chat/messages/`: UserMessage (right-aligned bubble), AssistantMessage (left-aligned markdown via react-markdown + remark-gfm), ScaffoldUpdateMessage (collapsible diff), ToolSuggestionMessage (clickable chips)
  - **Reqs**: 3.1–3.8

- [x] 8. Agent Preview Sidebar
  - [x] 8.1 Create `ui/src/components/chat/AgentPreviewSidebar.tsx` — follows ConfigurationSidebar pattern from `open-agent-platform` (MIT). Progressive section display (name, description, pattern, identity, nodes, tools, skills, edges), collapsible sections via shadcn Collapsible, inline editing for name/description, node type color badges, removable tool/skill items. When scaffold fails validation, display specific validation errors with fix suggestions below the "Create Agent" button
  - [x] 8.2 Create "Create Agent" button (disabled until scaffold valid) + "Start from template" escape hatch link
  - **Reqs**: 4.1–4.8, 10.4

- [x] 9. ChatMode container + App.tsx wiring
  - [x] 9.1 Create `ui/src/components/chat/ChatMode.tsx` — resizable two-panel layout (PanelGroup: chat area 60% left, AgentPreviewSidebar 40% right), wraps StreamProvider, handles onAgentCreated callback
  - [x] 9.2 Update `ui/src/App.tsx` — conditionally render ChatMode when `mode === 'chat'`, Graph Mode layout when `mode === 'graph'`. Wire mode switcher from ActionBar
  - **Reqs**: 1.1–1.5

## Track C: Onboarding (no dependency on A or B)

- [x] 10. Onboarding provider + tour
  - [x] 10.1 Create `ui/src/components/onboarding/OnboardingProvider.tsx` — React context with state: isActive, currentStep, totalSteps. Actions: startTour, nextStep, prevStep, skipTour, resetTour. Persists to localStorage (`af-onboarding`) with version field. Auto-starts on first visit (no `af-onboarding-complete` key)
  - [x] 10.2 Create `ui/src/components/onboarding/TourStep.tsx` — renders shadcn Popover anchored to target element via CSS selector, with Next/Previous/Skip buttons. Skips to next step if target element missing from DOM
  - [x] 10.3 Add `data-tour` attributes to existing Spec 1 components: canvas wrapper (`data-tour="canvas"`), explorer panel (`data-tour="explorer"`), details panel (`data-tour="details"`), mode switcher (`data-tour="mode-switch"`), protocols tab (`data-tour="protocols"`)
  - [x] 10.4 Wire OnboardingProvider into App.tsx, connect help button in ActionBar to `resetTour()`
  - **Reqs**: 11.1–11.8

## Track D: shadcn/ui additions (no dependency, needed by B)

- [x] 11. Add missing shadcn components
  - [x] 11.1 Add `ui/src/components/ui/collapsible.tsx` (needed by AgentPreviewSidebar sections)
  - [x] 11.2 Add `ui/src/components/ui/popover.tsx` (needed by onboarding tour steps)
  - **Reqs**: 4.7, 11.2

## Track E: Integration + Verification (after A + B + C)

- [x] 12. End-to-end wiring + error recovery
  - [x] 12.1 Wire StreamProvider to hit real `/api/builder/chat` endpoint — verify SSE events flow from backend through to Thread rendering
  - [x] 12.2 Wire "Create Agent" button to hit `/api/builder/create` — verify scaffold generation writes `.agentflow/` dir, roundtrip passes, and UI switches to Graph Mode
  - [x] 12.3 Verify error recovery: invalid JSON retry + template fallback, hallucinated tool filtering with warning, SSE disconnect + retry preserving history, scaffold validation errors shown in sidebar
  - [x] 12.4 Verify mode switching preserves builder state (switch to graph and back, conversation still there)
  - [x] 12.5 Verify onboarding tour runs on first visit, skips correctly, help button restarts
  - **Reqs**: 1.2, 10.1–10.6, 13.3
