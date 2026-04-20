# Requirements Document

## Introduction

AgentFlow v2 restructures the platform into a single open-source npm package for authoring, exporting, and consuming AI agent workflows. This requirements document captures the functional and structural requirements derived from the v2 architecture design, covering package consolidation, CLI rewrite, platform export engine, hook abstraction, fidelity reporting, agent modes, and correctness guarantees.

## Glossary

- **AgentFlow**: The overall system for authoring, exporting, and consuming AI agent workflows
- **Parser**: The module (`src/parser.js`) that reads `.agentflow/` directories and produces a `WorkflowGraph`
- **WorkflowGraph**: The parsed in-memory representation of an `.agentflow/` workspace
- **Taxonomy_Registry**: The single source of truth (`src/taxonomy.js`) defining the 6 canonical categories and their scopes
- **CLI**: The command-line interface (`bin/cli.js`) for interacting with AgentFlow
- **ExportPipeline**: The orchestrator that resolves adapters, delegates export, validates output, and builds fidelity reports
- **ImportPipeline**: The orchestrator that resolves adapters, delegates import, validates AgentFlow layout, and builds reports
- **TransportRegistry**: A registry of platform adapters keyed by name, enforcing uniqueness
- **PlatformAdapter**: A single generic class that reads export/import rules from JSON config and applies transforms
- **AdapterFactory**: The component that discovers platform configs (built-in + user overrides), deep-merges, validates with zod, and creates adapters
- **TransformRegistry**: A registry of named transform functions referenced by string in platform configs
- **HookAbstractionLayer**: A single class with internal mapping tables (`HOOK_EVENT_MAP`, `HOOK_ACTION_MAP`, `HOOK_STRUCTURE_MAP`) for cross-platform hook translation
- **FidelityReporter**: The component that builds human-readable and machine-readable fidelity reports
- **FidelityReport**: A structured report with entries categorized as native, on-demand, translated, or preserved
- **Default_Export**: The universal directory format with resolved refs and selective context preserved
- **Tier_1_Platform**: An IDE platform (Kiro, Cursor, Claude Code, VS Code/Copilot, Windsurf) supporting bidirectional export and import
- **Tier_2_Platform**: A runtime framework target (Oracle Open Agent Spec JSON)
- **Studio_Agent**: The built-in AI agent for authoring workflows, scoped to `.agentflow/`
- **Playground_Agent**: The AI agent for testing user-built workflows, scoped to the workflow's declared capabilities
- **Platform_Config**: A JSON file defining export/import rules for a specific platform, validated against `PlatformConfigSchema`
- **Canonical_Hook**: The intermediate hook representation using PascalCase events and `command`/`prompt` action types
- **Workspace_Root**: The resolved root directory containing the `.agentflow/` workspace

## Requirements

### Requirement 1: Package Structure Consolidation

**User Story:** As a developer, I want AgentFlow restructured into a single npm package, so that I can install and use it without managing multiple packages or duplicate code.

#### Acceptance Criteria

1. THE AgentFlow SHALL be structured as a single npm package with one `package.json` at the repository root
2. WHEN the package is structured, THE AgentFlow SHALL place all core modules (parser, taxonomy, validator, dry-runner, token-calculator, branding, schemas, services) under `src/`
3. WHEN the package is structured, THE AgentFlow SHALL place the Next.js studio application under `studio/`
4. WHEN the package is structured, THE AgentFlow SHALL archive the legacy Fastify server code to `_archive/agentflow-legacy/`
5. WHEN both `src/` and `next-app/lib/` contain the same file, THE AgentFlow SHALL use the `next-app/lib/` version as canonical
6. WHEN the package is structured, THE AgentFlow SHALL delete dead code: `orchestrator.js`, `orchestrator-service.js`, `steering-manager.js`, and the orchestrator API route

### Requirement 2: Studio Import Strategy

**User Story:** As a developer, I want the studio to import core modules through path aliases, so that the codebase avoids fragile relative imports and maintains clean separation.

#### Acceptance Criteria

1. THE studio SHALL import all core modules from `src/` using TypeScript path aliases (`@agentflow/*`)
2. THE studio SHALL configure `tsconfig.json` paths to map `@agentflow/*` to `../src/*`
3. THE studio SHALL configure `next.config.ts` to transpile the `../src` package

### Requirement 3: Workspace Root Resolution

**User Story:** As a user, I want AgentFlow to automatically find my workspace root, so that CLI commands work from any subdirectory.

#### Acceptance Criteria

