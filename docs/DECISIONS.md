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

## Host-target config: copy the facts from rulesync, don't depend on it (2026-07-06, #18)

Evaluated `rulesync` (dyoshikawa/rulesync, MIT, npm) as a build-vs-adopt-vs-copy decision for
per-host L0 bootstrap + MCP config knowledge, ahead of #13/#14/#21. Live-tested (network
blocked to confirm no phone-home; ran `init`/`generate` for kiro/cursor/claudecode).

**Findings:**
- Healthy: MIT, published same-day, 178K weekly downloads, real `@modelcontextprotocol/sdk`
  dependency. Not a toy.
- Correct output for our 3 target hosts: `AGENTS.md`+`.kiro/settings/mcp.json` (Kiro),
  `.cursor/rules/*.mdc`+`.cursor/mcp.json` (Cursor), `CLAUDE.md`+`.mcp.json` (Claude Code).
  All three use the same `{ mcpServers: {...} }` JSON shape — no schema translation needed
  between them today.
- Pure local CLI, no infra/service dependency — confirmed by running with network blocked.
- **Rejected as a dependency anyway**: it's a CLI you'd shell out to, not a library import —
  extra subprocess-failure surface on the critical-path export. And its actual per-host
  knowledge needed here is tiny (2 file paths per host) — importing a multi-feature CLI
  (also generates commands/subagents/skills/hooks, which we don't need) for that is
  disproportionate. Also single-maintainer risk on a critical path.
- **Scope correction**: L2-L4 (node contracts, references, artifacts, memory) are plain
  on-demand directory-walk — every host can open a file, zero per-host knowledge needed.
  Only L0 (always-on bootstrap path/format) and L1/MCP config (path/schema) genuinely vary
  per host. Earlier framing that pulled commands/skills/hooks into this scope was wrong.

**Decision:** copy the *verified facts*, not the package. `packages/core/src/host-targets.ts`
is a small, dependency-free `HOST_TARGET_REGISTRY` (Kiro/Cursor/Claude Code today) holding
exactly: L0 path+format, MCP config path+schema, and the always-on-channel predicate used by
#13's guardrail. Adding a host = one registry entry, not new branch logic. Re-evaluate rulesync
only if per-host knowledge grows enough (e.g. real commands/subagents scope) to outweigh the
subprocess-coupling cost.

Also worth knowing for later: rulesync's own docs note `kiro` is a **deprecated alias** —
Kiro IDE and Kiro CLI have diverging subagent (`.md` vs `.json`) and hook formats, though L0/
MCP-config paths are identical between them. Not relevant to our current L0+MCP-only scope,
but will matter if/when we touch subagents or hooks per-host.

## Ported real always-on semantics from rulesync source, not guessed (2026-07-06, #59)

Follow-up to the #18 decision above. The first `HOST_TARGET_REGISTRY` cut (PR #58) guessed at
each host's always-on-detection as a simple boolean-frontmatter check. Cloned
`dyoshikawa/rulesync` at commit `08834fd107c270167b4970a033f2ec303b24d9b8` (MIT) and read its
actual per-host rule generators (`src/features/rules/*.ts`) to port the real semantics instead:

- **Kiro** (`kiro-rule.ts`, `deriveKiroInclusion`): eagerness is the ABSENCE of an `inclusion`
  frontmatter block, not an explicit flag — a steering file with no frontmatter at all is
  Kiro's `always` default. `inclusion: fileMatch`/`manual` are the on-demand modes. Got this
  wrong in #58 (treated it as a boolean check).
- **Cursor** (`cursor-rule.ts`): eagerness IS an explicit boolean, `alwaysApply: true`.
  Absence/false is on-demand. #58 had this one right.
- **Claude Code** (`claudecode-rule.ts`): eagerness is POSITIONAL — the root rule (project-root
  `CLAUDE.md` or an alternate root) is always-loaded; every non-root `.claude/rules/*.md` file
  is on-demand regardless of its content. There's no frontmatter key that means "always-on" at
  all for this host. #58's `isAlwaysOn` didn't model this distinction (always returned false,
  which is only correct for non-root files).

