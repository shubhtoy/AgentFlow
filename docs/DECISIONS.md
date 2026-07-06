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