1. WHEN `AGENTFLOW_ROOT` environment variable is set, THE CLI SHALL use that value as the workspace root
2. WHEN `_AGENTFLOW_CLI_ROOT` environment variable is set and `AGENTFLOW_ROOT` is not, THE CLI SHALL use that value as the workspace root
3. WHEN no environment variable is set, THE CLI SHALL walk up the directory tree from `cwd` looking for a `.agentflow/` directory
4. IF no `.agentflow/` directory is found during traversal, THEN THE CLI SHALL default to `cwd/.agentflow/`

### Requirement 4: CLI Commands

**User Story:** As a developer, I want a comprehensive CLI for AgentFlow, so that I can scaffold, parse, validate, export, import, and manage workflows from the terminal.

#### Acceptance Criteria

1. WHEN `agentflow init [dir]` is invoked, THE CLI SHALL scaffold a `.agentflow/` directory with canonical taxonomy directories (`instructions/`, `capabilities/`, `runbooks/`, `memory/`, `hooks/`) and an `AGENTS.md` file
2. WHEN `agentflow dev [dir]` is invoked without `--agent`, THE CLI SHALL start the Next.js studio with `AGENTFLOW_ROOT` set to the resolved workspace root
3. WHEN `agentflow dev --agent [dir]` is invoked, THE CLI SHALL start both the Next.js studio and the LangGraph runtime concurrently
4. WHEN `agentflow parse [dir]` is invoked, THE CLI SHALL call `parseRoot()` and output the resulting JSON to stdout or to the file specified by `--output`
5. WHEN `agentflow validate [dir]` is invoked, THE CLI SHALL call `validate()`, print errors and warnings, and exit with code 1 when errors are present
6. WHEN `agentflow export [dir]` is invoked without `--platform` or `--format`, THE CLI SHALL produce a default export (resolved directory format)
7. WHEN `agentflow export --platform <name> [dir]` is invoked, THE CLI SHALL use the ExportPipeline to export to the specified platform
8. WHEN `agentflow export --format <fmt> [dir]` is invoked, THE CLI SHALL produce a raw workspace bundle in the specified format (json, zip, or share)
9. WHEN `agentflow import --platform <name> --source <dir>` is invoked, THE CLI SHALL use the ImportPipeline to import from the specified platform
10. WHEN `agentflow import --auto-detect --source <dir>` is invoked, THE CLI SHALL call `detectPlatform()` and then import from the detected platform
11. WHEN `agentflow graph [dir]` is invoked, THE CLI SHALL parse the workspace and print an ASCII edge list
12. WHEN `agentflow tokens [dir]` is invoked, THE CLI SHALL calculate and display context token estimates
13. WHEN `agentflow dry-run [dir]` is invoked, THE CLI SHALL simulate workflow execution
14. WHEN `agentflow add <type> <name>` is invoked, THE CLI SHALL copy the specified resource from the built-in library to the workspace
15. WHEN `agentflow search <query>` is invoked, THE CLI SHALL search across the local library and MCP registry
16. WHEN `agentflow library <action>` is invoked, THE CLI SHALL manage the library registry (index, list, search)
17. WHEN `agentflow git <subcommand>` is invoked, THE CLI SHALL delegate to the git service
18. WHEN `agentflow mcp <subcommand>` is invoked, THE CLI SHALL delegate to the MCP services


### Requirement 5: Taxonomy Registry

**User Story:** As a developer, I want a single taxonomy registry as the source of truth for all categories, so that category definitions are consistent across the entire system.

#### Acceptance Criteria

1. THE Taxonomy_Registry SHALL define exactly 6 canonical categories: instructions, capabilities, runbooks, memory, hooks, and identity
2. THE Taxonomy_Registry SHALL be the single source of truth for category definitions, scope values, and derived constants
3. WHEN any module needs category information, THE module SHALL import from `src/taxonomy.js` and not use hardcoded category arrays
4. WHEN the Parser processes a resource, THE Parser SHALL assign a valid scope from the Taxonomy_Registry based on frontmatter and category

### Requirement 6: Parser Correctness

**User Story:** As a developer, I want the parser to produce a complete and deterministic workflow graph, so that no workspace files are lost and results are reproducible.

#### Acceptance Criteria

1. WHEN `parseRoot(dir)` is called, THE Parser SHALL account for every `.md` file in exactly one canonical category, `customFiles`, or workflow node
2. WHEN `parseRoot(dir)` is called twice on the same directory without changes, THE Parser SHALL produce identical output
3. WHEN the Parser processes a workspace, THE Parser SHALL output a WorkflowGraph with canonical keys only
4. WHEN the Parser encounters a resource with frontmatter, THE Parser SHALL infer scope using `inferScope()`

