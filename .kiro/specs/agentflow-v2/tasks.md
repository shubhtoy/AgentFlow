# Implementation Plan: AgentFlow v2

## Overview

Rebuild the AgentFlow framework with syntax-based semantic references, frontmatter-driven resource classification, a self-contained export format, round-trip pretty-printing, a library manager, and a three-panel UI with directory explorer. Implementation proceeds bottom-up: core parser first, then validator, exporter, pretty-printer, library, CLI, API, and finally UI. Test generators and property tests are woven in alongside each module.

## Tasks

- [x] 1. Set up test infrastructure and generators
  - [x] 1.1 Create test directory structure and install fast-check
    - Create `tests/generators/`, `tests/property/`, `tests/unit/` directories
    - Add `fast-check` and `vitest` as dev dependencies in `package.json`
    - Create a vitest config file at project root
    - _Requirements: Design Testing Strategy_

  - [x] 1.2 Implement ref generator (`tests/generators/refs.gen.js`)
    - Generate random ref tokens for all 4 syntax types: mention `{{cat/name}}`, edge `{{-> cat/name}}`, conditional edge `{{-> cat/name | templates/cond}}`, data flow `{{<< output.nodeName}}`
    - Generate random category/name values with valid characters
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.3 Implement markdown generator (`tests/generators/markdown.gen.js`)
    - Generate random `.md` content with optional YAML frontmatter
    - Embed ref tokens at random positions in the content
    - Support generating files with empty frontmatter, no frontmatter, and various field combinations
    - _Requirements: 2.5, 10.1, 10.2_

  - [x] 1.4 Implement frontmatter generator (`tests/generators/frontmatter.gen.js`)
    - Generate valid and invalid frontmatter objects for each resource type schema (tool, skill, template, interaction, memory, node, agents)
    - Include edge cases: missing required fields, wrong types, invalid enum values
    - _Requirements: 2.7, 2.8, 2.9, 2.10, 2.11, 2.12_

  - [x] 1.5 Implement directory generator (`tests/generators/directory.gen.js`)
    - Generate random `.agentflow/` directory trees with node dirs, reserved dirs, and arbitrary files
    - Support generating trees with single-file nodes, multi-file nodes, and nested sub-workflows
    - _Requirements: 3.1, 3.3, 3.4_

  - [x] 1.6 Implement workflow generator (`tests/generators/workflow.gen.js`)
    - Generate random workflow graphs with nodes, edges, resources, and entry points
    - Support generating graphs with cycles, unreachable nodes, and multiple entry points
    - _Requirements: 6.1, 8.5, 13.1_

