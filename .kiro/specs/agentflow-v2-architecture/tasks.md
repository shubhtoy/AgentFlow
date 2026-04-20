# Implementation Plan: AgentFlow v2 Architecture

## Overview

This plan restructures AgentFlow into a single npm package, rewrites the CLI, builds the transport layer (platform export/import engine), implements hook abstraction, fidelity reporting, default export, and wires up agent modes. Taxonomy consolidation and parser canonical keys are already done — those are not included here.

The implementation language is JavaScript (Node.js) for `src/` core modules and `bin/cli.js`, with TypeScript for `studio/` (Next.js app). The legacy `src/transport/` prototype is used as reference but the transport layer is rewritten clean.

## Tasks

- [x] 1. Package restructuring and code consolidation
  - [x] 1.1 Archive legacy Fastify server
    - Move `agentflow/` directory to `_archive/agentflow-legacy/`
    - Preserve all files for reference
    - _Requirements: 1.4_

  - [x] 1.2 Move canonical modules from next-app/lib to src/
    - Copy `next-app/lib/parser.js` → `src/parser.js` (overwrite legacy)
    - Copy `next-app/lib/taxonomy.js` → `src/taxonomy.js` (overwrite legacy)
    - Copy `next-app/lib/validator.js` → `src/validator.js`
    - Copy `next-app/lib/dry-runner.js` → `src/dry-runner.js`
    - Copy `next-app/lib/token-calculator.js` → `src/token-calculator.js`
    - Copy `next-app/lib/branding.js` → `src/branding.js`
    - Copy `next-app/lib/schemas/` → `src/schemas/`
    - Copy `next-app/lib/services/` → `src/services/` (excluding dead code)
    - Copy `next-app/lib/git/` → `src/git/` (next-app versions preferred)
    - Copy `next-app/lib/mcp/` → `src/mcp/` (next-app versions preferred)
    - _Requirements: 1.1, 1.2, 1.5_

  - [x] 1.3 Delete dead code
    - Delete `next-app/lib/orchestrator.js`
    - Delete `next-app/lib/services/orchestrator-service.js`
    - Delete `next-app/lib/services/steering-manager.js`
    - Delete `next-app/app/api/orchestrator/` route directory
    - Remove orchestrator key from `next-app/lib/service-context.ts`
    - _Requirements: 1.6_

  - [x] 1.4 Rename next-app to studio
    - Rename `next-app/` directory to `studio/`
    - Update `studio/lib/` to import from `src/` via path aliases instead of local copies
    - Configure `studio/tsconfig.json` with `paths: { "@agentflow/*": ["../src/*"] }`
    - Configure `studio/next.config.ts` with `transpilePackages: ['../src']`
    - _Requirements: 1.3, 2.1, 2.2, 2.3_

  - [x] 1.5 Consolidate package.json at repo root
    - Create single root `package.json` with all dependencies
    - Set `bin` field pointing to `bin/cli.js`
    - Remove duplicate `package.json` from archived directories
    - _Requirements: 1.1_

  - [x] 1.6 Migrate service tests to root tests/
    - Move `agentflow/tests/unit/hook-registry.test.js` → `tests/unit/hook-registry.test.js`
    - Move `agentflow/tests/unit/event-hook-engine.test.js` → `tests/unit/event-hook-engine.test.js`
    - Move `agentflow/tests/unit/export-service.test.js` → `tests/unit/export-service.test.js`
    - Move `agentflow/tests/unit/import-service.test.js` → `tests/unit/import-service.test.js`
    - Move `agentflow/tests/unit/instruction-manager.test.js` → `tests/unit/instruction-manager.test.js`
    - Update all test imports to reference new `src/` paths
    - _Requirements: 1.1, 1.2_


