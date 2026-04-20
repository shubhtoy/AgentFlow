# Implementation Plan: UI Overhaul

## Overview

Comprehensive UI overhaul for AgentFlow v2 organized into parallel execution tracks. Track A (Foundation) must complete first as shared infrastructure. Tracks B–G can then execute concurrently. Track H integrates everything.

## Tasks

- [x] 1. Track A: Foundation — Shared Infrastructure
  - [x] 1.1 Install new dependencies
    - Run: `npm install @fontsource/inter @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @tiptap/suggestion lucide-react js-yaml jszip`
    - Run: `npm install -D @types/js-yaml fast-check`
    - _Requirements: 1.1, 8.1_

  - [x] 1.2 Update CATEGORY_CONFIG with Lucide icons
    - In `ui/src/constants.ts`, replace emoji `icon` strings with Lucide icon component references (`Wrench`, `Brain`, `Zap`, `MessageSquare`, `Database`, `Box`, `ArrowUpRight`, `GitBranch`)
    - Update the type signature to `icon: LucideIcon` instead of `icon: string`
    - Ensure `color` and `chip` fields use distinct values per category
    - _Requirements: 8.1, 8.2, 8.6, 8.7_

  - [ ]* 1.3 Write property test for CATEGORY_CONFIG uniqueness
    - **Property 16: CATEGORY_CONFIG uniqueness**
    - **Validates: Requirements 8.1, 8.2, 8.6, 8.7**

  - [x] 1.4 Define CSS variables and Inter font in `ui/src/index.css`
    - Import `@fontsource/inter`
    - Define `:root` CSS custom properties: `--surface-primary`, `--surface-secondary`, `--surface-elevated`, `--border-primary`, `--text-primary`, `--text-secondary`, `--text-muted`, `--radius-default`, `--font-body`
    - Define `.dark` overrides for all CSS variables (near-black backgrounds, muted text, low-contrast borders)
    - Apply Inter font family, muted zinc/slate/neutral palette, 1px subtle borders, 8px border-radius, 12–14px body text, 10–11px labels
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 12.7, 12.8_

  - [x] 1.5 Add new types to `ui/src/types.ts`
    - Add `ThemeMode`, `ResolvedTheme`, `IOContract`, `CompatibilityResult`, `LibraryEntry`, `NarrativeTemplate`, `StructuredExportOptions`, `Notification`, `ExplorerSection`, `ExplorerItem`, `SlashCommand`, `ResourceItem`, `EditorMode`
    - _Requirements: 10.5, 7.1, 11.2, 9.1_

  - [x] 1.6 Extend store state in `ui/src/store.tsx`
    - Add theme state: `themeMode`, `resolvedTheme`, `setThemeMode`
    - Add library state: `libraryEntries`, `librarySearch`, `libraryLoading`, `setLibrarySearch`, `loadLibrary`, `addFromLibrary`
    - Add panel toggles: `libraryPanelOpen`, `resourcePaletteOpen`, `toggleLibraryPanel`, `toggleResourcePalette`
    - Add notifications: `notifications`, `showNotification`, `dismissNotification`
    - _Requirements: 5.6, 12.3, 7.1_

  - [x] 1.7 Add API client methods in `ui/src/api.ts`
    - Add `getLibrary()`, `addLibraryItem(type, name)`, `exportStructured(options)` methods
    - _Requirements: 7.3, 9.7_

- [x] 2. Checkpoint — Foundation complete
  - Ensure all Track A tasks compile without errors, ask the user if questions arise.

- [x] 3. Track B: Theme System (after Track A)
  - [x] 3.1 Add FOUC prevention script in `index.html`
    - Add blocking `<script>` that reads `localStorage('af-theme')` and sets `dark` class on `<html>` before first paint
    - Handle invalid/missing stored values by defaulting to system preference
    - _Requirements: 12.6_

  - [x] 3.2 Create `ThemeProvider` component in `ui/src/components/ThemeProvider.tsx`
    - Listen to `prefers-color-scheme` media query changes when mode is `system`
    - Update `resolvedTheme` in store and toggle `dark` class on `<html>`
    - Persist theme mode to localStorage on change
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 3.3 Create `ThemeToggle` component in `ui/src/components/ThemeToggle.tsx`
    - Three-state toggle: light / dark / system
    - Reads and writes `themeMode` from store
    - _Requirements: 12.2_

  - [ ]* 3.4 Write property test for theme persistence round trip
    - **Property 30: Theme persistence round trip**
    - **Validates: Requirements 12.3, 12.4**

  - [ ]* 3.5 Write property test for dark mode contrast ratio
    - **Property 31: Dark mode contrast ratio**
    - **Validates: Requirements 12.12**

