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

## Canonical source-of-truth doc set (2026-07-06, Epic #39)

Doc drift from out-of-band development produced three taxonomy generations, three doc trees,
two competing architecture visions, and a pile of stale "done" docs (the JS→TS rewrite silently
dropped features like `{{$var}}` while docs still claimed them). Resolved by collapsing to ONE
canonical set; everything else archived or deleted. Do not reintroduce scattered docs.

**Canonical set (the only places durable knowledge lives):**
- Root `AGENTS.md` — entry + standing rules
- `docs/FEATURE-MAP.md` — the one feature inventory (there is no second feature map)
- `docs/DECISIONS.md` — durable decisions (this file)
- `docs/USER-CORRECTIONS.md` — behavioral corrections
- `docs/CODING-STANDARDS.md` — code + workflow standards
- `docs/planning/MASTER-PLAN.md` — **authoritative architecture**
- `docs/architecture-diagram.md` — the one architecture diagram
- `studio/content/docs/` (fumadocs) — the one user-facing doc tree
- The GitHub project board (#4) — what to build

**Authoritative architecture = MASTER-PLAN** (client-side walkable-directory export + per-host
L0 bootstrap). V3-ENGINE-RETHINK's export-transport sections (Agent-Spec-primary, server-side
`/api/export`, vendored `tsagentspec`) are **superseded** and were never the shipped path; its
still-live ideas (Gen-3 taxonomy, `{{$var}}` design, config-driven §14) are tracked as issues
(#46, #48). V3 itself is archived under `docs/planning/archive/`.

**Rule:** new durable knowledge goes ONLY into the canonical set — never a new scattered doc,
never a host-specific folder. `docs/planning/archive/` is history, not current. Taxonomy is
Gen-3 (5 categories: instructions/capabilities/skills/memory/hooks), enforced by
`packages/core/src/taxonomy.ts` — any doc describing other taxonomies is wrong.

## Export architecture (from planning sessions)

Author graph → export "compiles" to a portable path-linked walkable directory + a per-host L0
bootstrap (placed where the host auto-loads it) + native selectors + MCP config. Only L0 is
always-on; L1-L4 (including memory) load on demand via the directory walk. Full detail:
`docs/planning/MASTER-PLAN.md`.

## Known bug: node names collide with ARTIFACT_DIRS exclusion (2026-07-06, tracked as #38)

`packages/cli/src/parser.ts`'s `parseWorkflow` applies core's `ARTIFACT_DIRS` set (`dist`,
`build`, `output`, `.next`, `venv`, `.cache`, etc — meant to exclude compiled-output dirs during
repo-wide `.agentflow/` discovery) when scanning for *node directories inside an already-found
workflow*. A node legitimately named `build` is silently dropped from the graph — no error, it
just doesn't exist after parsing. Found while implementing Epic 2 #12; not fixed there since
it's a pre-existing parser issue, out of that issue's scope. Fix belongs in `parseWorkflow`: a
node directory containing a `.md` file is unambiguously a node regardless of name; `ARTIFACT_DIRS`
should only gate `repo-scanner.ts`'s repo-wide walk. Until fixed, avoid these names for nodes.

## Dashboard: project board stays build-time via `gh` (2026-07-06)

Investigated whether the board section could go fully client-side/live like commits, issues,
and CI. Conclusion: no, and don't revisit this without new information beyond what's below.

What's actually available unauthenticated (verified live, not from docs alone):
- `GET api.github.com/users/{user}/projectsV2/{n}` — public project *metadata only*
  (title/state/dates), no items. CORS-open (`Access-Control-Allow-Origin: *`).
- `GET api.github.com/users/{user}/projectsV2/{n}/items` — 401 even on a public project.
  Item-level data has no public REST path.
- `GET github.com/memexes/{projectNodeId}/items?memexProjectItemId={id}` — an undocumented,
  internal endpoint (found via HAR capture of the logged-in UI's own network calls) that
  returns full per-item data (status, labels, custom fields by numeric ID, sub-issue
  progress) **unauthenticated, no cookies needed** for a public project. But it has **no
  CORS header** at all, so it's blocked from browser `fetch()` regardless of auth — and it's
  a private implementation detail of GitHub's UI, not a published API, so it can change or
  break without notice. Not suitable to depend on, even server-side, beyond noting it exists.
- The board's own HTML page (`github.com/users/{u}/projects/{n}`) also embeds full item data
  in a `<script id="memex-paginated-items-data">` tag, unauthenticated for a public project —
  same CORS and stability caveats as above.
- GraphQL API: confirmed via GitHub's own docs (3 documented auth methods, zero unauthenticated
  option) and a reproduced live 403 — always needs a token, no exceptions found.

Decision: keep the board section server-baked via `gh project item-list` at build/push time
(already the case, already reliable in CI). Don't scrape the undocumented endpoints above for
production use — they work today but have zero stability contract. Revisit only if GitHub
ships a documented, CORS-enabled, unauthenticated items API.