- [x] 2. Checkpoint — Package restructuring complete
  - Ensure all moved modules import correctly from `src/`
  - Ensure studio builds with `@agentflow/*` path aliases
  - Ensure existing tests pass with updated imports
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Workspace root resolution and CLI foundation
  - [x] 3.1 Implement resolveRoot() utility
    - Create `src/utils/resolve-root.js`
    - Implement priority chain: `AGENTFLOW_ROOT` → `_AGENTFLOW_CLI_ROOT` → walk-up `.agentflow/` search → default `cwd/.agentflow/`
    - Export as named function
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 3.2 Write property test for workspace root resolution (Property 1)
    - **Property 1: Workspace root resolution priority**
    - Test all combinations of env vars and directory structures
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [x] 3.3 Rewrite CLI entry point
    - Create `bin/cli.js` using commander or yargs
    - Wire `resolveRoot()` for all commands
    - Implement `agentflow init [dir]` — scaffold `.agentflow/` with canonical taxonomy dirs and `AGENTS.md`
    - Implement `agentflow parse [dir]` — call `parseRoot()`, output JSON to stdout or `--output` file
    - Implement `agentflow validate [dir]` — call `validate()`, print errors/warnings, exit code 1 on errors
    - Implement `agentflow graph [dir]` — parse and print ASCII edge list
    - Implement `agentflow tokens [dir]` — calculate and display context token estimates
    - Implement `agentflow dry-run [dir]` — simulate workflow execution
    - Implement `agentflow add <type> <name>` — copy resource from library to workspace
    - Implement `agentflow search <query>` — search library + MCP registry
    - Implement `agentflow library <action>` — manage library registry
    - Implement `agentflow git <subcommand>` — delegate to git service
    - Implement `agentflow mcp <subcommand>` — delegate to MCP services
    - _Requirements: 4.1, 4.4, 4.5, 4.11, 4.12, 4.13, 4.14, 4.15, 4.16, 4.17, 4.18_

  - [ ]* 3.4 Write property test for init scaffolding completeness (Property 20)
    - **Property 20: Init scaffolding completeness**
    - Verify `.agentflow/` contains all 6 canonical taxonomy dirs and `AGENTS.md`
    - **Validates: Requirement 4.1**

  - [ ]* 3.5 Write property test for validate exit code correctness (Property 21)
    - **Property 21: Validate exit code correctness**
    - Verify exit 0 when no errors, exit 1 when errors present
    - **Validates: Requirement 4.5**

  - [x] 3.6 Implement CLI dev command
    - Implement `agentflow dev [dir]` — spawn `next dev` in `studio/` with `AGENTFLOW_ROOT` set
    - Implement `agentflow dev --agent [dir]` — spawn Next.js + LangGraph CLI concurrently
    - _Requirements: 4.2, 4.3_

  - [x] 3.7 Stub CLI export/import commands (wired in Phase 5)
    - Add `agentflow export [dir]` command skeleton with `--platform`, `--format`, `--output` flags
    - Add `agentflow import` command skeleton with `--platform`, `--source`, `--auto-detect` flags
    - Print "not yet implemented" until transport layer is ready
    - _Requirements: 4.6, 4.7, 4.8, 4.9, 4.10_

- [x] 4. Checkpoint — CLI foundation complete
  - Ensure `agentflow init`, `parse`, `validate`, `graph`, `tokens`, `dry-run`, `add`, `search`, `library`, `git`, `mcp` commands work
  - Ensure `agentflow dev` starts the studio
  - Ensure all tests pass, ask the user if questions arise.


