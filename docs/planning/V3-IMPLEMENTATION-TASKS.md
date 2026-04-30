# V3 Implementation Tasks

> From V3-ENGINE-RETHINK.md. Each task updates code + docs + CLI together.
> Subagents execute tasks. Phase 0 first, then phases can parallelize.

---

## Phase 0: Code Standards

### Task 0.1: ESLint + Prettier + EditorConfig + TypeScript base

**Do:**
- Add root `.eslintrc.js` — Airbnb base + Prettier integration
- Add root `.prettierrc` — single quotes, no semis, trailing commas
- Add root `.editorconfig` — 2-space indent, UTF-8, LF
- Add `eslint-config-prettier`, `eslint-config-airbnb-base`, `@typescript-eslint/*` as dev deps
- Add `tsconfig.base.json` at root — strict, ES2020 target, module resolution
- Add `packages/core/tsconfig.json` — extends base, no Node types (browser-safe)
- Add `packages/cli/tsconfig.json` — extends base, Node types
- Add lint scripts to root `package.json`: `lint`, `lint:fix`, `format`
- Verify studio's existing tsconfig/eslint still works

**Files:** New config files at root + packages. No code changes yet.

---

## Phase 1: Core Engine (TypeScript rewrite)

All core files rewritten from .js to .ts with V3 logic.

### Task 1.1: Taxonomy + schemas (core)

**Code:**
- Rewrite `packages/core/src/taxonomy.ts` — 5 categories (instructions, capabilities, skills, memory, hooks). No runbooks. No `inferScope()`. Config-driven: categories define dir, icon, color, scope, fileFormat, subtypes. Export same constants: `CANONICAL_CATEGORIES`, `RESERVED_DIRS`, `DIR_TO_CATEGORY`, etc.
- Rewrite `packages/core/src/schemas/frontmatter-schemas.ts` — Remove runbook. Add skill (name, description, allowed-tools, tags). Add condition (name, description, check). Node type enum = [step, sub-workflow]. Instruction: remove scope/inclusion, add platforms. narrativeTemplate on all resource types. Update `resolveSchemaKey()`.
- Rewrite `packages/core/src/schemas/builder-schemas.ts` — Update nodeType enum. Remove interactions/runbook fields.
- Rewrite `packages/core/src/schemas/index.ts` — Re-export all.
- Delete old `.js` versions of above.

**Docs (10 files):**
- `concepts/resources.mdx` — swap runbooks→skills (7 hits)
- `concepts/workspaces.mdx` — update structure (3 hits)
- `concepts/directory-as-architecture.mdx` — update Files tree + parser mermaid (3 hits)
- `concepts/index.mdx` — update category mention (1 hit)
- `authoring/writing-resources.mdx` — remove runbook section, add skill section (5 hits)
- `authoring/directory-layout.mdx` — update tree (4 hits)
- `authoring/index.mdx` — update mention (1 hit)
- `reference/frontmatter-schema.mdx` — complete rewrite for V3 schemas (6 hits)
- `reference/ref-syntax.mdx` — update condition ref syntax (1 hit)
- `studio/frontmatter.mdx` — update form fields (4 hits)

---

### Task 1.2: Parser rewrite (core)

**Code:**
- Rewrite `packages/core/src/parser-core.ts` — V3 classification chain (frontmatter→dir→untyped). Skills parsing with directory structure (references/, scripts/, assets/). Router inference from conditional edges (`node.isRouter` computed property). AGENTS.md ref resolution for L0/L1 auto-loading. `NODE_TYPE_ALIASES = ['step', 'sub-workflow']`. Output shape: `{ workflows, instructions, capabilities, skills, memory, hooks, customFiles, allFiles }` — no runbooks key.
- Rewrite `packages/core/src/parser-browser.ts` — thin wrapper, same as before.
- Rewrite `packages/core/src/validator.ts` — config-driven rules. No runbook validation. Add skill validation. Load rules from config object.
- Rewrite `packages/core/src/exporter.ts` — remove old export logic. Keep only `resolveToPath` and ref resolution helpers needed by other modules. The heavy export moves to CLI.
- Rewrite `packages/core/src/errors.ts` — TS version.
- Rewrite `packages/core/src/utils/compatibility.ts`, `narrative.ts` — remove runbook refs.
- Delete old `.js` versions.

**Docs (10 files):**
- `concepts/selective-context.mdx` — add AGENTS.md ref resolution note, replace runbook examples (6 hits)
- `concepts/references.mdx` — update ref resolution, replace runbook refs (9 hits)
- `concepts/edges.mdx` — conditions are inline text or resource refs, not runbooks (18 hits)
- `concepts/nodes.mdx` — 2 types + inferred router (5 hits)
- `concepts/validation.mdx` — update rule examples (6 hits)
- `reference/node-types.mdx` — rewrite (6 hits)
- `reference/validation-rules.mdx` — regenerate (1 hit)
- `authoring/writing-nodes.mdx` — remove type:router requirement (3 hits)
- `authoring/patterns.mdx` — update routing patterns (13 hits)
- `contributing/parser-validator.mdx` — update architecture (2 hits)

