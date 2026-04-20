# Tasks: Cross-Platform Transport

## Part 1: Backend Foundation

- [x] 1. Parser: Add `steering` to RESERVED_DIRS and RESERVED_DIR_TYPE_MAP
  - [x] 1.1 Add `'steering'` to `RESERVED_DIRS` array and `steering: 'steering'` to `RESERVED_DIR_TYPE_MAP` in `src/parser.js`
  - [x] 1.2 Update `parseRoot()` to populate `graph.steering` as `Record<string, ParsedFile>` (same shape as `graph.tools`)
  - [x] 1.3 Add unit test: parse example workspace with `steering/` dir, verify `graph.steering` is populated

- [x] 2. Parser: Load hooks JSON into graph
  - [x] 2.1 In `parseRoot()`, after md parsing, scan `.agentflow/hooks/` for `*.json` files, `JSON.parse` each, attach to `graph.hooks` as `Record<string, HookDefinition>`
  - [x] 2.2 Skip invalid JSON files with a console.warn (graceful degradation)
  - [x] 2.3 Add unit test: parse workspace with `hooks/*.json`, verify `graph.hooks` is populated and invalid files are skipped

- [x] 3. HookRegistry service
  - [x] 3.1 Create `src/services/hook-registry.js` with `loadAll()`, `reload()`, `getHooksForEvent()`, `addHook()`, `removeHook()`, `updateHook()`, `list()`
  - [x] 3.2 Validate hooks against `HookDefinitionSchema` (zod) on load and write
  - [x] 3.3 File I/O: read/write individual `.json` files in `.agentflow/hooks/`
  - [x] 3.4 Add unit tests for CRUD operations and event filtering

- [x] 4. EventHookEngine service
  - [x] 4.1 Create `src/services/event-hook-engine.js` with `emit()`, `registerEventType()`, `listEventTypes()`
  - [x] 4.2 Implement `evaluateCondition()` (equals, contains, matches, startsWith, endsWith) with ReDoS guard on `matches`
  - [x] 4.3 Implement `evaluateAndFireHooks()` — sort by priority, evaluate conditions, fire actions sequentially
  - [x] 4.4 Register `BUILT_IN_EVENTS` from design (fileEdited, fileCreated, preToolUse, etc.)
  - [x] 4.5 Add unit tests for condition evaluation (all operators + edge cases) and hook firing order

- [x] 5. SteeringManager service
  - [x] 5.1 Create `src/services/steering-manager.js` with `loadAll()`, `getSteeringContext()`, `list()`, `add()`, `remove()`
  - [x] 5.2 Implement frontmatter-based inclusion logic (auto vs manual)
  - [x] 5.3 Add unit tests for loading, filtering by inclusion mode, and CRUD

- [x] 6. Server routes: Hooks API
  - [x] 6.1 Add `GET /api/hooks` → list all hooks
  - [x] 6.2 Add `GET /api/hooks/event-types` → list registered event types
  - [x] 6.3 Add `POST /api/hooks` → create hook (validate with zod, write .json file)
  - [x] 6.4 Add `PATCH /api/hooks/:name` → update hook
  - [x] 6.5 Add `DELETE /api/hooks/:name` → delete hook file

- [x] 7. Server routes: Steering API
  - [x] 7.1 Add `GET /api/steering` → list steering docs with metadata
  - [x] 7.2 Add `POST /api/steering` → create new steering doc
  - [x] 7.3 Add `PATCH /api/steering/:name` → update steering doc
  - [x] 7.4 Add `DELETE /api/steering/:name` → delete steering doc

## Part 2: UI — Types, Constants, Explorer

- [x] 8. Update UI types and constants for steering + hooks
  - [x] 8.1 Add `'steering' | 'hooks'` to `ResourceCategory` union in `ui/src/types.ts`
  - [x] 8.2 Add `steering` and `hooks` to `WorkflowGraph` interface in `ui/src/types.ts`
  - [x] 8.3 Add `steering` and `hooks` category defs to `CATEGORIES` in `ui/src/constants.ts` (Compass + Webhook icons, colors from design)
  - [x] 8.4 Add `{ key: 'steering', label: 'Steering' }` and `{ key: 'hooks', label: 'Hooks' }` to `SIDEBAR_SECTIONS`
  - [x] 8.5 Add `'steering', 'hooks'` to `RESOURCE_CATEGORIES` array in `ui/src/utils/buildExplorerSections.ts`

- [x] 9. Explorer CRUD: SectionGroup add button + item context menu
  - [x] 9.1 Add a `+` (Plus) icon button to `SectionGroup` header — calls `POST /api/create` with category-appropriate path and scaffold content
  - [x] 9.2 Create a shared `ExplorerItemMenu` component (DropdownMenu with Rename, Delete, Duplicate) — reused by all sections
  - [x] 9.3 Rename action: inline rename input that calls `POST /api/move` on confirm
  - [x] 9.4 Delete action: confirmation then `POST /api/delete`
  - [x] 9.5 Duplicate action: `POST /api/create` with copied content and `-copy` suffix
  - [x] 9.6 After any CRUD action, refetch `/api/data` to refresh the Explorer