- [x] 5. Transport layer core — schemas, registry, and adapter factory
  - [x] 5.1 Create transport schemas with zod
    - Create `src/transport/schemas.js`
    - Define `PlatformConfigSchema`, `ExportRuleSchema`, `ImportRuleSchema` using zod
    - Include all fields: name, displayName, version, tier, capabilities, detectMarkers, exportRules, importRules
    - Export rule types: single-file, glob-copy, glob-transform, merge-into, passthrough
    - Import rule types: single-file, glob-transform, extract-from, passthrough
    - Fidelity values: native, on-demand, translated, preserved
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 5.2 Implement TransportRegistry
    - Create `src/transport/transport-registry.js`
    - Store adapters keyed by platform name, enforce uniqueness (reject duplicates)
    - Support `register()`, `get()`, `has()`, `list()`, `filterByCapability()`
    - _Requirements: 10.1, 10.2_

  - [ ]* 5.3 Write property test for transport registry uniqueness (Property 13)
    - **Property 13: Transport registry uniqueness**
    - Verify duplicate names are rejected, exactly one adapter per name
    - **Validates: Requirement 10.1**

  - [x] 5.4 Implement TransformRegistry
    - Create `src/transport/transforms.js`
    - Implement all built-in transform functions: md-to-mdc-always, md-to-mdc-agent-requested, mdc-to-md, identity-to-claude-md, claude-md-to-identity, instruction-to-claude-skill, claude-skill-to-instruction, identity-to-windsurf-rule, identity-to-kiro-steering, instructions-append-to-claude-md, instructions-to-copilot-instructions, mcp-remap, mcp-reverse, graph-to-agent-spec, workflow-to-skill-dirs, workflow-to-claude-skills, capability-to-mdc, runbook-to-mdc, hooks-to-instructions
    - Register all transforms by name, resolve by string reference
    - Return descriptive error for unregistered transform names
    - _Requirements: 17.1, 17.2, 17.3_

  - [ ] 5.5 Implement AdapterFactory
    - Create `src/transport/adapter-factory.js`
    - Discover platform configs from built-in `src/transport/platforms/` and user overrides `.agentflow/transport/`
    - Deep-merge user overrides over built-in configs (user takes precedence)
    - Validate each config against `PlatformConfigSchema` using zod
    - Create `PlatformAdapter` instances and register them in `TransportRegistry`
    - _Requirements: 10.3, 10.4, 10.5_

  - [ ]* 5.6 Write property test for config deep-merge precedence (Property 14)
    - **Property 14: Config deep-merge precedence**
    - Verify user override values take precedence at every level
    - **Validates: Requirement 10.4**

  - [x] 5.7 Implement transport utility functions
    - Create `src/transport/utils.js`
    - Implement path safety helpers (relative path validation, no `..` traversal, no absolute paths)
    - Implement file matching utilities for glob patterns in export/import rules
    - _Requirements: 21.1, 21.2, 21.3_

- [x] 6. Checkpoint — Transport core complete
  - Ensure schemas validate correctly, registry enforces uniqueness, factory discovers and merges configs
  - Ensure all tests pass, ask the user if questions arise.


- [x] 7. Hook Abstraction Layer
  - [x] 7.1 Implement HookAbstractionLayer class
    - Create `src/transport/hook-abstraction-layer.js`
    - Define `HOOK_EVENT_MAP` — canonical PascalCase events ↔ platform-specific events (Kiro camelCase, Claude Code, VS Code, Cursor/Windsurf passthrough)
    - Define `HOOK_ACTION_MAP` — canonical `command`/`prompt` ↔ platform-specific actions (Kiro `runCommand`/`askAgent`, Claude Code/VS Code `command`/`prompt`)
    - Define `HOOK_STRUCTURE_MAP` — platform format structures (Kiro individual files, Claude Code array in settings.json, VS Code individual files, Cursor/Windsurf passthrough)
    - Implement `toCanonical(hook)` — AgentFlow hook → canonical format
    - Implement `fromCanonical(canonical, platform)` — canonical → platform format
    - Implement `translateForExport(hooks, platform)` — full export translation, zero silent drops
    - Implement `translateForImport(hooks, platform)` — full import translation, preserve `_platformExtensions`
    - Produce warnings for untranslatable events, preserve the hook
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

  - [ ]* 7.2 Write property test for hook no-drop guarantee (Property 10)
    - **Property 10: Hook no-drop guarantee**
    - Verify output count equals input count for any set of hooks and any platform
    - **Validates: Requirement 15.4**

  - [ ]* 7.3 Write property test for hook round-trip fidelity (Property 11)
    - **Property 11: Hook round-trip fidelity**
    - Verify AgentFlow → platform → AgentFlow preserves all semantic content
    - **Validates: Requirements 15.7, 22.2**

  - [ ]* 7.4 Write unit tests for HookAbstractionLayer
    - Test event mapping for each platform (Kiro, Claude Code, VS Code, Cursor, Windsurf)
    - Test action mapping for each platform
    - Test structure mapping (individual files vs array in settings.json)
    - Test untranslatable event warning + preservation
    - Test `_platformExtensions` preservation on import
    - _Requirements: 15.1, 15.2, 15.3, 15.5, 15.6_

