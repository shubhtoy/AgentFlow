# Requirements: Chat Builder + Onboarding (Spec 2 of 4)

> **⚠️ PARTIALLY SUPERSEDED**: Requirements 5 (Builder Agent System Prompt), 6 (BuilderChatService Backend), and 9 (Conversation Phase Management) are **superseded** by the Agent Runtime spec (`.kiro/specs/agent-runtime/`). The orchestrator + builder-specific chat services are replaced by a LangSmith Studio-style agent with MCP tools.
>
> **Superseded requirements**: 5, 6, 9, 12 (SSE Wire Format — replaced by agent SSE format)
> **Updated requirements**: 2 (StreamProvider now calls `/api/agent/chat`)
> **Valid requirements**: 1, 3, 4, 7, 8, 10, 11, 13

## Introduction

This document defines the requirements for Chat Mode — a conversational agent builder — and a lightweight onboarding walkthrough. Chat Mode enables users to create `.agentflow/` workspaces through a structured multi-phase conversation with a builder agent. The builder agent uses structured JSON output (Zod schemas) at each phase, suggests tools/skills from the real library catalog, and generates validated workspaces that pass roundtrip verification. The onboarding system is a 5-step tooltip tour using shadcn Popover, triggered on first visit or via a help button.

## Glossary

- **Chat_Mode**: The conversational agent builder UI mode, rendered when the mode switcher is set to "chat"
- **Builder_Agent**: The LLM-powered backend service that guides users through scaffold creation via structured conversation
- **AgentScaffold**: The in-memory data model representing an agent workspace being built (name, pattern, nodes, edges, tools, skills)
- **StreamProvider**: React context managing the SSE connection, message state, and scaffold accumulation
- **Thread**: The message list component with stick-to-bottom scroll and message type renderers
- **Agent_Preview_Sidebar**: Right panel showing the evolving AgentScaffold live during conversation
- **BuilderChatService**: Backend Fastify service handling LLM calls, Zod validation, and SSE streaming
- **ScaffoldGenService**: Backend service that writes a validated scaffold to disk as a complete `.agentflow/` directory
- **BuilderPhase**: One of six ordered conversation phases: intent, pattern, tools, nodes, review, complete
- **Library_Catalog**: The registry of 73 items (23 tools, 20 skills, 17 templates, 9 interactions, 4 memory) available for scaffolds
- **OnboardingProvider**: React context managing the 5-step tooltip tour state
- **SSE_Event**: A server-sent event from the builder chat endpoint (text_delta, scaffold_update, phase_change, error, done)
- **ValidatedScaffold**: An AgentScaffold that has passed all validation rules (branded type)
- **Roundtrip_Property**: The guarantee that scaffold → write → parse → validate produces zero errors

## Requirements

### Requirement 1: Chat Mode Container Layout

**User Story:** As a user, I want a split-panel chat interface so that I can converse with the builder agent on the left while seeing my evolving agent scaffold on the right.

#### Acceptance Criteria

1. WHEN the mode switcher is set to "chat", THE Chat_Mode container SHALL render a resizable two-panel layout with the chat area on the left (~60%) and the Agent_Preview_Sidebar on the right (~40%)
2. WHEN an agent is created via the "Create Agent" button, THE Chat_Mode container SHALL call the scaffold generation API and switch to Graph Mode with the resulting WorkflowGraph
3. THE Chat_Mode container SHALL provide a "Start from template" escape hatch that bypasses the conversation and pre-populates a scaffold from a library workflow template
4. THE Chat_Mode container SHALL wrap the chat area in a StreamProvider context so all child components access shared message and scaffold state
5. THE App.tsx SHALL conditionally render the ChatMode component when `mode === 'chat'` and the Graph Mode layout when `mode === 'graph'`, wiring the mode switcher from the ActionBar

### Requirement 2: SSE Stream Management

**User Story:** As a user, I want real-time streaming responses from the builder agent so that I see the agent's thinking as it happens rather than waiting for a complete response.

#### Acceptance Criteria

1. WHEN the user sends a message, THE StreamProvider SHALL open an SSE connection to `/api/builder/chat` and set `isStreaming` to true
2. WHEN SSE events arrive, THE StreamProvider SHALL parse each event by type (text_delta, scaffold_update, tool_suggestion, pattern_suggestion, phase_change, error, done) and update the corresponding state
3. WHEN a `scaffold_update` event arrives, THE StreamProvider SHALL deep-merge the delta into the accumulated AgentScaffold
4. WHEN a `done` event arrives, THE StreamProvider SHALL set `isStreaming` to false and store the final scaffold
5. WHEN a network error occurs during streaming, THE StreamProvider SHALL set the error state, set `isStreaming` to false, and preserve all conversation history
6. WHEN the user calls `cancelStream`, THE StreamProvider SHALL abort the active SSE connection via AbortController
7. WHEN the user calls `resetConversation`, THE StreamProvider SHALL clear all messages, reset the scaffold to null, and reset the phase to "intent"
8. THE StreamProvider SHALL be adapted from LangChain's `agent-chat-ui` `Stream.tsx` provider pattern (MIT licensed), customized for our SSE event types and scaffold accumulation