- [x] 4. Track C: Semantic Explorer (after Track A)
  - [x] 4.1 Implement `buildExplorerSections` function
    - Create `ui/src/utils/buildExplorerSections.ts`
    - Derive sections from `WorkflowGraph` data: iterate `data.tools`, `data.skills`, `data.templates`, `data.interactions`, `data.memory` for resource sections; `data.workflows` for workflows section; `data.workflows[activeWf].nodes` for nodes section
    - Omit sections with zero items
    - Each item uses human-readable name from frontmatter/title, not file path
    - Each section includes count badge value
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

  - [ ]* 4.2 Write property tests for explorer sections
    - **Property 1: Semantic explorer sections derived from WorkflowGraph**
    - **Property 2: Explorer item names match human-readable titles**
    - **Property 3: Explorer section count badge accuracy**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.5, 2.6**

  - [x] 4.3 Create `SemanticExplorer` component in `ui/src/components/SemanticExplorer.tsx`
    - Replace `DirectoryExplorer.tsx` usage
    - Render collapsible sections with Lucide icons, accent colors from CATEGORY_CONFIG
    - Display count badges on section headers
    - Hide raw frontmatter fields from item display
    - On item click, dispatch `store.select()` with correct Selection object
    - _Requirements: 2.1, 2.3, 2.4, 2.6, 2.7, 5.3, 5.4_

- [x] 5. Track D: Editor Extensions (after Track A)
  - [x] 5.1 Create RefChip tiptap Node extension in `ui/src/extensions/RefChipExtension.ts`
    - Define `refChip` Node: inline, atom, with attributes `raw`, `semanticType`, `category`, `refName`, `condition`
    - Add input rules to convert typed `{{...}}` into refChip nodes
    - Add paste rules for pasted ref tokens
    - Create `RefChipComponent` using `ReactNodeViewRenderer`: render mention refs as `[icon] name`, edge refs as `→ [icon] name`, conditional edge refs as `→ [icon] name | condition`, data flow refs as `⇠ output.name`
    - On chip click, dispatch `store.select()` for the referenced resource/node
    - Style chips using CATEGORY_CONFIG accent colors
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.10_

  - [ ]* 5.2 Write property tests for ref chip parsing and rendering
    - **Property 4: Ref token to chip node conversion**
    - **Property 5: Ref chip type indicator rendering**
    - **Property 6: Ref chip category extraction**
    - **Property 7: Ref chip click produces correct Selection**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

  - [x] 5.3 Create Slash Command Suggestion extension in `ui/src/extensions/SlashCommandExtension.ts`
    - Use `@tiptap/suggestion` API with `/` trigger character
    - Define command list: "Reference" category (tools, skills, templates, interactions, memory, nodes), "Edge" category (Edge_Ref, Conditional_Edge_Ref), "Data Flow" category (Data_Flow_Ref)
    - Implement fuzzy filter on name/category/description
    - Render `SlashCommandPalette` component with icons, names, descriptions, color coding
    - On resource-type command selection, show secondary picker listing available items of that type
    - On item selection, insert `refChip` node with correct attributes
    - Support keyboard navigation: Arrow Up/Down, Enter, Escape
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.11_

  - [ ]* 5.4 Write property tests for slash command filtering and insertion
    - **Property 8: Slash command fuzzy filter**
    - **Property 9: Slash command resource picker lists correct items**
    - **Property 10: Slash command ref insertion syntax**
    - **Validates: Requirements 4.5, 4.6, 4.7**

  - [x] 5.5 Create Narrative Block decoration plugin in `ui/src/extensions/NarrativeBlockPlugin.ts`
    - tiptap Decoration plugin that visually groups paragraphs containing ref chips
    - Render each block with subtle background/spacing/border for story structure visibility
    - Purely visual — no structural changes to underlying markdown
    - _Requirements: 11.5, 11.6, 11.9_

  - [ ]* 5.6 Write property test for narrative block detection
    - **Property 27: Narrative block detection**
    - **Validates: Requirements 11.5**

