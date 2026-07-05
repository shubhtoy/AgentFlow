# AgentFlow — Feature Map

Central index of what exists and exactly where. Check here before assuming something is
missing or before re-deriving something already built. Update this file in the same commit
whenever you ship a new capability or move/rename one.

Format per entry: **Feature** — one-line description. `path/to/file` — key export(s).

## packages/core (browser-safe, zero Node deps)

- **Ref model + extraction** — parses `{{...}}` DSL tokens into a typed `Ref`.
  `packages/core/src/parser-core.ts` — `extractRefs`, `parseRef`, `REF_PATTERNS`
- **Graph builder** — turns a flat file map into nodes/edges/workflows/entry-points.
  `packages/core/src/parser-core.ts` — `parseFromFiles`, `ParsedGraph`
- **Ref resolution** — resolves a `Ref` to its target file/node (path-first, then name).
  `packages/core/src/parser-core.ts` — `resolveRef`, `resolveEdgeTarget`
- **Identity assembly (L0/L1)** — resolves + loads AGENTS.md descriptor refs (workspace +
  per-workflow) into `graph.identityAssembly`.
  `packages/core/src/parser-core.ts` — `assembleIdentity`
- **Ref → relative-path resolution (export)** — rewrites `{{...}}` tokens to plain relative
  file paths for the exported, host-agnostic walkable directory. Handles mentions, edges
  (incl. conditional), and data-flow (`{{<< output.node}}` → producing node's `output/` dir).
  `packages/core/src/ref-paths.ts` — `toRelativePath`, `rewriteRefsToPaths`, `resolveRefsToPaths`
- **Validator** — schema, structure (entry points, cycles as warnings, unreachable nodes,
  sub-workflow loops), variable-token, and ref validation composed into one `validate()`.
  `packages/core/src/validator/index.ts` — `validate`
  `packages/core/src/validator/structure.ts` — `detectCycles`, `findUnreachable`
  `packages/core/src/validator/variables.ts` — `validateVariables`
- **Taxonomy** — canonical directory ↔ category ↔ resource-type mappings.
  `packages/core/src/taxonomy.ts`
- **Frontmatter schemas** — per-resource-type YAML frontmatter validation schemas.
  `packages/core/src/schemas/frontmatter-schemas.ts`

## packages/cli (Node — fs-walking, export, MCP bridge)

- **fs-walking parser** — reads the `.agentflow/` directory tree, delegates parsing to core.
  `packages/cli/src/parser.ts` — `parseRoot`, `parseWorkflow`, `parseNode`, `parseMarkdownFile`
- **Export engine** — maps a `ParsedGraph` to per-platform file outputs via declarative
  transform rules (`configs/platforms.json`).
  `packages/cli/src/export/engine.ts` — `exportForPlatform`, `getPlatformConfig`
- **Export transforms** — reusable per-field transform functions (concatenate, flatten-skill,
  split-identity, merge-mcp-config, to-mdc, to-skill-dir, copy, rename).
  `packages/cli/src/export/transforms/`
- **Agent Spec export** — Oracle Agent Spec serialization (~31-35% compliant; only needed for
  the runtime-framework bridge, not the IDE/directory-walk product — see MASTER-PLAN.md).
  `packages/cli/src/export/agent-spec-transform.ts`
- **Repo scanner** — discovers `.agentflow/` dirs + resources/workflows across a repo tree.
  `packages/cli/src/git/repo-scanner.ts` — `findAgentflowDirs`
- **Git integration** — clone/sync/config for git-backed workspace sources.
  `packages/cli/src/git/` — `git-manager.ts`, `sync-engine.ts`, `config-manager.ts`
- **MCP bridge** — tool discovery/scaffolding and MCP server config management.
  `packages/cli/src/mcp/` — `tool-provider.ts`, `tool-scaffolder.ts`, `config-manager.ts`,
  `server-lifecycle.ts`, `unified-search.ts`
- **Services layer** — workflow/instruction/import/git/hook services consumed by the studio API.
  `packages/cli/src/services/`

## studio (Next.js + ReactFlow)

- Visual canvas, node editor, chat/copilot — see `studio/AGENTS.md` for the app-level map.

## library/ (reusable templates)

- Workflow/skill/instruction/hook templates installable into a workspace. Indexed by
  `library/registry.json` (currently missing the `agent-builder` workflow — Epic 7 #32).

## Known gaps / not yet built (see GitHub Project #4 for tracked epics)

- Capability/tool binding on export (Epic 4, #20-23) — the one unproven mechanic.
- Native per-host selective-context selectors beyond directory-walk (Epic 2, #14).
- Claude Code / Cursor export targets (Epic 3, #16-17) — Kiro only so far.
- MCP execution controller (Epic 5) and packaging/versioning (Epic 6) — later scope.

## Tooling / conventions

- **Coding standards**: `docs/CODING-STANDARDS.md` — read before writing new code.
- **Lint**: TypeScript-native config (`eslint.config.mjs`), not `airbnb-base`. `npm run lint`
  is 0 errors/0 warnings project-wide — keep it that way (see CODING-STANDARDS.md for how to
  handle a rule that doesn't fit a file). `eslint-config-airbnb-base`/`@eslint/eslintrc` in
  `package.json` are now unused leftovers from the old config — safe to remove in a cleanup pass.
