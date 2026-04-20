# Tasks: Taxonomy Consolidation

## Part 1: Foundation — Taxonomy Registry + Parser

- [x] 1. Create `src/taxonomy.js` — single source of truth
  - [x] 1.1 Define `TAXONOMY_REGISTRY` with 5 canonical categories (instructions, capabilities, runbooks, memory, hooks), each with label, pluralLabel, dir, resourceType, scopes, defaultScope
  - [x] 1.2 Implement derived constants: `CANONICAL_CATEGORIES`, `RESERVED_DIRS`, `DIR_TO_CATEGORY`, `RESOURCE_TYPE_MAP`
  - [x] 1.3 Implement `inferScope(frontmatter, categoryName)` — explicit scope wins, then infer from type/inclusion fields, fallback to defaultScope
  - [x] 1.4 Implement helper functions: `getCategory()`, `getCategoryByDir()`, `isReservedDir()`
  - [x] 1.5 Add unit tests: registry lookups, scope inference for all category/type combos, derived constants consistency

- [x] 2. Update `src/parser.js` — import from taxonomy, output canonical graph
  - [x] 2.1 Replace hardcoded `RESERVED_DIRS` and `RESERVED_DIR_TYPE_MAP` with imports from `src/taxonomy.js`
  - [x] 2.2 Update `classifyResource()` to use `isReservedDir()` and `RESOURCE_TYPE_MAP` from taxonomy
  - [x] 2.3 Update `parseRoot()` to build graph with canonical keys only: `instructions`, `capabilities`, `runbooks`, `memory`, `hooks`, `customFiles`, `workflows`
  - [x] 2.4 Add `.scope` to each entry in instructions/capabilities/runbooks via `inferScope()`
  - [x] 2.5 Remove all legacy category keys from graph output (tools, skills, steering, interactions, templates)
  - [x] 2.6 Update existing parser tests + add new tests for canonical output shape, scope inference, old dir names → customFiles

## Part 2: Backend Services + Routes + CLI (parallel-safe)

- [x] 3. Update backend services to use canonical categories
  - [x] 3.1 `agentflow/src/services/workflow-service.js` — replace RESERVED set and dirTypeMap with taxonomy imports
  - [x] 3.2 `agentflow/src/services/export-service.js` — replace hardcoded category list in buildGraphSummary/filteredMap with `CANONICAL_CATEGORIES`
  - [x] 3.3 Rename `agentflow/src/services/steering-manager.js` → `instruction-manager.js`, update dir from `steering/` to `instructions/`, update function names
  - [x] 3.4 Rename `agentflow/src/routes/steering-routes.js` → `instruction-routes.js`, update endpoints from `/api/steering` to `/api/instructions`
  - [x] 3.5 Update `agentflow/src/server.js` — import renamed instruction-manager + instruction-routes, register new route paths

- [x] 4. Update CLI commands
  - [x] 4.1 `src/cli.js` `init` command — create canonical dirs: instructions/, capabilities/, runbooks/, memory/, hooks/
  - [x] 4.2 `src/cli.js` `add` command — accept canonical type names (instruction, capability, runbook, memory)
  - [x] 4.3 `src/cli.js` `library` command — update type filters to canonical names
  - [x] 4.4 Update `src/pretty-printer.js` — replace hardcoded category array with `CANONICAL_CATEGORIES` from taxonomy
  - [x] 4.5 Update `src/library.js` — replace `typeToDir` mapping with taxonomy-derived lookup

- [x] 5. Update git integration
  - [x] 5.1 `src/git/repo-scanner.js` — replace `RESERVED_DIRS` with taxonomy import
  - [x] 5.2 `src/git/sync-engine.js` — replace `RESOURCE_TYPE_DIRS` with taxonomy import

## Part 3: Transport Layer — Platform Configs + Claude Adapter (parallel-safe)

- [x] 6. Update existing platform configs to canonical source names
  - [x] 6.1 `src/transport/platforms/kiro.json` — replace `tools/*`, `skills/*`, `steering/*`, `interactions/*`, `templates/*` with `instructions/*`, `capabilities/*`, `runbooks/*`
  - [x] 6.2 `src/transport/platforms/github.json` — same canonical source name updates
  - [x] 6.3 `src/transport/utils.js` — update `resolveGraphSource()` to handle canonical names (instructions, capabilities, runbooks)

- [x] 7. Add Claude Code platform adapter
  - [x] 7.1 Create `src/transport/platforms/claude.json` — full export/import rules with `memoryHandling: 'prefer-native'`
  - [x] 7.2 Add Claude transforms to `src/transport/transforms.js`: `identity-to-claude-md`, `claude-md-to-identity`, `mcp-to-claude-settings`, `claude-settings-to-mcp`, `annotate-supplementary-memory`, `strip-supplementary-annotation`
  - [x] 7.3 Add unit tests for all Claude transforms

## Part 4: UI — Types, Constants, Explorer (parallel-safe with Part 2/3)

- [x] 8. Update UI types and constants
  - [x] 8.1 `ui/src/types.ts` — replace `ResourceCategory` union with canonical: `'instructions' | 'capabilities' | 'runbooks' | 'memory' | 'hooks' | 'customFiles'`
  - [x] 8.2 `ui/src/types.ts` — update `WorkflowGraph` interface: replace tools/skills/steering/interactions/templates with instructions/capabilities/runbooks
  - [x] 8.3 `ui/src/constants.ts` — replace `CATEGORIES` object with 6 canonical entries (instructions, capabilities, runbooks, memory, hooks, customFiles) with appropriate icons and colors
  - [x] 8.4 `ui/src/constants.ts` — update `SIDEBAR_SECTIONS` to canonical labels
  - [x] 8.5 `ui/src/utils/buildExplorerSections.ts` — replace `RESOURCE_CATEGORIES` array with canonical categories
  - [x] 8.6 Verify UI builds clean with `npx vite build`

## Part 5: Example Workspace Migration + Documentation

- [x] 9. Migrate example workspace
  - [x] 9.1 Rename `examples/.agentflow/tools/` → `examples/.agentflow/capabilities/`
  - [x] 9.2 Merge `examples/.agentflow/skills/` + any steering files → `examples/.agentflow/instructions/`, add `scope` frontmatter where needed
  - [x] 9.3 Merge `examples/.agentflow/interactions/` + `examples/.agentflow/templates/` → `examples/.agentflow/runbooks/`, add `scope` frontmatter
  - [x] 9.4 Verify `parseRoot()` on migrated workspace produces correct canonical graph

- [x] 10. Update documentation
  - [x] 10.1 Create `docs/taxonomy-reference.md` — standalone taxonomy reference explaining all 6 categories, scopes, directory structure, frontmatter conventions
  - [x] 10.2 Update `docs/authoring-guide.md` — directory layout, resource definitions, reference syntax to use canonical names
  - [x] 10.3 Update `docs/authoring-cheatsheet.md` — structure and reference syntax to use canonical names

## Part 6: Integration Tests + Verification

- [x] 11. Integration tests
  - [x] 11.1 End-to-end: parse migrated example workspace → verify canonical graph shape (no legacy keys)
  - [x] 11.2 Export to all 3 platforms (kiro, github, claude) → verify all files present, no drops
  - [x] 11.3 Round-trip: parse → export to Claude → import back → verify graph equality
  - [x] 11.4 CLI: test `init`, `validate`, `export` commands with canonical directories
  - [x] 11.5 Run full test suite — all existing tests must pass with updated categories