- [x] 8. Fidelity Reporter
  - [x] 8.1 Implement FidelityReporter
    - Create `src/transport/fidelity-reporter.js`
    - Build `FidelityReport` with: platform, direction (export/import), entries array, summary object, markdown string
    - Categorize each entry as exactly one of: native, on-demand, translated, preserved
    - Enforce `summary.native + summary.onDemand + summary.translated + summary.preserved === entries.length`
    - Zero "skip" entries
    - Produce both human-readable markdown (with ✅📋🔄📁 icons) and machine-readable structured output
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [ ]* 8.2 Write property test for complete fidelity coverage (Property 6)
    - **Property 6: Complete fidelity coverage**
    - Verify every workspace file appears in exactly one fidelity category, summary counts match entries.length
    - **Validates: Requirements 8.3, 8.4, 16.2, 16.3**

  - [ ]* 8.3 Write unit tests for FidelityReporter
    - Test summary count invariant
    - Test markdown output format
    - Test zero skip entries
    - _Requirements: 16.1, 16.2, 16.3, 16.4_


- [x] 9. PlatformAdapter and Default Export
  - [x] 9.1 Implement PlatformAdapter class
    - Create `src/transport/platform-adapter.js`
    - Single generic class — reads export/import rules from JSON config, no subclasses
    - Implement `exportWorkspace(graph, config)` — apply export rules, produce output file keys as relative paths, produce fidelity entries
    - No filesystem I/O during export (pure transformation)
    - Implement `importWorkspace(sourceDir, config)` — apply import rules, produce valid AgentFlow paths, translate hooks via HookAbstractionLayer, normalize MCP configs
    - No conflicting output for same target path
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 9.2 Write unit tests for PlatformAdapter
    - Test export produces relative paths only
    - Test export produces fidelity entries for all matched rules
    - Test no filesystem I/O during export
    - Test import produces valid AgentFlow paths
    - Test no conflicting target paths on import
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 9.3 Implement ExportPipeline
    - Create `src/transport/export-pipeline.js`
    - Orchestrate: resolve adapter from TransportRegistry → delegate to PlatformAdapter → validate output → build FidelityReport
    - Enforce output files contain only relative paths, no `..` traversal, no absolute paths
    - Categorize every workspace file into exactly one fidelity category
    - Zero "skip" entries in fidelity report
    - Do not modify input WorkflowGraph during export
    - Return descriptive error for unregistered platform names
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 9.4 Write property test for export path safety (Property 5)
    - **Property 5: Export path safety**
    - Verify all output paths are relative, no `..` segments, no absolute prefixes
    - **Validates: Requirements 8.2, 21.1, 21.2, 21.3**

  - [ ]* 9.5 Write property test for export immutability (Property 7)
    - **Property 7: Export immutability**
    - Verify input graph is deep-equal before and after export
    - **Validates: Requirement 8.5**

  - [x] 9.6 Implement default export
    - Implement default export function (used when no `--platform` flag)
    - Resolve `{{ref}}` syntax in SKILL.md files to file path references
    - Preserve directory structure (workflows, nodes, resources)
    - Preserve `context.inputs` scope declarations and `context.exclude` lists in frontmatter
    - Preserve `AGENTS.md` identity and workflow descriptors
    - Preserve `mcp.json` and `hooks/*.json` as-is
    - Guarantee all referenced files exist in output directory
    - Produce self-contained directory that works without AgentFlow parser
    - Only `AGENTS.md` and `instructions/*.md` with `inclusion: auto` are always-loaded; all other resources on-demand
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ]* 9.7 Write property test for default export ref resolution (Property 8)
    - **Property 8: Default export ref resolution**
    - Verify all `{{ref}}` resolved to file paths, every referenced file exists in output
    - **Validates: Requirements 7.1, 7.6, 22.3**

  - [ ]* 9.8 Write property test for default export selective context (Property 9)
    - **Property 9: Default export selective context**
    - Verify only `AGENTS.md` and `instructions/*.md` with `inclusion: auto` are always-loaded
    - **Validates: Requirements 7.8, 14.1**

  - [x] 9.9 Implement ImportPipeline
    - Create `src/transport/import-pipeline.js`
    - Orchestrate: resolve adapter → delegate to PlatformAdapter → validate AgentFlow layout → build report
    - Produce files that form valid AgentFlow layout
    - Produce warning if `AGENTS.md` not present in result
    - Support `dryRun` mode — write nothing to filesystem
    - Produce no partial output on failure (atomicity)
    - Implement `detectPlatform(projectDir)` — examine for platform-specific markers, return most specific match or null
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]* 9.10 Write property test for platform auto-detection (Property 15)
    - **Property 15: Platform auto-detection**
    - Verify correct platform returned for marker files, null when no markers match
    - **Validates: Requirement 9.6**

  - [ ]* 9.11 Write property test for import produces valid AgentFlow layout (Property 16)
    - **Property 16: Import produces valid AgentFlow layout**
    - Verify output files form valid AgentFlow layout, no conflicting target paths
    - **Validates: Requirements 9.2, 11.5**

  - [ ]* 9.12 Write property test for import atomicity (Property 17)
    - **Property 17: Import atomicity**
    - Verify no partial output on failure
    - **Validates: Requirement 9.5**

