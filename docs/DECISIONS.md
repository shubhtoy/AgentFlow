# Decisions

Durable architectural/product decisions worth remembering across sessions, so they don't get
re-derived or re-litigated. One entry per decision; edit in place if a later correction
sharpens or supersedes one — don't append near-duplicates. See "Learning from corrections" in
`docs/CODING-STANDARDS.md` for the procedure.

## Doc layer purposes (2026-07-06)

Three-layer docs, each with a distinct job — don't collapse them into each other:
- **Root `AGENTS.md`** = entry point + standing rules + pointers. Read first, stays short.
- **`docs/FEATURE-MAP.md`** = human-oriented inventory of *every feature that exists*, one line
  each, so the whole codebase is visible without reading every file. NOT a restatement of any
  directory's file/function tables.
- **Per-directory `AGENTS.md`** = implementation detail (files, functions, directory-specific
  rules) for that one area. This is where "how is X built" lives, not the feature map.

## Export architecture (from planning sessions)

Author graph → export "compiles" to a portable path-linked walkable directory + a per-host L0
bootstrap (placed where the host auto-loads it) + native selectors + MCP config. Only L0 is
always-on; L1-L4 (including memory) load on demand via the directory walk. Full detail:
`docs/planning/MASTER-PLAN.md`.