- [x] 2. Implement Parser module (`src/parser.js`) — Reference parsing and file reading
  - [x] 2.1 Implement `parseRef()` and `extractRefs()` with REF_PATTERNS
    - Define `REF_PATTERNS` array with regexes for conditional_edge, edge, data_flow, mention (applied in that order)
    - `parseRef(token)` returns a Ref object with `raw`, `semanticType`, `category`, `name`, `condition`, `offset`, `line`
    - `extractRefs(content)` applies patterns in order and returns all refs with positions
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 2.2 Write property tests for ref parsing (`tests/property/ref-parsing.property.js`)
    - **Property 1: Syntax prefix determines semantic type** — For any ref token, semantic type is determined solely by prefix (`->` → edge, `<<` → data_flow, no prefix → mention), identical regardless of document position
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
    - **Property 2: Edges constructed only from edge refs** — For any WorkflowGraph, every edge traces back to an Edge_Ref or Conditional_Edge_Ref; no Mention_Ref or Data_Flow_Ref produces an edge
    - **Validates: Requirements 1.7**

  - [x] 2.3 Implement `parseMarkdownFile()` with metadata-only mode
    - Use `gray-matter` to extract frontmatter and content
    - In `full` mode: extract title, body, and all refs via `extractRefs()`
    - In `metadata-only` mode: extract only frontmatter fields and title, skip body/refs
    - Handle missing frontmatter (empty metadata object), invalid YAML (treat as no frontmatter)
    - _Requirements: 2.5, 10.1, 10.2, 12.1, 12.2_

  - [x] 2.4 Implement `classifyResource()` and `identifyPrimaryFile()`
    - `classifyResource(file, dirPath)`: frontmatter `type` → directory inference (tools/ → tool, skills/ → skill, etc.) → null (untyped)
    - `identifyPrimaryFile(files)`: `primary: true` frontmatter → `main.md` → alphabetical first; single file = primary
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.3, 3.4_

  - [ ]* 2.5 Write property tests for classification and primary file (`tests/property/classification.property.js`)
    - **Property 3: Resource type classification priority** — frontmatter type overrides directory, directory infers when no type, untyped outside reserved dirs
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
    - **Property 7: Primary file selection** — priority: primary:true → main.md → alphabetical first; single file = primary
    - **Validates: Requirements 3.3, 3.4**

  - [x] 2.6 Implement `parseNode()` and node type classification
    - Read all `.md` files in a node directory
    - Identify primary file, collect context files
    - Classify context files with frontmatter `type` (Req 3.6) or as plain context (Req 3.7)
    - Determine node type from frontmatter: `step` (default), `router`, `sub-workflow`
    - Collect all refs from primary + context files
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7, 6.1, 6.4_

  - [x] 2.7 Implement `resolveRef()` with path-first, name-second resolution
    - First attempt exact path match: `category/name.md` relative to `.agentflow/` root
    - If no path match, search all parsed files for frontmatter `name` match
    - Path match wins over name match when both exist
    - Return null if unresolved
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [ ]* 2.8 Write property tests for resolution (`tests/property/resolution.property.js`)
    - **Property 9: Ref resolution path-first, name-second** — path match always wins; name fallback only when no path match
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.5**
    - **Property 10: Ambiguous name resolution produces error** — multiple name matches with no path match → error listing all matches
    - **Validates: Requirements 4.4**

  - [x] 2.9 Implement `parseWorkflow()` with sub-workflow recursion and entry point detection
    - Discover node directories (dirs containing `.md` files)
    - Build edges from edge and conditional_edge refs only
    - Detect workflow descriptor file (`type: agents` frontmatter or `AGENTS.md`)
    - Entry point detection: explicit `entry: true` → descriptor file → inferred from no-incoming-edges
    - Mark inferred entries with `entryInferred: true`
    - Recursively parse sub-workflow nodes
    - _Requirements: 6.3, 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 2.10 Implement `parseRoot()` top-level parser
    - Glob all `.md` files under `.agentflow/`
    - Parse each file, classify resources, group into categories
    - Build WorkflowGraph with tools, skills, interactions, templates, memory, workflows, allFiles
    - Record `${env:VARIABLE_NAME}` tokens without resolving
    - _Requirements: 3.1, 3.2, 3.8, 3.9, 11.1_

  - [ ]* 2.11 Write property tests for discovery and node parsing (`tests/property/discovery.property.js`)
    - **Property 6: Complete file discovery** — every `.md` file in `.agentflow/` is discovered regardless of filename or location
    - **Validates: Requirements 3.1, 3.2, 3.8**
    - **Property 8: Context files included in node and export** — all non-primary files appear as context files in parsed node
    - **Validates: Requirements 3.5, 3.10**

  - [ ]* 2.12 Write property tests for node types and entry points
    - **Property 14: Node type classification** (`tests/property/node-types.property.js`) — frontmatter type → step/router/sub-workflow; default step
    - **Validates: Requirements 6.1, 6.4**
    - **Property 16: Sub-workflow recursive parsing** (`tests/property/node-types.property.js`) — sub-workflow nodes produce nested WorkflowDef
    - **Validates: Requirements 6.3**
    - **Property 30: Entry point detection** (`tests/property/entry-points.property.js`) — explicit entry:true → descriptor → inferred from no-incoming-edges; correct flags
    - **Validates: Requirements 13.1, 13.2, 13.4, 13.5, 13.6**