- [x] 10. Checkpoint — Export/import pipelines complete
  - Ensure default export resolves refs and produces self-contained directory
  - Ensure ExportPipeline and ImportPipeline work with mock platform configs
  - Ensure all property tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [x] 11. Built-in platform configs (Tier 1 + Tier 2)
  - [x] 11.1 Create Kiro platform config
    - Create `src/transport/platforms/kiro.json`
    - Map AGENTS.md → `.kiro/steering/identity.md`, instructions → `.kiro/steering/`, capabilities/runbooks → `.kiro/steering/` (manual), hooks → `.kiro/hooks/` (translated), mcp → `.kiro/settings/mcp.json`, memory → `.kiro/memory/`
    - Include both export and import rules (bidirectional)
    - Use `identity-to-kiro-steering` transform
    - _Requirements: 13.1, 13.2_

  - [x] 11.2 Create Cursor platform config
    - Create `src/transport/platforms/cursor.json`
    - Map AGENTS.md → native, instructions (auto) → `.cursor/rules/*.mdc` (alwaysApply:true), instructions (workflow) → `.cursor/rules/*.mdc` (agent-requested), capabilities/runbooks → `.cursor/rules/*.mdc` (agent-requested), mcp → `.cursor/mcp.json`, hooks → passthrough, memory → preserved
    - Include both export and import rules
    - Use `md-to-mdc-always`, `md-to-mdc-agent-requested`, `mdc-to-md`, `capability-to-mdc`, `runbook-to-mdc` transforms
    - _Requirements: 13.1, 13.2, 14.2_

  - [x] 11.3 Create Claude Code platform config
    - Create `src/transport/platforms/claude-code.json`
    - Map AGENTS.md → `CLAUDE.md`, instructions (auto) → append to `CLAUDE.md`, instructions (workflow) → `.claude/skills/`, capabilities/runbooks → `.claude/skills/*/context/`, hooks → `.claude/settings.json` hooks[] (translated), mcp → `.claude/settings.json` mcpServers
    - Include both export and import rules
    - Use `identity-to-claude-md`, `claude-md-to-identity`, `instruction-to-claude-skill`, `claude-skill-to-instruction`, `instructions-append-to-claude-md`, `workflow-to-claude-skills` transforms
    - _Requirements: 13.1, 13.2, 14.2_

  - [x] 11.4 Create VS Code (Copilot) platform config
    - Create `src/transport/platforms/vscode-copilot.json`
    - Map AGENTS.md → native, instructions (auto) → `.github/copilot-instructions.md` (merged), instructions (workflow) → `.github/instructions/*.instructions.md`, capabilities/runbooks → `.github/instructions/*.instructions.md`, hooks → `.github/hooks/` (native), mcp → `.vscode/mcp.json`
    - Include both export and import rules
    - Use `instructions-to-copilot-instructions` transform
    - _Requirements: 13.1, 13.2, 14.2_

  - [x] 11.5 Create Windsurf platform config
    - Create `src/transport/platforms/windsurf.json`
    - Map AGENTS.md → `.windsurf/rules/identity.md` (always_on), instructions (auto) → `.windsurf/rules/*.md` (always_on), instructions (workflow) → `.windsurf/rules/*.md` (model_decision), capabilities/runbooks → `.windsurf/rules/*.md` (model_decision), mcp → `.windsurf/mcp.json`, hooks → passthrough
    - Include both export and import rules
    - Use `identity-to-windsurf-rule` transform
    - _Requirements: 13.1, 13.2, 14.2_

  - [x] 11.6 Create Agent Spec (Tier 2) platform config
    - Create `src/transport/platforms/agent-spec.json`
    - Map workflows → Agent Spec Flows, nodes → Agent Spec Agents, capabilities → Agent Spec Tools, edge conditions → routing logic with ControlFlowEdge/DataFlowEdge/BranchingNode
    - Generate Oracle Open Agent Spec JSON only, never Python code
    - Export-only capability (no import)
    - Use `graph-to-agent-spec` transform
    - _Requirements: 13.1, 13.3, 13.4, 14.3_

  - [ ]* 11.7 Write property test for Agent Spec structural mapping (Property 19)
    - **Property 19: Agent Spec structural mapping**
    - Verify each workflow → one Flow, each node → one Agent, each capability → one Tool, edges → routing logic
    - **Validates: Requirements 13.4, 14.3**

  - [ ]* 11.8 Write integration test for transport E2E
    - Parse example workspace → export to each platform → verify all files present, no drops
    - Verify fidelity report completeness for each platform
    - _Requirements: 8.3, 8.4, 13.1, 13.2_

