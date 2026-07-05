# AgentFlow — Feature Map

Per-directory `AGENTS.md` files (`packages/core/AGENTS.md`, `packages/cli/AGENTS.md`,
`studio/AGENTS.md`) are the source of truth for what lives where — read those first, not this
file. This file exists only for what a per-directory doc can't show: cross-package pointers and
tracked gaps.

## Cross-package pointers

- **Ref → path resolution for export** lives in `packages/core/src/ref-paths.ts`, re-exported
  through `packages/cli/src/parser.ts` — check there before adding export-side path logic
  anywhere else.
- **Identity assembly (L0/L1)** (`assembleIdentity` in `packages/core/src/parser-core.ts`) is
  consumed by the export engine's bootstrap generation (Epic 2) — not yet wired there.
- **Agent Spec export** (`packages/cli/src/export/agent-spec-transform.ts`, ~31-35% compliant)
  is only needed for the runtime-framework bridge (LangGraph/WayFlow), not the IDE/directory-walk
  export path — see `docs/planning/MASTER-PLAN.md`.

## Known gaps / not yet built (see GitHub Project #4 for tracked epics)

- Capability/tool binding on export (Epic 4, #20-23) — the one unproven mechanic.
- Native per-host selective-context selectors beyond directory-walk (Epic 2, #14).
- Claude Code / Cursor export targets (Epic 3, #16-17) — Kiro only so far.
- MCP execution controller (Epic 5) and packaging/versioning (Epic 6) — later scope.
- `library/registry.json` is missing the `agent-builder` workflow (Epic 7, #32).

## Tooling

- Coding standards: `docs/CODING-STANDARDS.md`.
- `npm run lint` is 0 errors/0 warnings project-wide — keep it that way.