- [x] 3. Checkpoint — Parser complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement Validator module (`src/validator.js`)
  - [x] 4.1 Implement `validateSchema()` for all resource type schemas
    - Validate frontmatter against schema for tool, skill, template, interaction, memory, node, agents
    - Check required fields, field types, enum values
    - Tool-specific: `command` required for script, `mcp` required for mcp, `package` required for package
    - Return errors with file path, field name, and violation nature
    - _Requirements: 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15_

  - [x] 4.2 Implement `validate()` main function with permissive/strict modes
    - Check broken refs (target not found after path + name resolution)
    - Check invalid ref syntax prefix
    - Check data flow refs to non-existent nodes
    - Check missing condition templates in conditional edges
    - Check router nodes with non-conditional edges
    - Check ambiguous name-based resolution
    - Permissive mode (default): schema violations, cycles, unreachable nodes, unknown category = warnings
    - Strict mode: warnings become errors
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.8, 8.9_

  - [x] 4.3 Implement `detectCycles()` and `findUnreachable()`
    - `detectCycles()`: DFS-based cycle detection on directed edge graph, return warning with cycle node list
    - `findUnreachable()`: find nodes with no incoming edges that are not entry nodes
    - _Requirements: 8.5, 8.6_

  - [x] 4.4 Implement `validateVariables()` for `${env:VARIABLE_NAME}` format
    - Validate variable tokens match `${env:VARIABLE_NAME}` pattern (alphanumeric + underscores)
    - Return error for malformed variable tokens
    - _Requirements: 11.3_

  - [ ]* 4.5 Write property tests for validation (`tests/property/validation.property.js`)
    - **Property 18: Broken ref detection** — unresolved refs produce error with source file, ref string, missing target
    - **Validates: Requirements 8.1, 8.3, 8.4**
    - **Property 19: Cycle detection** — cycles produce warning listing involved nodes
    - **Validates: Requirements 8.5**
    - **Property 20: Unreachable node detection** — non-entry nodes with no incoming edges produce warning
    - **Validates: Requirements 8.6**
    - **Property 21: Strict mode promotes warnings to errors** — same graph in permissive vs strict mode
    - **Validates: Requirements 8.9**

  - [ ]* 4.6 Write property tests for schema validation (`tests/property/schema.property.js`)
    - **Property 4: Schema validation conditional on type field** — validation applied iff frontmatter has `type` field
    - **Validates: Requirements 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12**
    - **Property 5: Schema violation error detail** — error contains file path, field name, violation nature
    - **Validates: Requirements 2.13**
    - **Property 15: Router nodes require conditional edges** — router with plain Edge_Ref → error
    - **Validates: Requirements 6.2, 6.5**

  - [ ]* 4.7 Write property tests for variables (`tests/property/variables.property.js`)
    - **Property 27: Variable format validation** — accept valid `${env:VAR_NAME}`, reject malformed
    - **Validates: Requirements 11.3**