- [x] 12. Checkpoint — All platform configs complete
  - Ensure export to all 6 platforms produces correct file layouts
  - Ensure import from all Tier 1 platforms produces valid AgentFlow layout
  - Ensure all tests pass, ask the user if questions arise.


- [x] 13. Wire CLI export/import commands to transport layer
  - [x] 13.1 Wire `agentflow export` commands
    - Replace stub in `bin/cli.js` with real implementation
    - `agentflow export [dir]` (no flags) → call default export function, write to `--output` dir
    - `agentflow export --platform <name> [dir]` → create TransportRegistry, AdapterFactory, register all, call ExportPipeline.export(), write result files
    - `agentflow export --format <fmt> [dir]` → produce raw workspace bundle in json, zip, or share format
    - _Requirements: 4.6, 4.7, 4.8_

  - [x] 13.2 Wire `agentflow import` commands
    - Replace stub in `bin/cli.js` with real implementation
    - `agentflow import --platform <name> --source <dir>` → call ImportPipeline.import()
    - `agentflow import --auto-detect --source <dir>` → call detectPlatform() then import()
    - _Requirements: 4.9, 4.10_

- [x] 14. Round-trip fidelity testing
  - [ ]* 14.1 Write property test for full export-import round-trip (Property 12)
    - **Property 12: Full export-import round-trip**
    - For each Tier 1 platform: export workspace → import back → verify all resources preserved with correct categories and scopes
    - **Validates: Requirement 22.1**

  - [ ]* 14.2 Write integration test for round-trip per platform
    - Parse example workspace → export to Kiro → import back → verify graph equality
    - Repeat for Cursor, Claude Code, VS Code, Windsurf
    - _Requirements: 22.1, 22.2_

  - [ ]* 14.3 Write integration test for default export
    - Parse example workspace → default export → verify directory structure, resolved refs, selective context preserved
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [x] 15. Checkpoint — Transport layer fully wired
  - Ensure CLI export/import commands work end-to-end
  - Ensure round-trip fidelity for all Tier 1 platforms
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 16. Studio Agent mode
  - [ ] 16.1 Implement Studio Agent integration
    - Update `studio/lib/copilot/agent.ts` to consume exported Agent Spec JSON via CopilotKit with LangGraph backend
    - Scope agent to `.agentflow/` directory only via `safePath()` for workspace operations
    - Wire tools: `readWorkspaceFile`, `listWorkspaceDirectory`, `searchWorkspace`, plus frontend tools
    - _Requirements: 18.1, 18.2, 18.3_

  - [ ] 16.2 Implement LangGraph unavailable state
    - When LangGraph runtime is unreachable, display "AI agent not available" in the chat panel
    - Ensure all non-AI editing features work without LangGraph (visual editing, validation, dry-run, token calculation, export, import)
    - Disable AI chat features and display clear status message
    - _Requirements: 18.4, 20.1, 20.2_

  - [ ]* 16.3 Write property test for safePath boundary enforcement (Property 18)
    - **Property 18: safePath boundary enforcement**
    - Verify Studio Agent rejects paths outside `.agentflow/`
    - Verify Playground Agent rejects paths outside project root
    - **Validates: Requirements 18.2, 19.6**