### Requirement 3: Thread Message Rendering

**User Story:** As a user, I want clearly formatted chat messages with different visual treatments per message type so that I can distinguish my messages from the builder's responses, scaffold updates, and tool suggestions.

#### Acceptance Criteria

1. THE Thread component SHALL render user messages as right-aligned text bubbles and assistant messages as left-aligned markdown-rendered blocks
2. WHEN new messages arrive and the user is scrolled to the bottom, THE Thread component SHALL auto-scroll to show the latest content using the `use-stick-to-bottom` package
3. WHEN the user has scrolled up from the bottom, THE Thread component SHALL display a "scroll to bottom" button and stop auto-scrolling
4. WHILE `isStreaming` is true, THE Thread component SHALL display an animated streaming indicator on the current assistant message
5. WHEN a scaffold_update message is rendered, THE Thread component SHALL display a collapsible diff showing what changed in the scaffold
6. WHEN a tool_suggestion message is rendered, THE Thread component SHALL display clickable tool/skill chips from the library catalog
7. THE Thread component SHALL render assistant message content using react-markdown with remark-gfm for rich formatting
8. THE Thread component SHALL be adapted from LangChain's `agent-chat-ui` `thread.tsx` component pattern (MIT licensed), customized for our message types (scaffold updates, tool suggestions, pattern suggestions)

### Requirement 4: Agent Preview Sidebar

**User Story:** As a user, I want a live preview of my agent scaffold so that I can see the structure being built and make inline edits without leaving the chat.

#### Acceptance Criteria

1. THE Agent_Preview_Sidebar SHALL progressively display scaffold sections (name, description, pattern, identity, nodes, tools, skills, edges) as they are populated during conversation
2. WHEN the user clicks on the name or description fields, THE Agent_Preview_Sidebar SHALL allow inline editing of those values
3. THE Agent_Preview_Sidebar SHALL display node type badges with distinct colors (blue for step, purple for router, teal for sub-workflow)
4. WHEN the user clicks the remove button on a tool or skill item, THE Agent_Preview_Sidebar SHALL remove that item from the scaffold
5. WHILE the scaffold fails validation, THE Agent_Preview_Sidebar SHALL disable the "Create Agent" button
6. WHEN the scaffold passes validation, THE Agent_Preview_Sidebar SHALL enable the "Create Agent" button as the primary action
7. THE Agent_Preview_Sidebar SHALL display each section as a collapsible group using shadcn Collapsible
8. THE Agent_Preview_Sidebar SHALL follow the ConfigurationSidebar pattern from LangChain's `open-agent-platform` (MIT licensed), adapted for live scaffold preview instead of static config forms

### Requirement 5: Builder Agent System Prompt

**User Story:** As a user, I want the builder agent to understand the full AgentFlow format so that it generates valid workspaces with correct directory structure, ref syntax, and architecture patterns.

#### Acceptance Criteria

1. THE Builder_Agent system prompt SHALL include AgentFlow format knowledge: directory structure, ref syntax (`{{category/name}}`), YAML frontmatter fields, and the five-layer context model
2. THE Builder_Agent system prompt SHALL include all six architecture patterns (single, supervisor, router, handoff, blackboard, pipeline) with when-to-use guidance
3. THE Builder_Agent system prompt SHALL include the full Library_Catalog (names and descriptions for all 73 items) so the LLM suggests real tools and skills
4. THE Builder_Agent system prompt SHALL include the phase-specific Zod output schema as a JSON example so the LLM returns structured responses
5. THE Builder_Agent system prompt SHALL include 2-3 few-shot examples of well-structured scaffolds
6. WHEN `currentScaffold` is provided in the prompt context, THE Builder_Agent system prompt SHALL include the current scaffold state so the LLM builds incrementally
7. THE Builder_Agent system prompt SHALL fit within 8000 tokens to leave room for conversation history in the LLM context window

### Requirement 6: BuilderChatService Backend

**User Story:** As a user, I want the builder backend to validate LLM responses against strict schemas and filter out hallucinated tools so that the generated scaffold is always structurally correct.

#### Acceptance Criteria