- [x] 5. Implement Exporter module (`src/exporter.js`)
  - [x] 5.1 Implement `resolveForExport()` with per-type resolution strategy
    - Edge_Ref → node identifier in graph section
    - Conditional_Edge_Ref → node identifier + resolved `check` field from template
    - Mention_Ref → inline markdown body of target resource
    - Data_Flow_Ref → `[output from: nodeName]` placeholder
    - Unresolved → `[UNRESOLVED: {{original}}]` marker
    - Use path-first, name-second resolution order (Req 5.8)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.8_

  - [x] 5.2 Implement `exportWorkflow()` producing ExportBundle
    - Build `graph` object with nodes (including resolved content, context content, summary) and edges (with conditions)
    - Build `resources` object with tools (full definition: type, command/mcp/package, parameters, builtin_mapping), skills, interactions, templates, memory
    - Build `metadata` with workflow name, description, export timestamp, agentflow version
    - Build `entry_points` array with explicit/inferred flags
    - Collect `errors` array for unresolved refs
    - Include `summary` field per node for progressive disclosure (name, description, type, outgoing edges)
    - Preserve `${env:VARIABLE_NAME}` tokens as-is
    - Include context file content in export alongside primary file
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.8, 3.10, 7.6, 11.2, 12.4, 13.6_

  - [ ]* 5.3 Write property tests for export (`tests/property/export.property.js`)
    - **Property 11: Export resolves each ref type correctly** — edge → graph, conditional → graph+check, mention → inline body, data_flow → placeholder
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
    - **Property 12: Unresolved refs produce marker and error** — `[UNRESOLVED: {{original}}]` marker + errors array entry
    - **Validates: Requirements 5.5**
    - **Property 13: Export bundle structural completeness** — graph, resources, metadata, entry_points, errors all present
    - **Validates: Requirements 5.6**

  - [ ]* 5.4 Write property tests for tool and progressive disclosure
    - **Property 17: Tool definition preservation** (`tests/property/tools.property.js`) — parser preserves tool type, fields, parameters; exporter includes full definition
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**
    - **Property 26: Variable preservation through pipeline** (`tests/property/variables.property.js`) — parser records, exporter preserves `${env:VAR}` as-is
    - **Validates: Requirements 11.1, 11.2**
    - **Property 29: Export summary per node** (`tests/property/progressive.property.js`) — summary contains name, description, type, outgoing edges
    - **Validates: Requirements 12.4**

- [x] 6. Checkpoint — Validator and Exporter complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement Pretty-Printer module (`src/pretty-printer.js`)
  - [x] 7.1 Implement `serialize()` for single file
    - Produce valid YAML frontmatter delimited by `---` when fields are present
    - Omit frontmatter block when metadata is empty
    - Preserve ref tokens in their original syntax-prefixed form
    - _Requirements: 10.3, 10.4_

  - [x] 7.2 Implement `serializeNode()` and `serializeGraph()`
    - `serializeNode()`: serialize primary + context files to a target directory
    - `serializeGraph()`: serialize entire WorkflowGraph back to `.agentflow/` directory structure
    - Handle programmatically modified nodes (added/removed refs)
    - _Requirements: 10.3, 10.5, 10.6, 10.7_

  - [ ]* 7.3 Write property test for round-trip (`tests/property/round-trip.property.js`)
    - **Property 25: Parse → pretty-print → parse round-trip** — for any valid markdown file, parse → serialize → parse produces equivalent structured object
    - **Validates: Requirements 10.1, 10.3, 10.5, 10.6, 10.7**

  - [ ]* 7.4 Write property test for metadata-only mode (`tests/property/progressive.property.js`)
    - **Property 28: Metadata-only mode** — parsing in metadata-only mode produces frontmatter + title but no body or refs
    - **Validates: Requirements 12.1, 12.2**

- [x] 8. Implement Library Manager (`src/library.js`)
  - [x] 8.1 Implement `search()`, `add()`, and `index()`
    - `search(registry, query)`: case-insensitive substring match on name, description, tags
    - `add(registry, type, name, targetRoot)`: copy files from library path to `.agentflow/` workspace; for workflows, copy entire directory tree
    - `index(libraryDir)`: scan library directory, generate `registry.json` with name, type, path, description, tags per entry
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 8.2 Generate initial `library/registry.json` from existing library files
    - Scan `library/` directory tree (workflows, skills, tools, templates, interactions)
    - Produce registry entries with correct metadata
    - _Requirements: 9.1, 9.6_

  - [ ]* 8.3 Write property tests for library (`tests/property/library.property.js`)
    - **Property 22: Library search** — query matches name, description, or tags (case-insensitive substring)
    - **Validates: Requirements 9.5**
    - **Property 23: Library add copies to workspace** — workflow → entire directory; other types → resource file to corresponding dir
    - **Validates: Requirements 9.2, 9.3**
    - **Property 24: Library index round-trip** — index produces registry with entry for every resource file
    - **Validates: Requirements 9.6**