- [ ] 17. Playground Agent mode
  - [ ] 17.1 Implement Playground Agent integration
    - Consume user's exported workflow via Agent Spec JSON → CopilotKit → LangGraph
    - Scope to capabilities and MCP servers declared by the workflow
    - Wire tools from workflow's capabilities + MCP bridge
    - Create separate chat interface in studio UI
    - Activate when user clicks "Test" on a workflow
    - Expand `safePath()` boundary to project root
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

  - [ ]* 17.2 Write unit tests for Playground Agent
    - Test scoping to workflow capabilities
    - Test tool wiring from capabilities + MCP bridge
    - Test safePath boundary at project root
    - _Requirements: 19.1, 19.2, 19.3, 19.6_

- [ ] 18. Checkpoint — Agent modes complete
  - Ensure Studio Agent works with CopilotKit + LangGraph
  - Ensure Playground Agent activates on workflow test
  - Ensure studio works fully without LangGraph runtime
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 19. Parser correctness property tests
  - [ ]* 19.1 Write property test for no file loss in parsing (Property 2)
    - **Property 2: No file loss in parsing**
    - Verify every `.md` file accounted for in exactly one bucket, no duplicates, no missing
    - **Validates: Requirement 6.1**

  - [ ]* 19.2 Write property test for idempotent parsing (Property 3)
    - **Property 3: Idempotent parsing**
    - Verify `parseRoot()` called twice produces identical output
    - **Validates: Requirement 6.2**

  - [ ]* 19.3 Write property test for canonical keys and valid scopes (Property 4)
    - **Property 4: Canonical keys and valid scopes**
    - Verify WorkflowGraph contains only canonical keys, every resource has valid scope
    - **Validates: Requirements 5.4, 6.3**

- [ ] 20. Final checkpoint — All features complete
  - Ensure all 22 requirements are covered by implementation
  - Ensure all property tests pass
  - Ensure all unit and integration tests pass
  - Ensure CLI commands work end-to-end
  - Ensure studio builds and runs with `@agentflow/*` imports
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at each phase boundary
- Property tests validate universal correctness properties from the design document
- Taxonomy consolidation is already complete — no tasks for taxonomy work
- Parser canonical keys are already implemented — no tasks for parser taxonomy changes
- The legacy `src/transport/` prototype is used as reference only; the transport layer is rewritten clean
- `next-app/` is the current working codebase; `agentflow/` (old Fastify server) is legacy