- [x] 10. ResourceCard: Steering-specific badge
  - [x] 10.1 In ResourceCard, if `frontmatter.inclusion` exists, render an "AUTO" or "MANUAL" badge (small, inline, using existing Badge component)

## Part 3: UI — Hooks in ProtocolPanel

- [x] 11. HooksSection in ProtocolPanel
  - [x] 11.1 Add `HooksSection` component inside ProtocolPanel — fetches from `GET /api/hooks` and `GET /api/hooks/event-types`
  - [x] 11.2 Add `HookCard` component — displays name, enabled toggle, event badge, condition summary, action target, delete button
  - [x] 11.3 Add `HookForm` component — inline add/edit form with name, event dropdown, condition builder, action type + target, priority input
  - [x] 11.4 Wire HookCard toggle to `PATCH /api/hooks/:name` (enabled field), delete to `DELETE /api/hooks/:name`
  - [x] 11.5 Wire HookForm save to `POST /api/hooks` (new) or `PATCH /api/hooks/:name` (edit)

## Part 4: Transport Layer

- [x] 12. TransportRegistry + PlatformAdapter engine + AdapterFactory
  - [x] 12.1 Create `src/transport/platform-adapter.js` — single generic class that takes a `PlatformMappingConfig`, implements `exportWorkspace()` and `importWorkspace()` by iterating config rules and calling named transforms
  - [x] 12.2 Create `src/transport/transport-registry.js` — register, get, list, supports, reject duplicate names
  - [x] 12.3 Create `src/transport/adapter-factory.js` — scans built-in dir (`src/transport/platforms/`) + user dir (`.agentflow/transport/`), deep-merges overrides, validates with `PlatformMappingConfigSchema`, creates `PlatformAdapter` instances
  - [x] 12.4 Create `src/transport/transforms.js` — transform registry with all named transform functions (passthrough, mcp-extract, identity conversions, workflow conversions, YAML generation, etc.)
  - [x] 12.5 Create `src/transport/utils.js` — `resolveGraphSource()`, `matchGlob()`, `extractName()`, `mergeIntoExisting()`, `deepMerge()` helpers
  - [x] 12.6 Add `MappingRuleSchema` and `PlatformMappingConfigSchema` zod schemas
  - [x] 12.7 Add unit tests for registry (register, get, list, duplicate rejection), factory (config loading, merge, validation), and engine (rule application with mock transforms)

- [x] 13. Built-in platform configs: Kiro + GitHub
  - [x] 13.1 Create `src/transport/platforms/kiro.json` — declarative mapping config per design (identity, steering, hooks, mcp, workflows, tools, memory rules)
  - [x] 13.2 Create `src/transport/platforms/github.json` — declarative mapping config per design (copilot-instructions, instructions, workflows, triggers rules)
  - [x] 13.3 Implement Kiro-specific transforms in `transforms.js`: `mcp-extract-servers`, `kiro-mcp-to-protocols`, `kiro-steering-to-identity`, `workflow-to-kiro-spec`, `kiro-spec-to-workflow`
  - [x] 13.4 Implement GitHub-specific transforms in `transforms.js`: `identity-to-copilot-instructions`, `copilot-instructions-to-identity`, `workflow-to-github-actions`, `github-actions-to-workflow`, `hooks-to-github-triggers`, `github-triggers-to-hooks`
  - [x] 13.5 Add `js-yaml` dependency for GitHub YAML transforms
  - [x] 13.6 Add unit tests: load each config → export fixture workspace → verify output structure; import fixture → verify AgentFlow structure

- [~] 14. _(removed — merged into 12 and 13)_

- [x] 15. Export/Import pipeline + server routes
  - [x] 15.1 Create `src/transport/export-pipeline.js` — `exportToPlatform()` with path safety validation
  - [x] 15.2 Create `src/transport/import-pipeline.js` — `importFromPlatform()` with validation + path safety
  - [x] 15.3 Add `GET /api/transport/platforms` route
  - [x] 15.4 Add `POST /api/transport/export` route
  - [x] 15.5 Add `POST /api/transport/import` route
  - [x] 15.6 Initialize `AdapterFactory` in server startup — loads built-in + user configs, registers all adapters into `TransportRegistry`

## Part 5: UI — Platform Export Tab

- [x] 16. Platform tab in ExportDialog
  - [x] 16.1 Add `'platform'` to format selector tabs in ExportDialog
  - [x] 16.2 Add platform selector dropdown — fetches from `GET /api/transport/platforms`, shows name + capabilities badges
  - [x] 16.3 Add export preview + execute — calls `POST /api/transport/export`, shows file tree + warnings + FidelityBadge per mapping
  - [x] 16.4 Add import section — file upload/paste, validate button, import button with result display
  - [x] 16.5 Add `FidelityBadge` inline component (direct/transform/lossy/skip with color coding)

## Part 6: Integration Tests

- [x] 17. Integration tests
  - [x] 17.1 End-to-end export: parse example workspace → export to Kiro → verify output file structure
  - [x] 17.2 End-to-end import: load Kiro fixture → import → verify valid AgentFlow workspace
  - [x] 17.3 Hook lifecycle: register hook → emit event → verify action triggered
  - [x] 17.4 Steering injection: create docs → getSteeringContext() → verify content
