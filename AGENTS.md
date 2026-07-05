# AgentFlow — Agent Entry Point

Read this file first. It is the map — do not read the whole repo before acting.
`CLAUDE.md` is a symlink to this file; keep them in sync automatically (no separate edits needed).

## What this is

Directory-based agent workflow orchestration. Author a workflow as a graph of markdown nodes
(`.agentflow/` directory) → **export** compiles it to a portable, path-linked directory + a
per-host bootstrap, so any host agent (Kiro, Claude Code, Cursor, …) walks it step by step.
Full architecture + roadmap: `docs/planning/MASTER-PLAN.md`.

## Where things live (read the directory's own AGENTS.md before editing in it)

| Area | Path | AGENTS.md |
|---|---|---|
| Parser, resolver, validator (browser-safe, zero Node deps) | `packages/core/src/` | `packages/core/AGENTS.md` |
| CLI, fs-walking parser, export engine, MCP bridge (Node) | `packages/cli/src/` | `packages/cli/AGENTS.md` |
| Visual studio (Next.js + ReactFlow) | `studio/` | `studio/AGENTS.md` |
| Reusable workflow/skill/instruction templates | `library/` | — |
| Unit / integration / property / generator tests | `tests/` | — |
| Planning docs, master plan, session handoffs | `docs/planning/` | — |

**Feature map** (what exists, exactly where): `docs/FEATURE-MAP.md`. Check it before assuming
something doesn't exist yet, and add an entry whenever you ship a new capability.

## Standing rules for this repo

- **DRY across `core`/`cli`**: `packages/core` is browser-safe and consumed by both the CLI and
  the studio (browser). Never duplicate parsing/resolution/validation logic into `cli` or
  `studio` — add it once in `core` and import it. If you find a private copy of core logic
  (e.g. a function redefined locally), replace it with the shared import instead of leaving both.
- **Definition of Done** for any change: clean reusable TypeScript, security-reviewed, tests for
  new behavior (scoped to what changed — do not attempt to fix unrelated pre-existing failures
  in the same pass), `tsc --build` and the relevant test file(s) green. Full-suite regressions
  must be checked (`npx vitest run`, compare failing-file list before/after) but pre-existing
  failures outside your change are out of scope unless the task is specifically to fix them.
- **Known pre-existing debt** (tracked as Epic 7 on the project board, not yours to fix
  incidentally): eslint's airbnb config bans `for...of`/`continue` that the whole codebase uses
  (config/code mismatch — match existing code style, don't fight the linter alone); ~13 test
  files fail for reasons unrelated to any single change (missing `.gen.js` build artifacts,
  MCP-service assertion drift, a `relativePath` contract ambiguity in `parseMarkdownFile`).
- **Git safety**: never commit without being explicitly asked. Stage specific files, not `git add .`.
- **Project board**: github.com/users/shubhtoy/projects/4 (repo: `shubhtoy/AgentFlowTest`). Epics
  are `Setup: <subsystem>` issues with sub-issues + story points. Update status as work lands.

## Build & test

```bash
npm test                 # vitest --run (full suite)
npx vitest run <file>     # single file
npx tsc --build           # typecheck (uses project references)
npm run lint               # eslint packages/*/src/**/*.ts
```
