# Tasks: Foundation + Core UI (Spec 1 of 4)

Tasks are grouped into parallel tracks. Tasks within the same track are sequential. Tracks can run simultaneously.

## Track A: Backend Foundation (no UI dependency)

- [x] 1. Shared utilities + error codes
  - [x] 1.1 Create `src/errors.js` with `ErrorCode` enum and `toServiceError()` helper
  - [x] 1.2 Create `src/utils/validate-path.js` — extract from `server.js`, add symlink resolution + null byte check
  - [x] 1.3 Create `src/utils/file-io.js` — `atomicWrite()` (tmp→rename) and `safeDelete()` (validate path + rm)
  - [x] 1.4 Create `src/schemas/` directory with Zod schemas extracted from `server.js` inline validations
  - [x] 1.5 Add unit tests for all three utilities in `tests/unit/`

- [x] 2. Branding config
  - [x] 2.1 Create `src/branding.js` — `loadBrandConfig()` with precedence: env > config file > defaults
  - [x] 2.2 Create `src/schemas/brand-schemas.js` — Zod schema for BrandConfig
  - [x] 2.3 Update `src/parser.js` — replace hardcoded `.agentflow` with `brandConfig.dir`
  - [x] 2.4 Update `src/cli.js` — replace hardcoded `agentflow` command name with `brandConfig.cli`
  - [x] 2.5 Add `GET /api/brand` endpoint returning the resolved BrandConfig
  - [x] 2.6 Add unit tests for `loadBrandConfig()` — defaults, config file, env vars, precedence

- [x] 3. Service layer refactor
  - [x] 3.1 Create `src/services/types.js` — `ServiceResult`, `ServiceError`, `ServiceContext` types
  - [x] 3.2 Create `src/services/workflow-service.js` — extract from `server.js`
  - [x] 3.3 Create `src/services/validation-service.js` — extract from `server.js`
  - [x] 3.4 Create `src/services/template-service.js` — extract from `server.js`
  - [x] 3.5 Create `src/services/orchestrator-service.js` — extract from `server.js`
  - [x] 3.6 Create `src/services/git-service.js` — extract from `server.js`
  - [x] 3.7 Create `src/routes/` directory — one route file per service
  - [x] 3.8 Refactor `server.js` to thin shell (create app, register plugins, register routes, start)
  - [x] 3.9 Enable pino logging, add `@fastify/rate-limit`, remove `serve-handler`
  - [x] 3.10 Add Zod schemas for all currently unvalidated endpoints
  - [x] 3.11 Verify all existing tests still pass after refactor

## Track B: UI Foundation (parallel with Track A)

- [x] 4. shadcn/ui setup + MUI removal
  - [x] 4.1 Copy shadcn/ui component files from `open-agent-platform` into `ui/src/components/ui/`
  - [x] 4.2 Install shadcn deps: `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `cmdk`, `sonner`
  - [x] 4.3 Create `ui/src/lib/utils.ts` with `cn()` function
  - [x] 4.4 Create `ui/src/globals.css` with CSS variable token system (light + dark + node colors)
  - [x] 4.5 Install Inter + JetBrains Mono fonts, remove Roboto
  - [x] 4.6 Create `ui/src/themes/` directory with `midnight.css` example
  - [x] 4.7 Remove `@mui/material`, `@emotion/react`, `@emotion/styled` from `ui/package.json`

- [x] 5. Migrate components from MUI to shadcn
  - [x] 5.1 Migrate `App.tsx` — remove all MUI imports, replace with shadcn
  - [x] 5.2 Migrate `DropConfigModal` — MUI Dialog → shadcn Dialog
  - [x] 5.3 Replace `SnackbarQueue` with sonner `<Toaster />`
  - [x] 5.4 Migrate `CommandPalette` → shadcn Command (cmdk)
  - [x] 5.5 Migrate `ActionBar` — MUI buttons → shadcn Button
  - [x] 5.6 Migrate `NodeDrawer`, `MCPPanel`, `ValidationPanel`, `GitPanel` — MUI → shadcn
  - [x] 5.7 Migrate `ExplorerPanel`, `ElementsView`, `Editor` — MUI → shadcn
  - [x] 5.8 Replace MUI `ThemeProvider` with CSS class toggle
  - [x] 5.9 Grep for remaining `@mui` or `sx=` references — fix all
  - [x] 5.10 Verify app builds and renders without MUI

- [x] 6. Three-panel layout
  - [x] 6.1 Install `react-resizable-panels`
  - [x] 6.2 Create `ThreePanelLayout.tsx` using PanelGroup/Panel/PanelResizeHandle
  - [x] 6.3 Create `ActionBar.tsx` — brand name, mode switcher, global actions
  - [x] 6.4 Create `StatusBar.tsx` — workspace path, validation counts, node count
  - [x] 6.5 Wire left panel tabs (Explorer, Elements, Library) and right panel tabs (Details, Validation, Logs, Protocols)
  - [x] 6.6 Add keyboard shortcuts: Cmd+B, Cmd+J, Cmd+K
  - [x] 6.7 Integrate sonner Toaster at app root
  - [x] 6.8 Update `App.tsx` to use ThreePanelLayout instead of AppShell

- [x] 7. Canvas node redesign
  - [x] 7.1 Create `WorkflowNode.tsx` — step/router/sub-workflow with accent bars
  - [x] 7.2 Create `WorkflowEdge.tsx` — solid/dashed with condition labels
  - [x] 7.3 Register custom node/edge types in React Flow config
  - [x] 7.4 Wrap WorkflowNode in React.memo with stable refs
  - [x] 7.5 Update Canvas.tsx to use new node/edge types
  - [x] 7.6 Verify canvas renders with example workflow

## Track C: State Management (after Task 4)

- [x] 8. Zustand store splitting
  - [x] 8.1 Create `ui/src/store/slices/workflow-slice.ts`
  - [x] 8.2 Create `ui/src/store/slices/ui-slice.ts`
  - [x] 8.3 Create `ui/src/store/slices/validation-slice.ts`
  - [x] 8.4 Create `ui/src/store/slices/execution-slice.ts`
  - [x] 8.5 Create `ui/src/store/slices/library-slice.ts`
  - [x] 8.6 Create `ui/src/store/create-store.ts` — combine slices, zundo on workflowSlice
  - [x] 8.7 Create `ui/src/store/index.ts` — backward-compatible `useAppStore` export
  - [x] 8.8 Add localStorage persistence for uiSlice
  - [x] 8.9 Verify all existing components work with new store
  - [x] 8.10 Add unit tests for each slice

## Track D: Integration + Verification (after A-C)

- [x] 9. Wire backend to frontend
  - [x] 9.1 Update frontend API calls to handle ServiceResult response shape
  - [x] 9.2 Wire GET /api/brand to ActionBar (render brand name)
  - [x] 9.3 Wire theme system to branding config (theme field loads custom CSS)
  - [x] 9.4 Verify full CRUD cycle: create → edit → save → validate → delete
  - [x] 9.5 Verify dark mode toggle works end-to-end

- [x] 10. Tests + cleanup
  - [x] 10.1 Run `vitest --run` — all existing tests pass
  - [x] 10.2 Add integration tests: API → Service → Parser → FileSystem
  - [x] 10.3 Add property-based tests: ServiceResult exclusivity, path validation, brand config precedence
  - [x] 10.4 Remove old `ui-mockup.html` if present
  - [x] 10.5 Verify `npm run dev` starts both API and UI correctly