- [x] 9. Implement CLI (`src/cli.js`) — Rewrite with all commands
  - [x] 9.1 Implement `parse`, `validate`, and `export` commands
    - `parse [dir]` with `--output <file>` and `--metadata-only` flags
    - `validate [dir]` with `--strict` flag; exit 0 on no errors, exit 1 on errors
    - `export [dir]` with `--output <file>` and `--workflow <name>` flags
    - Wire to Parser, Validator, Exporter modules
    - _Requirements: 5.7, 8.7, 12.3_

  - [x] 9.2 Implement `graph`, `init`, `add`, `search`, and `library index` commands
    - `graph [dir]`: print ASCII graph representation
    - `init [dir]`: scaffold `.agentflow/` workspace with reserved directories
    - `add <type> <name>`: install from library, print error if not found with available alternatives
    - `search <query>`: search library registry, print matching entries
    - `library index`: regenerate `library/registry.json`
    - _Requirements: 9.2, 9.4, 9.5, 9.6_

  - [x] 9.3 Implement `ui` command with API server
    - `ui [dir]` with `--port <port>` flag
    - Serve static UI files from `ui/dist/`
    - Implement API endpoints: GET `/api/data`, `/api/validate`, `/api/tree`
    - Implement API endpoints: POST `/api/save`, `/api/create`, `/api/delete`, `/api/move`, `/api/export`
    - `/api/tree` returns TreeNode structure with resourceType, isPrimary, isNodeDir, isReservedDir annotations
    - Error handling: 200/400/404/500 with `{ error: string }` JSON body
    - _Requirements: 14.1, 14.2, 14.4, 14.5, 14.6, 14.7_

  - [ ]* 9.4 Write property tests for directory tree API (`tests/property/directory-tree.property.js`)
    - **Property 31: Directory tree mirrors filesystem** — tree matches filesystem with correct resourceType, isPrimary, isNodeDir annotations
    - **Validates: Requirements 14.1, 14.4, 14.5, 14.6**
    - **Property 32: File move updates filesystem** — move from A to B relocates file, tree reflects new location
    - **Validates: Requirements 14.7**

- [x] 10. Checkpoint — All core modules and CLI complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Update UI types and state (`ui/src/types.ts`, `ui/src/store.tsx`, `ui/src/api.ts`)
  - [x] 11.1 Update `ui/src/types.ts` with new data models
    - Add `SemanticType`, updated `Ref` with `semanticType`, `NodeDef`, `EdgeDef`, `WorkflowDef`, `ExportBundle`, `TreeNode`, `ValidationResult`
    - Update existing types to match new WorkflowGraph structure
    - _Requirements: 1.6, 5.6, 6.1, 14.1_

  - [x] 11.2 Extend `ui/src/store.tsx` with new state and actions
    - Add `directoryTree`, `expandedDirs`, `validationResult`, `breadcrumbs` state
    - Add `selectFile`, `toggleDir`, `moveFile`, `validate` actions
    - Update `reload` to fetch both workflow data and directory tree
    - _Requirements: 14.1, 14.2, 14.3_

  - [x] 11.3 Extend `ui/src/api.ts` with new endpoints
    - Add `getTree()`, `move(from, to)`, `exportWorkflow(options)`, `validate(options)` API calls
    - _Requirements: 14.2, 14.7_