### Requirement 7: Default Export

**User Story:** As a developer, I want a default export that produces a self-contained directory with resolved references, so that any AI tool can consume the output without needing the AgentFlow parser.

#### Acceptance Criteria

1. WHEN a default export is performed, THE ExportPipeline SHALL resolve `{{ref}}` syntax in SKILL.md files to file path references
2. WHEN a default export is performed, THE ExportPipeline SHALL preserve the directory structure (workflows, nodes, resources)
3. WHEN a default export is performed, THE ExportPipeline SHALL preserve `context.inputs` scope declarations and `context.exclude` lists in frontmatter
4. WHEN a default export is performed, THE ExportPipeline SHALL preserve `AGENTS.md` identity and workflow descriptors
5. WHEN a default export is performed, THE ExportPipeline SHALL preserve `mcp.json` and `hooks/*.json` as-is
6. WHEN a default export is performed, THE ExportPipeline SHALL guarantee that all referenced files exist in the output directory
7. WHEN a default export is performed, THE ExportPipeline SHALL produce a self-contained directory that works without the AgentFlow parser
8. WHEN a default export is performed, THE ExportPipeline SHALL treat only `AGENTS.md` and `instructions/*.md` with `inclusion: auto` as always-loaded; all other resources SHALL remain on-demand

### Requirement 8: Platform Export Pipeline

**User Story:** As a developer, I want a config-driven platform export pipeline, so that I can export workflows to any supported IDE platform or runtime format.

#### Acceptance Criteria

1. WHEN `ExportPipeline.export()` is called, THE ExportPipeline SHALL resolve the adapter from the TransportRegistry, delegate to the PlatformAdapter, validate output, and build a FidelityReport
2. WHEN `ExportPipeline.export()` completes, THE ExportPipeline SHALL produce output files containing only relative paths
3. WHEN `ExportPipeline.export()` completes, THE ExportPipeline SHALL categorize every workspace file into exactly one fidelity category (native, on-demand, translated, or preserved)
4. WHEN `ExportPipeline.export()` completes, THE ExportPipeline SHALL produce zero "skip" entries in the fidelity report
5. THE ExportPipeline SHALL not modify the input WorkflowGraph during export
6. WHEN a platform name is not registered in the TransportRegistry, THE ExportPipeline SHALL return a descriptive error

### Requirement 9: Platform Import Pipeline

**User Story:** As a developer, I want to import platform-specific project structures back into AgentFlow format, so that I can migrate existing projects.

#### Acceptance Criteria

1. WHEN `ImportPipeline.import()` is called, THE ImportPipeline SHALL resolve the adapter, delegate to the PlatformAdapter, validate the resulting AgentFlow layout, and build a report
2. WHEN `ImportPipeline.import()` completes, THE ImportPipeline SHALL produce files that form a valid AgentFlow layout
3. IF `AGENTS.md` is not present in the import result, THEN THE ImportPipeline SHALL produce a warning
4. WHEN `dryRun` mode is enabled, THE ImportPipeline SHALL write nothing to the filesystem
5. IF an import fails partway through, THEN THE ImportPipeline SHALL produce no partial output
6. WHEN `detectPlatform()` is called, THE ImportPipeline SHALL examine the project directory for platform-specific markers and return the most specific match or null

### Requirement 10: Transport Registry and Adapter Factory

**User Story:** As a developer, I want a registry of platform adapters with automatic discovery, so that adding a new platform requires only dropping a JSON config file.

#### Acceptance Criteria

1. THE TransportRegistry SHALL store platform adapters keyed by name and enforce uniqueness
2. THE TransportRegistry SHALL support filtering adapters by capability (export-only vs bidirectional)
3. WHEN the AdapterFactory discovers platform configs, THE AdapterFactory SHALL load from both built-in and user override directories (`.agentflow/transport/`)
4. WHEN both a built-in and user override config exist for the same platform, THE AdapterFactory SHALL deep-merge them with user overrides taking precedence
5. WHEN the AdapterFactory loads a platform config, THE AdapterFactory SHALL validate it against the PlatformConfigSchema using zod

### Requirement 11: Platform Adapter

**User Story:** As a developer, I want a single generic platform adapter class, so that platform-specific behavior is driven by JSON config rather than subclasses.

#### Acceptance Criteria