`packages/core/src/host-targets.ts`'s `isAlwaysOn` signature was extended to
`(frontmatter, isRootFile?)` to model Claude Code's positional case correctly.

**31 hosts total** exist in rulesync's `src/constants/*-paths.ts` (see #59 for the full list).
Only Kiro/Cursor/Claude Code are ported — matches the 3 hosts actually on the critical path
(#15/#16/#17). Adding a host later: read that host's `<id>-paths.ts` +
`src/features/rules/<id>-rule.ts` + `src/features/mcp/<id>-mcp.ts` in rulesync, add one
registry entry, cite what was ported (same pattern as this entry). Note also (from rulesync's
own deprecation docs): `kiro` is a deprecated alias — Kiro IDE and Kiro CLI diverge on
subagent (`.md` vs `.json`) and hook formats, though L0/MCP-config paths are identical between
them. Irrelevant to our current L0+MCP-only scope; will matter if/when subagents or hooks
become per-host.

## Confirmed: no zero-custom-code library exists for host-target facts (2026-07-06)

Follow-up to the #18/#59/#60 decisions above. Directly asked and researched (via two parallel
subagents, not solo speculation): can `HOST_TARGET_REGISTRY` (`packages/core/src/host-targets.ts`)
be sourced from an external library at runtime instead of hand-porting facts per host? **No —
confirmed, not assumed.**

**Rulesync DOES have a real, documented library API** — verified by downloading the actual
published package and reading its compiled `dist/index.d.ts`:
```ts
import { generate, importFromTool, convertFromTool } from "rulesync"
```
This is real and works (confirmed against their own docs site's "Programmatic API" page). BUT
it only exposes 3 high-level pipeline functions. **The individual facts we need (e.g. "Kiro's
MCP file is named `mcp.json`, lives at `.kiro/settings/`") are NOT exported anywhere in the
public API**, root or subpath — `rulesync`'s `package.json` `exports` map has exactly one key
(`"."`), so `import { KIRO_MCP_FILE_NAME } from 'rulesync/constants'` is not just undocumented,
it is blocked by Node's own module resolution (`ERR_PACKAGE_PATH_NOT_EXPORTED`). Reaching those
constants would require an unsupported deep import into `rulesync/dist/...` internals — fragile
across any patch release, not a real dependency contract.

**Checked and rejected as alternatives** (same research pass): `ruler`/`@intellectronica/ruler`
(has a `main`/`types` entry, actively maintained, 44K weekly downloads — but no documented
stable API for the specific per-host facts either, same problem as rulesync); Google's OKF
tooling (explicitly "no SDK, no runtime" by design — wrong problem domain entirely, it's a
knowledge-bundle format, not a host-config registry); `cursor-windsurf-convert` (real API but
covers only Cursor↔Windsurf, 13 weekly downloads, not viable); vendor SDKs from Anthropic/Cursor
(agent-execution runtimes for their own single tool, not cross-tool config registries).

**Decision: keep the current hand-ported `host-targets.ts` (Option A).** The only real
alternative (Option B, not pursued) would be calling rulesync's real `generate()` at runtime,
letting it write real files to disk, and inspecting the paths it actually wrote — that removes
hand-porting but adds a genuine runtime dependency + filesystem side-effect coupling to the
critical-path export, which is a worse trade for 3 hosts than the manual cost of porting facts
by hand. **Revisit Option B only if/when adding host #4 or #5 makes the manual-porting cost
start actually hurting** — not before. Do not re-research "can we get this from a library" again
without new information beyond what's documented here (mirrors the pattern already established
for the project-board-scraping question earlier in this file — don't re-litigate a settled,
actually-researched question).
