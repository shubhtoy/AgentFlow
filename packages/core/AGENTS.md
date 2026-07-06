# packages/core — Parser, Resolver, Validator

Browser-safe TypeScript, **zero Node.js APIs**. Consumed by both `packages/cli` (Node) and
`studio` (browser) — this is the one place shared logic must live. See root `AGENTS.md` for
repo-wide rules; `docs/FEATURE-MAP.md` for what's already built here.

## Files

| File | What |
|---|---|
| `src/parser-core.ts` | Ref extraction (`{{...}}` DSL), graph building (`parseFromFiles`), ref resolution (`resolveRef`), identity assembly (`assembleIdentity`) |
| `src/ref-paths.ts` | Resolves `{{...}}` refs to plain relative file paths for export (`resolveRefsToPaths`) |
| `src/validator/` | `index.ts` composes `schema.ts` + `structure.ts` + `variables.ts` into `validate()` |
| `src/taxonomy.ts` | Canonical directory ↔ category ↔ resource-type mappings — single source of truth |
| `src/host-targets.ts` | `HOST_TARGET_REGISTRY` — per-host L0 bootstrap path/format + MCP config path/schema + always-on-channel predicate (Kiro/Cursor/Claude Code). `isAlwaysOn` semantics are ported from `rulesync`'s real per-host generators (not guessed) — Kiro: absent frontmatter = eager; Cursor: explicit `alwaysApply` boolean; Claude Code: positional (root file vs. modular). See docs/DECISIONS.md for source attribution. Add a host by adding one entry here, not by branching elsewhere. |
| `src/export/placement-guardrail.ts` | `checkAllPlacements` / `checkPlacement` — the 5-layer placement guardrail (#13). Given a set of pending files tagged by layer (L0-L4) + frontmatter and a target host, throws `PlacementViolationError` for any L1-L4 file that would load via that host's always-on channel. L0 is exempt by definition; empty files (e.g. `output/.gitkeep` scaffolds) are exempt since they load no content. Consumed by `packages/cli/src/export/walkable-export.ts`. |
| `src/schemas/` | Frontmatter validation schemas per resource type |
| `src/services/` | `event-hook-engine.ts`, `validation-service.ts` — thin wrappers for consumers |

## Rules specific to this directory

- **No `fs`, no `path` module, no Node globals.** If you need file I/O, that belongs in
  `packages/cli`, which imports from here.
- Anything two or more of {core, cli, studio} need must live here, not be copy-pasted.
- Ref/graph model changes ripple everywhere — update `docs/FEATURE-MAP.md` and check
  `packages/cli/src/parser.ts`'s re-export block still matches.