1. WHEN a chat request is received, THE BuilderChatService SHALL build the system prompt with the current phase, scaffold, and library catalog, then call the LLM and stream response chunks as SSE events
2. WHEN the LLM response is received, THE BuilderChatService SHALL extract the JSON block and validate it against the phase-specific Zod schema (IntentResponseSchema, ToolSelectionResponseSchema, NodeStructureResponseSchema, or ReviewResponseSchema)
3. IF the LLM returns invalid JSON, THEN THE BuilderChatService SHALL retry exactly once with a correction nudge message appended to the conversation
4. IF the retry also fails, THEN THE BuilderChatService SHALL emit a recoverable error event and a done event, preserving conversation history
5. WHEN the validated response contains tool names, THE BuilderChatService SHALL filter them against the Library_Catalog and emit a warning for any removed hallucinated tools
6. WHEN a phase transition is determined, THE BuilderChatService SHALL emit a `phase_change` event with the `from` and `to` phases
7. THE BuilderChatService SHALL always emit a `done` event as the final SSE event in every stream
8. THE BuilderChatService SHALL be registered via a `src/routes/builder-routes.js` file exposing `POST /api/builder/chat` (SSE streaming) and `POST /api/builder/create` (scaffold generation), wired into `server.js`
9. THE phase-specific Zod schemas (IntentResponseSchema, ToolSelectionResponseSchema, NodeStructureResponseSchema, ReviewResponseSchema) SHALL be defined in `src/schemas/builder-schemas.js` and re-exported from `src/schemas/index.js`

### Requirement 7: Scaffold Validation

**User Story:** As a user, I want the system to catch scaffold errors before writing to disk so that I never end up with a broken workspace.

#### Acceptance Criteria

1. THE BuilderChatService SHALL validate that the scaffold `name` is kebab-case and between 1-64 characters
2. THE BuilderChatService SHALL validate that exactly one node in the scaffold has `entry: true`
3. THE BuilderChatService SHALL validate that every edge `from` and `to` field references an existing node ID in the scaffold
4. THE BuilderChatService SHALL validate that every tool with `source: 'library'` exists in the Library_Catalog
5. THE BuilderChatService SHALL validate that every tool with `source: 'mcp'` has a non-empty `mcpServer` field
6. THE BuilderChatService SHALL validate that router nodes have zero tools and zero skills
7. THE BuilderChatService SHALL validate that all node instructions are non-empty strings
8. IF validation fails, THEN THE BuilderChatService SHALL return a ServiceResult with error code `SCAFFOLD_INVALID` and the list of specific validation failures

### Requirement 8: Scaffold-to-Workspace Generation

**User Story:** As a user, I want the system to generate a complete `.agentflow/` directory from my scaffold so that I can immediately switch to Graph Mode and see my agent workflow.

#### Acceptance Criteria

1. WHEN a validated scaffold is submitted for generation, THE ScaffoldGenService SHALL create the `.agentflow/` directory structure with root AGENTS.md, workflow AGENTS.md, and one node directory per scaffold node
2. THE ScaffoldGenService SHALL generate root AGENTS.md with YAML frontmatter (type, name, description, identity block) and body containing workflow discovery refs, tool refs, skill refs, and memory refs
3. THE ScaffoldGenService SHALL generate each node's SKILL.md with YAML frontmatter (name, type, entry, context.max_tokens) and body containing context budget section, instructions, and edge refs using correct `{{-> nodes/target}}` syntax
4. THE ScaffoldGenService SHALL copy referenced library resources (tools, skills, templates, interactions, memory) from the `library/` directory into the generated `.agentflow/` directory
5. WHEN conditional edges reference template names not already copied from the library, THE ScaffoldGenService SHALL generate template markdown files for those conditions
6. AFTER writing all files, THE ScaffoldGenService SHALL call `parseRoot()` and `validate()` to verify the roundtrip property (zero validation errors)
7. IF roundtrip verification fails, THEN THE ScaffoldGenService SHALL roll back the generated directory (delete it) and return a ServiceResult error with validation details
8. THE ScaffoldGenService SHALL write all files using `atomicWrite()` (tmp-then-rename pattern from Spec 1)
9. THE ScaffoldGenService SHALL generate root AGENTS.md content that fits within 800 tokens

### Requirement 9: Conversation Phase Management

**User Story:** As a user, I want the builder conversation to progress through clear phases so that I understand where I am in the agent creation process and what comes next.

#### Acceptance Criteria