1. THE PlatformAdapter SHALL be a single generic class that reads export and import rules from a JSON config
2. WHEN `PlatformAdapter.exportWorkspace()` is called, THE PlatformAdapter SHALL produce output file keys as relative paths and fidelity entries covering all matched rules
3. THE PlatformAdapter SHALL not perform filesystem I/O during export (pure transformation)
4. WHEN `PlatformAdapter.importWorkspace()` is called, THE PlatformAdapter SHALL produce valid AgentFlow paths with hooks translated through the HookAbstractionLayer and MCP configs normalized
5. WHEN `PlatformAdapter.importWorkspace()` processes rules, THE PlatformAdapter SHALL produce no conflicting output for the same target path


### Requirement 12: Platform Config Schema

**User Story:** As a developer, I want a well-defined schema for platform configs, so that configs are validated and consistent across all platforms.

#### Acceptance Criteria

1. THE Platform_Config SHALL include: name, displayName, version, tier (ide or runtime), capabilities (export and/or import), and exportRules
2. WHEN a Platform_Config specifies tier `ide`, THE Platform_Config SHALL support bidirectional export and import capabilities
3. WHEN a Platform_Config specifies tier `runtime`, THE Platform_Config SHALL support at minimum export capability
4. WHEN an export rule is defined, THE export rule SHALL specify source, target, type (single-file, glob-copy, glob-transform, merge-into, or passthrough), and fidelity (native, on-demand, translated, or preserved)
5. WHEN an import rule is defined, THE import rule SHALL specify platformPath, agentflowTarget, type (single-file, glob-transform, extract-from, or passthrough), and fidelity

### Requirement 13: Built-in Platform Configs

**User Story:** As a developer, I want built-in platform configs for all supported platforms, so that I can export and import without custom configuration.

#### Acceptance Criteria

1. THE AgentFlow SHALL provide built-in platform configs for Kiro, Cursor, Claude Code, VS Code (Copilot), Windsurf, and Agent Spec
2. WHEN exporting to a Tier_1_Platform, THE PlatformAdapter SHALL map AgentFlow concepts to the platform's native file layout as defined in the platform mapping table
3. WHEN exporting to Agent Spec (Tier_2_Platform), THE PlatformAdapter SHALL generate Oracle Open Agent Spec JSON only, never Python code
4. WHEN exporting to Agent Spec, THE PlatformAdapter SHALL map each workflow to one Agent Spec Flow, each node to one Agent Spec Agent, each capability to one Agent Spec Tool, and edge conditions to routing logic

### Requirement 14: Selective Context Preservation

**User Story:** As a developer, I want exports to preserve selective context loading, so that exported workflows maintain the same on-demand resource loading behavior as the source.

#### Acceptance Criteria

1. WHEN exporting, THE ExportPipeline SHALL preserve the distinction between always-loaded resources (`AGENTS.md`, `instructions/*.md` with `inclusion: auto`) and on-demand resources
2. WHEN exporting to a Tier_1_Platform, THE PlatformAdapter SHALL use the platform's native mechanism for on-demand loading (e.g., Kiro `inclusion: manual`, Cursor `alwaysApply: false`, Windsurf `trigger: model_decision`)
3. WHEN exporting to Agent Spec, THE PlatformAdapter SHALL preserve execution order via `ControlFlowEdge`, data flow via `DataFlowEdge`, and conditional routing via `BranchingNode`

### Requirement 15: Hook Abstraction Layer

**User Story:** As a developer, I want hooks translated correctly across platforms, so that event-driven automation works regardless of the target platform.

#### Acceptance Criteria

1. THE HookAbstractionLayer SHALL use internal mapping tables (`HOOK_EVENT_MAP`, `HOOK_ACTION_MAP`, `HOOK_STRUCTURE_MAP`) for cross-platform hook translation
2. WHEN translating hooks for export, THE HookAbstractionLayer SHALL convert AgentFlow hooks to canonical format (PascalCase events, `command`/`prompt` actions) and then to the target platform format
3. WHEN translating hooks for import, THE HookAbstractionLayer SHALL convert platform hooks to canonical format and then to AgentFlow format
4. WHEN translating hooks, THE HookAbstractionLayer SHALL include every hook in the output with zero silent drops
5. IF a hook event is untranslatable for the target platform, THEN THE HookAbstractionLayer SHALL produce a warning and preserve the hook
6. WHEN importing hooks, THE HookAbstractionLayer SHALL preserve platform-specific fields in `_platformExtensions`
7. WHEN hooks are exported and then imported back, THE HookAbstractionLayer SHALL preserve all semantic content (round-trip fidelity)

### Requirement 16: Fidelity Reporter

**User Story:** As a developer, I want a structured fidelity report after export or import, so that I can understand exactly how each resource was mapped.