---

### Task 1.3: CLI rewrite

**Code:**
- Rewrite `packages/cli/src/parser.ts` — import ALL shared logic from core (parseRef, extractRefs, classifyResource, identifyPrimaryFile, resolveEdgeTarget, parseMarkdownContent, resolveRef, parseFromFiles). Only keep fs-walking: `parseNode()`, `parseWorkflow()`, `parseRoot()`. Add skills directory walking. ~300 lines, not 1095.
- Rewrite `packages/cli/src/services/scaffold-gen-service.ts` — V3 scaffold: instructions/, capabilities/, skills/, memory/, hooks/. No runbooks.
- Rewrite `packages/cli/src/services/workflow-service.ts` — remove runbook refs.
- Rewrite `packages/cli/src/services/export-service.ts` — delegate to new export engine.
- Rewrite `packages/cli/src/services/validation-service.ts` — delegate to core validator.
- Rewrite `packages/cli/src/services/import-service.ts` — remove runbook handling.
- Rewrite `packages/cli/src/services/instruction-manager.ts` — remove runbook refs.
- Rewrite `packages/cli/src/services/template-service.ts`, `hook-registry.ts`, `mcp-bridge.ts` — TS conversion.
- Rewrite `packages/cli/src/svc-utils/validate-path.ts`, `file-io.ts` — TS conversion.
- Rewrite `packages/cli/src/structured-exporter.ts` — use new export engine.
- Rewrite `packages/cli/src/pretty-printer.ts` — remove runbook refs.
- Rewrite `packages/cli/src/library.ts` — remove runbook refs.
- Rewrite `packages/cli/src/branding.ts` — TS conversion.
- Rewrite `packages/cli/bin/cli.js` — update commands, remove runbook refs. (Keep as .js entry point, imports TS-compiled modules.)
- Rewrite `packages/cli/src/git/*.ts` — TS conversion of git-manager, config-manager, sync-engine, repo-scanner.
- Rewrite `packages/cli/src/mcp/*.ts` — TS conversion of config-manager, tool-provider, server-lifecycle, tool-scaffolder, unified-search.
- Delete all old `.js` files in packages/cli/src/.

**Docs (2 files):**
- `reference/cli.mdx` — update command reference (1 hit)
- `contributing/development-setup.mdx` — update build instructions for TS (1 hit)

---

### Task 1.4: Export engine (CLI)

**Code:**
- Vendor `tsagentspec` into packages/cli (local dep or copy).
- Create `packages/cli/src/export/agent-spec-transform.ts` — AgentFlow graph → tsagentspec objects → JSON.
- Create `packages/cli/src/export/engine.ts` — reads platform configs, applies transforms.
- Create `packages/cli/src/export/transforms/` — copy.ts, rename.ts, to-mdc.ts, concatenate.ts, flatten-skill.ts, split-identity.ts, merge-mcp-config.ts, to-yaml-agent.ts, to-skill-dir.ts, to-kiro-spec.ts, to-agent-node.ts, to-branching-node.ts, to-control-flow-edge.ts, to-tool.ts.
- Create `configs/platforms/` — 13 YAML configs: claude-code, cursor, windsurf, copilot, aider, opencode, openclaw, antigravity, gemini-cli, qwen, kimi, kiro, agent-spec.
- Update `studio/app/api/export/route.ts` — use new engine.
- Delete entire `packages/core/src/transport/` directory.
- Delete `studio/lib/export-client.ts`.

**Docs (8 files):**
- `concepts/export.mdx` — complete rewrite: Agent Spec primary, config-driven
- `studio/export-dialog.mdx` — update platform list (3 hits)
- `reference/export-formats.mdx` — rewrite (1 hit)
- `reference/platform-configs.mdx` — rewrite: YAML configs
- `reference/fidelity.mdx` — update or remove
- `guides/export-to-claude.mdx` — update flow
- `guides/export-to-cursor.mdx` — update flow
- `guides/custom-platform.mdx` — rewrite: "add a YAML config"

---

## Phase 2: Studio + Library + Remaining Docs

### Task 2.1: Studio components

