# AgentFlow — Feature Map

What exists in this codebase, one line per feature, so you (or an agent) can see the whole
picture without reading every file. For implementation detail on any area, go to that
directory's own `AGENTS.md` — this file intentionally doesn't restate file/function tables
already covered there.

## Core engine — `packages/core/` (browser-safe, zero Node deps) → `packages/core/AGENTS.md`

- **`{{...}}` ref DSL parsing** — extracts mention/edge/conditional-edge/data-flow tokens from markdown.
- **Graph building** — turns a flat file map into a typed graph: nodes, edges, workflows, entry points, router inference.
- **Ref resolution** — resolves a ref to its target file or node (by path, then by frontmatter name).
- **Identity assembly (L0/L1)** — loads AGENTS.md descriptor content + its resolved references, workspace-wide and per-workflow.
- **Ref → relative-path resolution** — rewrites `{{...}}` tokens to plain relative file paths for export, so exported workflows are host-agnostic.
- **Graph validator** — schema checks, broken refs, entry-point rules, cycle detection (as warnings — revision loops are legitimate), unreachable nodes, sub-workflow loop detection, MCP tool reference checks.
- **Taxonomy** — canonical directory ↔ category ↔ resource-type mapping used everywhere else.
- **Frontmatter schemas** — per-resource-type YAML validation.

## CLI / export engine — `packages/cli/` (Node) → `packages/cli/AGENTS.md`

- **fs-walking parser** — reads a real `.agentflow/` directory tree and builds the graph via core.
- **Multi-platform export** — declarative, per-platform transform rules (`configs/platforms.json`) mapping a graph to output files. Kiro is the only host validated end-to-end so far.
- **Agent Spec export** — Oracle Agent Spec serialization (~31-35% compliant; only relevant for the runtime-framework bridge, not IDE deployment).
- **Repo scanner** — discovers `.agentflow/` workspaces/resources across an arbitrary repo tree.
- **Git integration** — clone, sync, remote config for git-backed workflow sources.
- **MCP bridge** — tool discovery, scaffolding, and per-host MCP server config generation.
- **Services layer** — workflow/instruction/import/git/hook operations consumed by the studio's API routes.

## Studio — `studio/` (Next.js + ReactFlow) → `studio/AGENTS.md`

- Visual graph canvas — drag/connect nodes and edges.
- Markdown node editor (Tiptap) with live preview.
- Validation panel — surfaces `validate()` results in the UI.
- Export dialog — drives `exportForPlatform` from the browser.
- MCP panel — configure MCP servers per workspace.
- AI copilot/chat — in-editor assistant.
- Skills discovery — search/install from the library.

## Library — `library/`

- Reusable workflow/skill/instruction/hook templates, installable into a workspace via `registry.json`.

## Cross-package notes

- Identity assembly (core) isn't wired into export bootstrap generation yet — that's Epic 2.
- Agent Spec export exists but is off the critical path (see `docs/planning/MASTER-PLAN.md`).

## Known gaps / not yet built (see GitHub Project #4 for tracked epics)

- Capability/tool binding on export (Epic 4, #20-23) — the one unproven mechanic.
- Native per-host selective-context selectors beyond directory-walk (Epic 2, #14).
- Claude Code / Cursor export targets (Epic 3, #16-17) — Kiro only so far.
- MCP execution controller (Epic 5) and packaging/versioning (Epic 6) — later scope.
- `library/registry.json` is missing the `agent-builder` workflow (Epic 7, #32).

## Tooling

- Coding standards: `docs/CODING-STANDARDS.md`.
- `npm run lint` is 0 errors/0 warnings project-wide — keep it that way.
- `npm run dashboard` — static living-status snapshot at `studio/public/dashboard.html`,
  deployed to GitHub Pages (https://shubhtoy.github.io/AgentFlowTest/) on every push to `main`.
- `npm ci` requires plain npm workspace syntax (`"*"`, not `"workspace:*"` — that's pnpm/yarn).