#### Acceptance Criteria

1. THE FidelityReporter SHALL produce a FidelityReport containing: platform name, direction (export or import), an array of fidelity entries, a summary object, and a markdown string
2. WHEN building a FidelityReport, THE FidelityReporter SHALL categorize each entry as exactly one of: native, on-demand, translated, or preserved
3. THE FidelityReporter SHALL produce zero "skip" entries; the sum of native, on-demand, translated, and preserved counts SHALL equal the total entry count
4. THE FidelityReporter SHALL produce both human-readable markdown and machine-readable structured output

### Requirement 17: Built-in Transforms

**User Story:** As a developer, I want a registry of named transform functions, so that platform configs can reference transforms by string and the system applies them during export and import.

#### Acceptance Criteria

1. THE TransformRegistry SHALL provide named transform functions for all built-in transforms (md-to-mdc-always, md-to-mdc-agent-requested, mdc-to-md, identity-to-claude-md, claude-md-to-identity, instruction-to-claude-skill, claude-skill-to-instruction, identity-to-windsurf-rule, identity-to-kiro-steering, instructions-append-to-claude-md, instructions-to-copilot-instructions, mcp-remap, mcp-reverse, graph-to-agent-spec, workflow-to-skill-dirs, workflow-to-claude-skills, capability-to-mdc, runbook-to-mdc, hooks-to-instructions)
2. WHEN a platform config references a transform by name, THE TransformRegistry SHALL resolve and apply the corresponding transform function
3. IF a platform config references an unregistered transform name, THEN THE TransformRegistry SHALL return a descriptive error

### Requirement 18: Studio Agent Mode

**User Story:** As a user, I want a built-in AI agent in the studio for authoring workflows, so that I can get AI assistance while building agent workflows.

#### Acceptance Criteria

1. THE Studio_Agent SHALL consume exported Agent Spec JSON via CopilotKit with LangGraph as the execution backend
2. THE Studio_Agent SHALL be scoped to the `.agentflow/` directory only via `safePath()` for workspace operations
3. THE Studio_Agent SHALL have access to tools: `readWorkspaceFile`, `listWorkspaceDirectory`, `searchWorkspace`, plus frontend tools
4. WHEN the LangGraph runtime is unreachable, THE studio SHALL display "AI agent not available" in the chat panel

### Requirement 19: Playground Agent Mode

**User Story:** As a user, I want a playground agent for testing my workflows, so that I can validate workflow behavior before deploying.

#### Acceptance Criteria

1. THE Playground_Agent SHALL consume the user's exported workflow via Agent Spec JSON through CopilotKit and LangGraph
2. THE Playground_Agent SHALL be scoped to the capabilities and MCP servers declared by the workflow
3. THE Playground_Agent SHALL wire tools from the workflow's capabilities and MCP bridge
4. THE Playground_Agent SHALL use a separate chat interface in the studio UI
5. WHEN a user clicks "Test" on a workflow, THE studio SHALL activate the Playground_Agent for that workflow
6. THE Playground_Agent SHALL expand the `safePath()` boundary to the project root

### Requirement 20: LangGraph Optional for Editing

**User Story:** As a user, I want all non-AI editing features to work without the LangGraph runtime, so that I can author and manage workflows even without an AI backend.

#### Acceptance Criteria

1. WHILE the LangGraph runtime is not running, THE studio SHALL provide full functionality for visual editing, validation, dry-run, token calculation, export, and import
2. WHILE the LangGraph runtime is not running, THE studio SHALL disable AI chat features and display a clear status message

### Requirement 21: Path Safety

**User Story:** As a developer, I want all exports to produce safe relative paths, so that exported files never escape the output directory.

#### Acceptance Criteria

1. THE ExportPipeline SHALL produce output files containing only relative paths
2. THE ExportPipeline SHALL produce no paths containing `..` traversal segments
3. THE ExportPipeline SHALL produce no absolute paths in any output file

### Requirement 22: Round-Trip Export-Import Fidelity

**User Story:** As a developer, I want export followed by import to preserve all resources, so that I can round-trip workflows between AgentFlow and platform formats without data loss.

#### Acceptance Criteria

1. WHEN a workspace is exported to a Tier_1_Platform and then imported back, THE system SHALL preserve all resources with correct categories and scopes
2. WHEN hooks are exported and then imported back, THE HookAbstractionLayer SHALL preserve all semantic content
3. WHEN a default export is performed, THE ExportPipeline SHALL produce output where all `{{ref}}` references are resolved to valid file paths within the output directory