**Code:**
- `studio/components/Canvas.tsx` — inferred routing from edges, config-driven colors, no runbooks
- `studio/components/ElementsView.tsx` — skills category, no runbooks
- `studio/lib/constants.ts` — V3 categories
- `studio/lib/api.ts` — remove runbook refs
- `studio/lib/types.ts` — update types
- `studio/utils/buildExplorerSections.ts` — skills, no runbooks
- `studio/components/AttachResourceDialog.tsx` — skills option
- `studio/components/FrontmatterForm.tsx` — verify V3 schemas
- `studio/components/NodeDetail.tsx` — no runbook lookup
- `studio/components/ProtocolPanel.tsx` — update
- `studio/components/ValidationPanel.tsx` — update filters
- `studio/components/CanvasContextMenu.tsx` — update options
- `studio/components/MarkdownPreview.tsx` — skill ref badges
- `studio/components/canvas/ResourceNode.tsx` — skill rendering
- `studio/components/canvas/WorkflowNode.tsx` — update
- `studio/components/canvas/PathTraceBar.tsx` — update
- `studio/components/canvas/ArchitecturePanel.tsx` — update
- `studio/components/copilot/CopilotActions.tsx` — remove runbook tools
- `studio/components/copilot/CopilotReadables.tsx` — update graph readable
- `studio/extensions/SlashCommandExtension.ts` — remove runbook commands
- Create `studio/lib/canvas-config.ts` — centralized canvas config

**Docs (8 files):**
- `studio/canvas.mdx` — router inference
- `studio/elements.mdx` — V3 categories (6 hits)
- `studio/explorer.mdx` — V3 tree (4 hits)
- `studio/editor.mdx` — (1 hit)
- `studio/tokens.mdx` — (1 hit)
- `studio/command-palette.mdx` — (1 hit)
- `studio/copilot.mdx` — update tools
- `studio/validation.mdx` — update filters

---

### Task 2.2: Library templates

**Code:**
- `library/registry.json` — no runbooks, add skills
- `studio/public/library/registry.json` — same
- All `library/workflows/*/` — replace runbook refs with inline conditions or instruction refs
- All `studio/public/library/workflows/*/` — same
- `library/instructions/agentflow-authoring.md` — update
- `studio/public/library/instructions/agentflow-authoring.md` — same

**Docs (5 files):**
- `guides/first-workflow.mdx` — no runbooks (4 hits)
- `guides/building-review-loops.mdx` — rewrite conditions (12 hits)
- `authoring/cheatsheet.mdx` — swap runbook→skill examples (11 hits)
- `authoring/library.mdx` — update (7 hits)
- `authoring/writing-workflows.mdx` — update (8 hits)

---

### Task 2.3: Remaining docs + cleanup

**Code:** `grep -r "runbook"` and fix every remaining hit across:
- `packages/core/src/services/*`
- `packages/cli/src/transport/*`
- `.kiro/specs/*`
- `docs/*.md` (non-MDX docs)
- Any stragglers

**Docs (remaining ~15 files with 1-3 hits each):**
- `guides/debugging-workflows.mdx` (12 hits)
- `concepts/workflows.mdx` (4 hits)
- `concepts/agents-md-standard.mdx` (3 hits)
- `concepts/context-engineering.mdx` (2 hits)
- `contributing/architecture.mdx` (3 hits)
- `guides/adding-memory.mdx` (3 hits)
- `troubleshooting/common-errors.mdx` (5 hits)
- `troubleshooting/faq.mdx` (2 hits)
- `getting-started/studio-tour.mdx` (2 hits)
- `guides/multi-workflow-workspaces.mdx` (1 hit)
- `guides/your-first-agent.mdx` (1 hit)
- `contributing/development-setup.mdx` (1 hit)
- `contributing/library.mdx` (1 hit)

**Deliverable:** `grep -r "runbook"` returns zero.

---

### Task 2.4: Tests

**Rewrite:**
- `tests/unit/taxonomy.test.js` → `.ts`
- `tests/unit/parser-root.test.js` → `.ts`
- `tests/unit/parser-classify.test.js` → `.ts`
- `tests/unit/frontmatter-schemas.test.js` → `.ts`
- `tests/unit/narrative.test.js` → `.ts`
- `tests/integration/taxonomy-consolidation.test.js` → `.ts`
- `tests/unit/mcp-tool-provider.test.js` — fix 7 failures

**New tests:**
- `tests/unit/skill-parsing.test.ts`
- `tests/unit/router-inference.test.ts`
- `tests/unit/agents-md-resolution.test.ts`
- `tests/unit/export-agent-spec.test.ts`
- `tests/unit/export-engine.test.ts`
- `tests/unit/scope-resolution.test.ts`

---

## Execution Plan

```
Phase 0 (sequential — must be first):
  Task 0.1: ESLint + Prettier + TS base

Phase 1 (parallel after Phase 0):
  Task 1.1: Taxonomy + schemas ──┐
  Task 1.2: Parser + validator ──┤── these can parallelize
  Task 1.3: CLI rewrite ─────────┤   (1.3 depends on 1.1+1.2 completing)
  Task 1.4: Export engine ────────┘   (1.4 depends on 1.1+1.2 completing)

Phase 2 (parallel after Phase 1):
  Task 2.1: Studio components ───┐
  Task 2.2: Library templates ───┤── all parallel
  Task 2.3: Remaining cleanup ───┤
  Task 2.4: Tests ───────────────┘
```

Total: 9 tasks. ~60 code files. 47 doc files. JS→TS migration. Zero runbooks at the end.