1. THE BuilderChatService SHALL support six ordered phases: intent, pattern, tools, nodes, review, complete
2. WHEN a phase transition occurs, THE BuilderChatService SHALL only advance forward in the phase sequence (intent → pattern → tools → nodes → review → complete)
3. WHEN the user explicitly requests to revisit an earlier topic, THE BuilderChatService SHALL allow backward phase transitions
4. WHEN the intent phase completes, THE BuilderChatService SHALL have extracted: purpose, suggested pattern, clarifying questions, and suggested name
5. WHEN the tools phase completes, THE BuilderChatService SHALL have selected: confirmed pattern, tools with sources, skills, and optional interactions/memory
6. WHEN the nodes phase completes, THE BuilderChatService SHALL have generated: node list with IDs/types/instructions, edge list, and identity block

### Requirement 10: Error Recovery

**User Story:** As a user, I want the builder to recover gracefully from errors so that I never lose my conversation progress or get stuck.

#### Acceptance Criteria

1. IF the LLM returns invalid JSON twice (initial + retry), THEN THE Builder_Agent SHALL offer a template fallback: "Would you like to start from a template instead?" with a template selector
2. IF the LLM suggests tools not in the Library_Catalog, THEN THE Builder_Agent SHALL filter them out, warn the user with the removed tool names, and suggest similar alternatives from the catalog
3. IF an SSE connection drops due to a network error, THEN THE StreamProvider SHALL preserve all conversation history and accumulated scaffold, and offer a "Retry" option
4. IF scaffold validation fails when the user clicks "Create Agent", THEN THE Agent_Preview_Sidebar SHALL display the specific validation errors with fix suggestions
5. IF roundtrip verification fails after workspace generation, THEN THE ScaffoldGenService SHALL roll back the directory and return the validation errors to the user
6. THE Builder_Agent SHALL preserve conversation history across all error scenarios — messages only accumulate, never delete

### Requirement 11: Onboarding Walkthrough

**User Story:** As a new user, I want a guided tour of the interface so that I understand the key areas of the application without reading documentation.

#### Acceptance Criteria

1. WHEN a user visits the application for the first time (no `af-onboarding-complete` in localStorage), THE OnboardingProvider SHALL auto-start the 5-step tooltip tour
2. THE OnboardingProvider SHALL render each tour step as a shadcn Popover anchored to the target element via CSS selector (`[data-tour="canvas"]`, `[data-tour="explorer"]`, `[data-tour="details"]`, `[data-tour="mode-switch"]`, `[data-tour="protocols"]`)
3. WHEN the user clicks "Next", THE OnboardingProvider SHALL advance to the next tour step
4. WHEN the user clicks "Skip" or "Done", THE OnboardingProvider SHALL set `af-onboarding-complete` in localStorage and dismiss the tour
5. WHEN the user clicks the help button in the action bar, THE OnboardingProvider SHALL reset and restart the tour
6. IF a tour step's target element is not present in the DOM, THEN THE OnboardingProvider SHALL skip to the next step
7. WHEN the tour is completed or skipped, THE OnboardingProvider SHALL persist the state to localStorage with a version field for future migration support
8. THE existing Spec 1 components (ThreePanelLayout, ActionBar, Canvas wrapper, panel containers) SHALL have `data-tour` attributes added to their root elements so the onboarding popovers have anchor targets

### Requirement 12: SSE Wire Format

**User Story:** As a developer, I want a well-defined SSE event format so that the frontend and backend communicate reliably during streaming.

#### Acceptance Criteria

1. THE BuilderChatService SHALL send each SSE event as a JSON line prefixed with `data: ` followed by a newline
2. THE BuilderChatService SHALL include a `type` field in every SSE event (one of: text_delta, scaffold_update, tool_suggestion, pattern_suggestion, phase_change, error, done)
3. WHEN an `error` event has `recoverable: true`, THE StreamProvider SHALL continue listening for more events on the same stream
4. WHEN an `error` event has `recoverable: false`, THE StreamProvider SHALL treat it as stream termination
5. THE StreamProvider SHALL buffer partial SSE lines across chunks and only parse complete `data: ` lines
6. THE StreamProvider SHALL silently skip malformed JSON lines without crashing

### Requirement 13: Zustand Builder Slice

**User Story:** As a developer, I want the builder chat state managed in a dedicated Zustand slice so that scaffold, messages, and phase state are accessible across components and persist correctly during mode switches.

#### Acceptance Criteria

1. A new `builder-slice.ts` SHALL be created in `ui/src/store/slices/` managing: messages (ChatMessage[]), scaffold (AgentScaffold | null), currentPhase (BuilderPhase), isStreaming (boolean), and error (string | null)
2. THE builder slice SHALL be integrated into `create-store.ts` alongside the existing workflow, ui, validation, execution, and library slices
3. THE builder slice SHALL preserve its state when the user switches between Graph Mode and Chat Mode so conversation progress is not lost
4. THE builder slice SHALL expose actions: addMessage, updateScaffold, setPhase, setStreaming, setError, resetBuilder

