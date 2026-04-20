# Requirements: Foundation + Core UI (Spec 1 of 4)

## Requirement 1: White-Label Branding Config
### User Stories
- As an open-source adopter, I want to configure the product name, directory name, and CLI command so I can white-label AgentFlow under my own brand.
- As a developer, I want zero-config defaults so AgentFlow works out of the box without any branding setup.

### Acceptance Criteria
- [ ] `loadBrandConfig()` resolves config with precedence: env vars > `agentflow.config.json` > defaults
- [ ] Default brand: name="AgentFlow", dir=".agentflow", cli="agentflow"
- [ ] Backend reads `dir` from BrandConfig instead of hardcoding `.agentflow` in parser, server, CLI
- [ ] Frontend fetches brand config from `GET /api/brand` and renders configured name
- [ ] Invalid config file falls back to defaults with a logged warning
- [ ] Invalid env vars fail at startup with a clear error message
- [ ] Zod schema validates BrandConfig shape

## Requirement 2: Backend Service Layer
### User Stories
- As a developer, I want modular services with consistent error handling so I can maintain and extend the backend without touching a 1344-line monolith.
- As an API consumer, I want structured error responses so I can handle failures programmatically.

### Acceptance Criteria
- [ ] `server.js` route handlers extracted into `src/services/` (WorkflowService, ValidationService, TemplateService, OrchestratorService, GitService)
- [ ] All service methods return `ServiceResult<T>` — success XOR error, never both
- [ ] All API endpoints validated with Zod schemas (currently missing on orchestrator, git, tokens, dry-run routes)
- [ ] Structured logging enabled via pino (Fastify's native logger)
- [ ] Rate limiting active via `@fastify/rate-limit` (default: 100 req/min)
- [ ] `serve-handler` dependency removed, `@fastify/static` used exclusively
- [ ] Routes extracted to `src/routes/` directory (one file per service domain)
- [ ] `ErrorCode` enum in `src/errors.ts` with all error codes
- [ ] `handleServiceRequest()` pipeline: Zod validate → service method → catch unexpected errors

## Requirement 3: MUI → shadcn/ui Migration
### User Stories
- As a user, I want a modern, flat, consistent UI that looks like tools I already use (Cursor, v0, LangGraph Studio).
- As a developer, I want components I own (copy-paste, not npm dependency) so I can customize without fighting a framework.

### Acceptance Criteria
- [ ] All `@mui/material` imports removed from every file in `ui/src/`
- [ ] `@mui/material`, `@emotion/react`, `@emotion/styled` removed from `package.json`
- [ ] shadcn/ui components copied into `ui/src/components/ui/` (from `open-agent-platform` repo or via CLI)
- [ ] All `sx` prop usage replaced with Tailwind classes
- [ ] MUI `ThemeProvider` replaced with CSS variable theme system
- [ ] Design tokens defined as CSS variables in `globals.css` (light + dark sets)
- [ ] Custom themes supported via `.css` files that override CSS variables
- [ ] `agentflow.config.json` supports `"theme"` field pointing to custom CSS file
- [ ] Inter + JetBrains Mono fonts replace Roboto + Roboto Mono
- [ ] Bundle size < 200KB gzipped (down from ~500KB with MUI)

## Requirement 4: Three-Panel Layout
### User Stories
- As a user, I want resizable panels so I can adjust the workspace to my screen and workflow.
- As a user, I want keyboard shortcuts to toggle panels so I can maximize canvas space quickly.

### Acceptance Criteria
- [ ] Three-panel layout using `react-resizable-panels` (left, center, right)
- [ ] Left panel tabs: Explorer, Elements, Library (shadcn Tabs)
- [ ] Right panel tabs: Details, Validation, Logs, Protocols (shadcn Tabs)
- [ ] Panels are collapsible with Cmd+B (left) and Cmd+J (right)
- [ ] Panel widths persist to localStorage via `autoSaveId`
- [ ] Status bar at bottom: workspace path, validation counts, node count, brand name
- [ ] Command palette via shadcn Command (cmdk) — Cmd+K to open
- [ ] Toast notifications via sonner (replaces MUI SnackbarQueue)
- [ ] Mode switcher in action bar: Graph / Chat (Chat Mode rendered in Spec 2)

## Requirement 5: Canvas Node Redesign
### User Stories
- As a user, I want to visually distinguish node types at a glance so I can understand workflow structure quickly.
- As a user, I want to see node status during execution so I know what's running.

### Acceptance Criteria
- [ ] Custom `WorkflowNode` React Flow component with colored accent bars (blue=step, purple=router, teal=sub-workflow)
- [ ] Node shows: lucide icon, name, type badge, tool count, status dot
- [ ] Hover shows description tooltip (shadcn Tooltip)
- [ ] Selected node has ring border and populates right panel Details tab
- [ ] Custom `WorkflowEdge` component: solid for unconditional, dashed for conditional with label
- [ ] Nodes wrapped in `React.memo` with stable callback refs
- [ ] Node colors use CSS variables (`--node-step`, `--node-router`, `--node-sub-workflow`)

## Requirement 6: Zustand Store Splitting
### User Stories
- As a developer, I want domain-specific store slices so I can test and modify state logic independently.
- As a user, I want undo/redo for workflow changes but not for UI state changes.

### Acceptance Criteria
- [ ] Store split into 5 slices: workflowSlice, uiSlice, validationSlice, executionSlice, librarySlice
- [ ] Backward-compatible `useAppStore` export — existing component selectors continue working
- [ ] Undo/redo via zundo only on workflowSlice
- [ ] localStorage persistence for UI preferences (theme, panel widths, collapsed state)
- [ ] Each slice independently testable with Vitest

## Requirement 7: Shared Utilities (DRY)
### User Stories
- As a developer, I want shared utilities for path validation, file I/O, and error handling so I don't duplicate logic across services.

### Acceptance Criteria
- [ ] `validatePath()` extracted to `src/utils/validate-path.ts` — checks traversal, symlinks, null bytes
- [ ] `atomicWrite()` extracted to `src/utils/file-io.ts` — tmp-then-rename pattern
- [ ] `safeDelete()` in same file — validates path before deletion
- [ ] `ErrorCode` enum and `toServiceError()` helper in `src/errors.ts`
- [ ] Zod schemas organized in `src/schemas/` directory with index re-exports
- [ ] All services use these shared utilities instead of inline implementations
