# AgentFlow Release Kanban

## To Do

| # | Task | Priority |
|---|------|----------|
| 1 | Add root `.gitignore` | P0 |
| 2 | Rotate exposed API keys (studio/.env.local) | P0 |
| 3 | Create `.env.example` with placeholder keys | P0 |
| 4 | Add `README.md` | P0 |
| 5 | Add `LICENSE` file (MIT) | P0 |
| 6 | Verify studio production build (`next build`) | P1 |
| 7 | Remove/exclude `_archive/` from distribution | P1 |
| 8 | Add proper `index.js` public API entry point | P1 |
| 9 | Add `"engines"` and `"files"` fields to package.json | P1 |
| 10 | Deduplicate `studio/lib/` ↔ `src/` shared code | P1 |
| 11 | Add `CHANGELOG.md` | P2 |
| 12 | Add `CONTRIBUTING.md` | P2 |
| 13 | Set up CI/CD (GitHub Actions) | P2 |
| 14 | Add error boundary in Studio UI | P2 |
| 15 | Publish docs site from `docs/` | P2 |
| 18 | Audit Protocols panel — real or placeholder? | P1 |
| 31 | Light theme: off-white Notion-style (done but needs polish) | P2 |
| 32 | **FEATURE: Skills.sh Deep Integration** | P0 |
|    | - Multi-skill install: save all as resources, not just one | |
|    | - Ref resolution on import: parse SKILL.md cross-refs → agentflow refs | |
|    | - Adapter layer: SKILL.md frontmatter → agentflow node frontmatter | |
|    | - Drag resource onto canvas → creates node with content + refs wired | |
|    | - Preview panel: show all skills + detected refs before confirming | |
| 33 | **FIX: Sub-workflow node system** — mostly done, needs position + journey polish | P1 |
| 34 | **Node creation UX journey** | P1 |
|    | - New node appears where user clicked/dropped, not random | |
|    | - Auto-select + open NodeCard immediately | |
|    | - Visual hint to connect (pulsing handle or tooltip) | |
|    | - No reload on create — instant feedback | |
| 35 | **Skeleton loading UI** — shimmer placeholders for panels, canvas, node cards | P1 |
| 36 | **Pre-made node templates** — when creating a node, offer templates with pre-filled content | P1 |
|    | - Agent node: pre-filled instructions section, capability refs | |
|    | - Gateway node: pre-filled conditions, routing logic | |
|    | - Workflow node: pre-filled with linked workflow | |
|    | - Template picker in NodeCard or on create | |
| 37 | **FIX: Entry point + AGENTS.md resolution** | P0 |
|    | - Root identity file detection should be dynamic, not hardcoded | |
|    | - Entry point logic in UI — nodes marked entry don't behave correctly | |
|    | - Audit parser entry point detection | |
|    | - Fix "Workspace Identity" button in Files tab | |
| 38 | **FIX: Drag-drop workflow node not rendering on canvas** | P0 |
|    | - api.create response may not include node in ReactFlow format | |
|    | - Need to verify createNode → set(data) → Canvas re-render chain | |
| 40 | **Clean up nested .agentflow/.agentflow/** — data/example issue | P0 |
| 41 | ✅ **Workspace Identity system redesign** — done via `{{$var}}` template system | P0 |
| 42 | **Workspace adapter layer** — remaining items | P0 |
|    | - TODO: Stop server auto-loading examples on boot | |
|    | - TODO: OPFS as default working copy, sync to folder/git | |
|    | - TODO: Test sync engine in production (Chrome, Safari, Firefox) | |

| 49 | **Update & author test suite** | P1 |
|    | - Fix `mcp-tool-provider.test.js` — 7 failures, all `Cannot read properties of undefined (reading 'nodes')` (workflow name changed or examples moved) |  |
|    | - Fix `import-service.test.js` — 2 failures, `importFromLibrary` tests broken |  |
|    | - Add tests for `/api/export` route: verify raw/parsed/default format dispatch |  |
|    | - Add tests for `defaultExport` with `workflowId` scoping |  |
|    | - Add tests for `exportRaw`/`exportParsed` round-trip (structured-exporter) |  |
|    | - Add tests for `ExportPipeline` fidelity reporting |  |

## In Progress

| # | Task | Priority |
|---|------|----------|

## Completed

| # | Task | Priority |
|---|------|----------|
| 16 | Skills.sh search API route + Discover tab | P1 |
| 17 | Remove FAB from Playground | P1 |
| 19 | Kill duplicate panels (ResourcePalette, LibraryBrowser standalone) | P1 |
| 20 | Explorer redesign: Files / Assets / Discover tabs | P1 |
| 21 | Skills.sh install via npx + auto-classify into taxonomy | P1 |
| 22 | Install preview → confirm → rollback flow | P1 |
| 23 | Toast UX: actionable, richColors, category labels | P1 |
| 24 | Dark theme contrast bump | P1 |
| 25 | Files tab: clean file tree with agentflow category icons | P1 |
| 26 | Assets: remove confusing checkmarks, grid/list toggle, persist view | P1 |
| 27 | Action bar: slimmed down, "more" menu, search bar | P1 |
| 28 | Menubar: wired to events, Assets/Discover/Skills.sh links | P1 |
| 29 | Floating panel solid background (no jitter) | P1 |
| 30 | Files tab scoped to active workflow + shared resources | P1 |
| 39 | **Auto-create workflow on "Add manually"** — useCreateNode now creates "main" workflow if none exists | P1 |
| 43 | **UI Polish Pass** | P1 |
|    | - ✅ Empty canvas state: shows "Ask Flow" + "Browse skills" + manual add when no workflows OR empty workflow | |
|    | - ✅ Library workflow templates in ActionBar workflow dropdown (lazy-loaded, install on click) | |
|    | - ✅ WorkspaceSetup cleaned: standardized on openWorkspace(adapter) pattern, no mode branching | |
|    | - TODO: WorkspaceSetup: test on Chrome, Safari, Firefox | |
|    | - TODO: Panel animations, node cards, canvas polish | |
| 44 | **On-platform agent (Flow) — backend** | P0 |
|    | - ✅ `lib/runtime.ts` — unified mode detection, workspace resolution, key management (replaces 4 files) | |
|    | - ✅ `agent.ts` rewritten — session-aware, dogfoods .agentflow/ workflows via listWorkflows + activateNode | |
|    | - ✅ Knowledge base tool (queryKnowledgeBase — queries knowledge-index.md on demand) | |
|    | - ✅ Web search tool (Tavily API) + TAVILY_API_KEY in settings | |
|    | - ✅ 4 subagents (validator, builder, researcher, reviewer) | |
|    | - ✅ Memory tools (readMemory, writeMemory) — persistent cross-session | |
|    | - ✅ Local vs online mode — shell disabled online, session-scoped workspaces | |
|    | - ✅ Fixed `tools[0].type` error — use LangChain `tool()` not CopilotKit `defineTool` | |
| 45 | **On-platform agent (Flow) — frontend** | P0 |
|    | - ✅ CopilotPanel rewritten — welcome screen with workflow picker, model picker, context chip | |
|    | - ✅ Tool renderers for webSearch, queryKnowledgeBase, readMemory, writeMemory, listWorkflows, activateNode | |
|    | - ✅ FlowChatPanel — headless CopilotKit chat with custom message rendering | |
| 46 | **FloatingPanel redesign** | P1 |
|    | - ✅ `useFloatingPanel` hook — zero re-renders during drag/resize, all 8 edges/corners | |
|    | - ✅ Maximize/restore, viewport clamping, visible resize grip | |
|    | - ✅ Fixed CopilotChat resize (overflow-hidden instead of overflow-auto) | |
| 47 | **Workspace sync engine** | P1 |
|    | - ✅ `lib/workspace/sync.ts` — diff/apply/snapshot between any two adapters | |
|    | - ✅ `lib/workspace/index.ts` — standardized API: openWorkspace, freshIDB, importFileList, listLibraryWorkflows | |
|    | - TODO: Wire sync UI (button in Git panel or StatusBar) | |
|    | - TODO: Auto-sync on save (debounced) | |
|    | - TODO: Conflict resolution dialog | |
| 48 | **FIX: Export route + format dispatch + workspace identity** | P0 |
|    | - ✅ `/api/export` branches on `format`: raw → `exportRaw`, parsed → `exportParsed`, default → `defaultExport` | |
|    | - ✅ workflowId validation for raw/parsed (required, returns 400) | |
|    | - ✅ Export routes accept browser workspace files (source of truth) | |
|    | - ✅ `{{$var}}` template system: `$workflows`, `$resources`, `$directory`, `$execution` resolved at export time | |
|    | - ✅ Workspace AGENTS.md always root, workflow AGENTS.md at `<wf>/AGENTS.md` — all 3 formats | |
|    | - ✅ `syncIdentity` removed — template vars handle dynamic content at export time | |
|    | - ✅ Parser excludes `$`-prefixed tokens from mention regex | |
|    | - ✅ UI: RefBadge + MarkdownPreview render `{{$var}}` as violet chips with tooltip | |
|    | - ✅ Scaffold updated with `{{$var}}` tags (workspace/index.ts, bin/cli.js) | |
|    | - ✅ All scaffold entry points unified on `DEFAULT_AGENTS_MD` | |
|    | - ✅ Full backward-compat code removed — single code path | |
| 50 | **Platform Standardization** | P0 |
|    | - ✅ Single schema source of truth: `src/schemas/frontmatter-schemas.js` — 6 types, consumed by validator + form | |
|    | - ✅ Export pipeline: `collectWorkflowFiles()` + `toFileMap()` shared by all 3 formats | |
|    | - ✅ Workspace-server sync: `parseClientFiles()` helper used by 3 API routes | |
|    | - ✅ Resource type taxonomy: parser normalizes legacy names (tool→capability, skill→instruction) | |
|    | - ✅ Node outputs standardized as `string[]` everywhere | |
|    | - ✅ `narrativeTemplate` added to all resource schemas — now validated | |
|    | - ✅ AGENTS.md form support: `agents` schema with identity group | |