- [x] 6. Track E: DnD System (after Track A)
  - [x] 6.1 Add `DndContext` wrapper in `ui/src/App.tsx`
    - Wrap main layout with `@dnd-kit` `DndContext` provider
    - Set up drag overlay and drop zone detection
    - _Requirements: 7.3, 10.2_

  - [x] 6.2 Implement edge creation via `onConnect` in `ui/src/components/Canvas.tsx`
    - Use `@xyflow/react` `onConnect` callback
    - Check for duplicate edges; show notification if duplicate
    - Build `{{-> targetCategory/targetName}}` ref syntax
    - Append to source node's primary markdown, save via store, reload graph
    - Canvas always derives edges from parsed Ref_Tokens in markdown
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 6.3 Write property tests for edge creation
    - **Property 12: Edge creation ref syntax**
    - **Property 13: Graph edges derive from markdown refs**
    - **Property 14: Duplicate edge prevention**
    - **Validates: Requirements 6.1, 6.2, 6.4, 6.5, 6.6**

  - [x] 6.4 Implement IO contract parsing and compatibility checking
    - Create `ui/src/utils/compatibility.ts`
    - Parse `inputs`/`outputs` from frontmatter into `IOContract`
    - Implement `checkCompatibility(sourceOutputs, targetInputs): CompatibilityResult`
    - Advisory mode (default): allow operation, return warnings
    - Strict mode: reject on mismatch
    - Skip check when no IO contract declared
    - Generate mismatch descriptions with specific field names
    - _Requirements: 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12_

  - [ ]* 6.5 Write property tests for IO compatibility
    - **Property 23: IO contract parsing**
    - **Property 24: Compatibility check correctness**
    - **Property 25: Compatibility check mismatch descriptions**
    - **Validates: Requirements 10.5, 10.6, 10.7, 10.8, 10.9, 10.10**

  - [x] 6.6 Create `ResourcePalette` component in `ui/src/components/ResourcePalette.tsx`
    - Collapsible overlay panel showing all workspace resources as draggable items
    - Grouped by ResourceCategory with CATEGORY_CONFIG icons/colors
    - On drop onto canvas node: insert `{{category/name}}` Mention_Ref into target node's markdown
    - On drop onto editor: insert ref with narrative scaffolding (prefix/suffix from NarrativeTemplate or defaults)
    - Support resource move between nodes (remove from source, add to target)
    - Perform compatibility check on drop; show warning badge (advisory) or reject (strict)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.13, 11.1, 11.2, 11.3_

  - [ ]* 6.7 Write property tests for resource palette operations
    - **Property 21: Resource drop inserts Mention_Ref**
    - **Property 22: Resource move between nodes**
    - **Validates: Requirements 10.2, 10.3, 10.4**

  - [x] 6.8 Create `LibraryPanel` component in `ui/src/components/LibraryPanel.tsx`
    - Collapsible overlay panel toggled from Toolbar
    - Fetch library data via `api.getLibrary()`
    - Display entries grouped by ResourceType with icons/colors from CATEGORY_CONFIG
    - Search input with case-insensitive substring matching on name, description, tags
    - Items draggable via `@dnd-kit`; drop onto workspace triggers `addLibraryItem`
    - On successful add, reload workspace data
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ]* 6.9 Write property test for library search
    - **Property 15: Library search filtering**
    - **Validates: Requirements 7.1, 7.2**

  - [x] 6.10 Implement narrative ref composition helpers
    - Create `ui/src/utils/narrative.ts`
    - Define `DEFAULT_NARRATIVE` map per resource type (prefix/suffix)
    - Implement `getNarrativeScaffolding(resource): { prefix, suffix }` — uses frontmatter `narrativeTemplate` if declared, else defaults
    - Slash command insertion inserts bare refs (no scaffolding)
    - Sequential drag insertions each get their own scaffolding
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.7, 11.8, 11.9, 11.10_

  - [ ]* 6.11 Write property tests for narrative composition
    - **Property 26: Narrative insertion with template resolution**
    - **Property 28: Slash command insertion omits narrative scaffolding**
    - **Property 29: Sequential narrative drag insertion**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.8, 11.10**

- [x] 7. Checkpoint — Parallel tracks B–E complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Track F: Graph-Explorer Sync (after Tracks C + canvas)
  - [x] 8.1 Implement bidirectional selection sync
    - In `SemanticExplorer`: on item click, call `store.select()` with correct Selection
    - In `Canvas`: `useEffect` on selection changes — call `reactFlowInstance.fitView` to pan/zoom to selected node, apply highlight ring via `selected` data prop
    - In `SemanticExplorer`: react to selection changes — scroll to and highlight matching item using ref-based scroll-into-view
    - If selected explorer item has no canvas node, canvas maintains current viewport
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 8.2 Write property test for explorer-to-canvas sync
    - **Property 11: Explorer-to-canvas selection sync**
    - **Validates: Requirements 5.4**