- [x] 12. Implement Directory Explorer component (`ui/src/components/DirectoryExplorer.tsx`)
  - [x] 12.1 Create DirectoryExplorer with recursive TreeNode component
    - VS Code-style file tree mirroring `.agentflow/` filesystem
    - Recursive `TreeNode` component for nested directories
    - Expand/collapse directories via store `toggleDir` action
    - Click file to select via store `selectFile` action
    - _Requirements: 14.1, 14.3_

  - [x] 12.2 Add type icons, primary file markers, and node directory indicators
    - Display resource type icons (tool, skill, template, interaction, memory, node) using lucide-react
    - Show primary file badge for primary files in node directories
    - Distinct visual treatment for node directories vs reserved directories vs plain directories
    - _Requirements: 14.4, 14.5, 14.6_

  - [x] 12.3 Implement drag-and-drop file moving
    - Support dragging `.md` files between directories
    - Call `moveFile` store action which calls POST `/api/move`
    - Update tree after successful move
    - _Requirements: 14.7_

- [x] 13. Update Canvas component (`ui/src/components/Canvas.tsx`)
  - [x] 13.1 Add custom node types: StepNode, RouterNode, SubWorkflowNode
    - StepNode: standard node rendering
    - RouterNode: diamond/decision-point visual with condition labels on edges
    - SubWorkflowNode: nested workflow indicator with drill-down capability
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 13.2 Add minimap and edge condition display
    - Add xyflow MiniMap component
    - Display condition text on conditional edges
    - _Requirements: 5.2, 6.2_

  - [x] 13.3 Implement sub-workflow drill-down navigation
    - Double-click SubWorkflowNode to navigate into nested workflow
    - Update breadcrumbs in store for navigation trail
    - _Requirements: 6.3_

- [x] 14. Implement Detail Panel (`ui/src/components/DetailPanel.tsx`) and update Toolbar
  - [x] 14.1 Create DetailPanel replacing InfoPanel
    - Split view: FrontmatterForm (top) + markdown editor (bottom)
    - Show validation errors inline for selected file
    - RefList component showing all refs in the selected file with semantic type indicators
    - _Requirements: 14.3_

  - [x] 14.2 Update Toolbar (`ui/src/components/Toolbar.tsx`)
    - Add BreadcrumbNav for sub-workflow navigation
    - Add ValidationIndicator showing error/warning counts
    - Add Export button triggering POST `/api/export`
    - _Requirements: 8.7, 5.7_

  - [x] 14.3 Update App layout (`ui/src/App.tsx`) to three-panel
    - Replace Sidebar with DirectoryExplorer (left panel, ~240px)
    - Canvas (center, flex)
    - DetailPanel replacing InfoPanel (right panel, ~360px)
    - _Requirements: 14.1_

- [x] 15. Update examples and final integration
  - [x] 15.1 Update `examples/.agentflow/` to use new ref syntax
    - Convert existing refs to new syntax-prefixed format
    - Add frontmatter `type` fields where appropriate
    - Ensure examples parse correctly with new parser
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1_

  - [ ]* 15.2 Write unit tests for all core modules (`tests/unit/`)
    - `parser.test.js`: specific parsing examples from `examples/.agentflow/`, edge cases (empty files, only frontmatter, deeply nested dirs, malformed YAML, unclosed refs)
    - `validator.test.js`: specific validation scenarios (broken refs, schema violations, cycles, strict mode)
    - `exporter.test.js`: specific export examples (resolved refs, unresolved markers, full bundle structure)
    - `pretty-printer.test.js`: specific serialization examples (with/without frontmatter, modified nodes)
    - `library.test.js`: search, add, index operations
    - `cli.test.js`: command output, exit codes, flag handling
    - _Requirements: 1.1–1.7, 2.1–2.15, 3.1–3.11, 4.1–4.5, 5.1–5.8, 6.1–6.5, 7.1–7.7, 8.1–8.9, 9.1–9.6, 10.1–10.7, 11.1–11.3, 12.1–12.4, 13.1–13.7, 14.1–14.7_

- [x] 16. Final checkpoint — Full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (32 properties)
- Unit tests validate specific examples and edge cases
- Core modules are plain JavaScript; UI is TypeScript/React
- Implementation order: generators → parser → validator → exporter → pretty-printer → library → CLI/API → UI → examples
