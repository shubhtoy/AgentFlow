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
- **L0 contract generator** (`export/l0-contract.ts`) — generates the root AGENTS.md handed to a host agent: entry-node pointer, walk order, gate behaviour. Plain-prose Markdown, no forced frontmatter, matching the real agents.md standard.
- **Graph validator** — schema checks, broken refs, entry-point rules, cycle detection (as warnings — revision loops are legitimate), unreachable nodes, sub-workflow loop detection, MCP tool reference checks.
- **Taxonomy** — canonical directory ↔ category ↔ resource-type mapping used everywhere else.
- **Frontmatter schemas** — per-resource-type YAML validation.

## CLI / export engine — `packages/cli/` (Node) → `packages/cli/AGENTS.md`

- **fs-walking parser** — reads a real `.agentflow/` directory tree and builds the graph via core.
- **Multi-platform export** — declarative, per-platform transform rules (`configs/platforms.json`) mapping a graph to output files. Kiro is the only host validated end-to-end so far.
- **Walkable-directory export** (`export/walkable-export.ts`, `agentflow export --format walkable`) — writes the L0 contract + one directory per node (`SKILL.md` + `output/` scaffold) using `resolveRefsToPaths`; the portable, path-linked directory a host agent walks step by step (Epic 2, #11/#12).
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

- Walkable-directory export (Epic 2, #11/#12) is done; native per-host selector emission (#14) and the always-on-channel guardrail (#13) are the remaining Epic 2 sub-issues.
- Agent Spec export exists but is off the critical path (see `docs/planning/MASTER-PLAN.md`).

## Known gaps / not yet built (see GitHub Project #4 for tracked epics)

- Capability/tool binding on export (Epic 4, #20-23) — the one unproven mechanic.
- 5-layer placement rules + always-on-channel guardrail (Epic 2, #13) — walkable-directory export (#11/#12) doesn't yet enforce that L1-L4 never land in an eager/always-on channel per host.
- Native per-host selective-context selectors beyond directory-walk (Epic 2, #14).
- Claude Code / Cursor export targets (Epic 3, #16-17) — Kiro only so far.
- MCP execution controller (Epic 5) and packaging/versioning (Epic 6) — later scope.
- `library/registry.json` is missing the `agent-builder` workflow (Epic 7, #32).
- **Parser bug**: a node/directory named `build`, `dist`, `output`, `.next`, `.venv`, `venv`, or `.cache` is silently excluded from workflow discovery — `packages/cli/src/parser.ts`'s `parseWorkflow` skips any top-level entry whose name is in core's `ARTIFACT_DIRS` set (meant for compiled-output dirs during repo scans), but this collides with legitimate node names an author might pick. Found while testing the walkable-directory emitter (Epic 2, #12) — not fixed here since it's a pre-existing parser limitation, not part of that issue's scope. Worth its own issue.

## Tooling

- Coding standards: `docs/CODING-STANDARDS.md`.
- `npm run lint` is 0 errors/0 warnings project-wide — keep it that way.
- `npm run dashboard` — static living-status snapshot at `studio/public/dashboard.html`,
  deployed to GitHub Pages (https://shubhtoy.github.io/AgentFlow/) on every push to `main`.
- `npm ci` requires plain npm workspace syntax (`"*"`, not `"workspace:*"` — that's pnpm/yarn).