- [x] 9. Track G: Structured Export (after Track A, mostly backend)
  - [x] 9.1 Create structured exporter in `src/structured-exporter.js`
    - Implement `exportStructured(workflowGraph, workflowName)` producing `ExportDirectory` structure
    - Generate `graph.yaml`: nodes list, edges with conditions, entry points
    - Generate `nodes/{node-name}.md`: fully resolved content with all Ref_Tokens replaced
    - Generate `resources/{category}/{name}.yaml`: full resource definition (frontmatter, description, parameters)
    - Generate `metadata.yaml`: name, description, exportedAt, version
    - Generate `README.md`: explains workflow structure and file organization
    - Preserve `${env:VAR}` syntax as-is in exported content
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.8, 9.9_

  - [ ]* 9.2 Write property tests for structured export
    - **Property 17: Structured export directory layout**
    - **Property 18: Export ref resolution**
    - **Property 19: Export resource YAML completeness**
    - **Property 20: Export preserves environment variable syntax**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.8, 9.9**

  - [x] 9.3 Extend CLI with `--format` flag in `src/cli.js`
    - Add `--format` option: `dir` (default) produces structured directory, `json` produces existing flat JSON
    - Wire `--format dir` to `structured-exporter.js`
    - _Requirements: 9.6_

  - [x] 9.4 Add backend export endpoint
    - Extend `POST /api/export` with `format` query param
    - `format=dir` returns ZIP binary (using JSZip), `format=json` returns existing JSON
    - _Requirements: 9.7_

- [x] 10. Checkpoint — All feature tracks complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Track H: Integration and Wiring
  - [x] 11.1 Implement Editor/Preview toggle in `DetailPanel`
    - Add `EditorMode` local state (`edit` | `preview`)
    - Edit mode: tiptap editor with RefChips, NarrativeBlocks, slash commands
    - Preview mode: `react-markdown` + `remark-gfm` with resolved refs rendered as styled inline elements using CATEGORY_CONFIG colors
    - Toggle via UI button and `Cmd/Ctrl+Shift+P` keyboard shortcut
    - Switching to preview renders current content without save
    - Switching back to edit restores cursor position (stored in a ref)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

  - [ ]* 11.2 Write property test for preview ref rendering
    - **Property 32: Preview mode ref rendering**
    - **Validates: Requirements 13.3, 13.7**

  - [x] 11.3 Update `ui/src/components/Canvas.tsx` node styling
    - Apply type-specific color accents: blue for step nodes, amber for router nodes, purple for sub-workflow nodes
    - Resource nodes get colored left-border accent strip matching category color
    - Display Lucide ResourceType icon inside resource nodes
    - Light/dark grid pattern based on active theme
    - _Requirements: 8.3, 8.4, 8.5, 12.10_

  - [x] 11.4 Update `ui/src/components/Toolbar.tsx`
    - Add ThemeToggle, LibraryToggle, ResourcePaletteToggle buttons
    - Update ExportButton to offer two options: structured ZIP download and JSON modal view
    - _Requirements: 7.6, 9.7, 12.2_

  - [x] 11.5 Wire all panels in `ui/src/App.tsx` layout
    - Wrap with `ThemeProvider`, `StoreProvider`, `DndContext`
    - Replace `DirectoryExplorer` with `SemanticExplorer`
    - Add `LibraryPanel` (collapsible left overlay)
    - Add `ResourcePalette` (collapsible right overlay)
    - Register tiptap extensions (RefChipNode, SlashCommandSuggestion, NarrativeBlockDecoration) in Editor
    - Ensure 3-panel layout: SemanticExplorer (240px) | GraphCanvas (flex-1) | DetailPanel (360px)
    - _Requirements: 1.3, 1.4, 1.5, 12.9_

  - [x] 11.6 Visual design polish pass
    - Ensure all components use CSS variables for theming
    - Verify subtle 1px borders, 8px border-radius, generous whitespace across all panels
    - Verify dark mode variants render correctly for all components: Explorer, Canvas, Editor, DetailPanel, Toolbar, LibraryPanel, ResourcePalette, RefChip, NarrativeBlock
    - Ensure badges and accent colors maintain 4.5:1 contrast ratio in dark mode
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 12.9, 12.11, 12.12_

- [x] 12. Final checkpoint — All integration complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Tracks B, C, D, E, G can execute in parallel after Track A completes
- Track F requires Track C (SemanticExplorer) to be done
- Track H requires most other tracks to be done
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties from the design document
- The design uses TypeScript throughout — all implementation tasks use TypeScript
