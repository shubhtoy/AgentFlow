# AgentFlow — Coding Standards

Binding for all code in this repo (human or agent-authored). `npm run lint` and `npx tsc --build`
must be clean before a change is considered done — see "Definition of Done" in root `AGENTS.md`.

## Language & lint

- **TypeScript throughout**, `strict: true` (see `tsconfig.base.json`). No `any` without a
  comment explaining why a real type isn't available.
- **Lint config is TypeScript-native** (`eslint.config.mjs`): `@typescript-eslint`'s own
  recommended rules + Prettier, not `airbnb-base`. Airbnb's base config is a plain-JS style
  guide (its `no-restricted-syntax`/`no-continue` exist to dodge `regenerator-runtime` for
  `for...of` on old browsers) — irrelevant on a modern TS target and was fighting the
  codebase's own idioms. Do not reintroduce it or cherry-pick its rules back in without the
  same "does this actually apply to TS on ES2020+" check.
- **`for...of` and `continue` are fine.** Prefer them over manual index loops or deeply nested
  conditionals when iterating.
- Formatting is Prettier's job, not manual — run `npm run format` / let `lint --fix` handle it.
  Don't hand-format around a linter you disagree with; fix the rule instead (see below).

## When a lint rule doesn't fit a specific file

Don't work around a rule silently (e.g. rewriting working code to dodge it, or leaving it
red and "matching style"). Two options, in order of preference:

1. **The rule is wrong for this codebase** → change `eslint.config.mjs` globally, with a comment
   explaining why (see the `no-restricted-syntax`/`no-underscore-dangle`/etc. entries there for
   the pattern).
2. **The rule is right in general but one file has a deliberate, justified exception** (e.g.
   `git-manager.ts`'s mutable `exports` seam for test mocking) → add a narrowly-scoped
   `files: [...]` override in `eslint.config.mjs` with a comment explaining the specific
   justification. Never widen an override beyond the file(s) that actually need it.

Never leave a rule red "because the rest of the codebase is red too" — that's how 1160+ lint
errors accumulate silently. If lint is red, either fix the code or fix the config; there is no
third option.

## DRY (core/cli/studio)

- `packages/core` is the single source of truth for parsing/resolution/validation. If two of
  {core, cli, studio} need the same logic, it lives once in `core` and both import it.
- Before writing new fs/parse glue code in `packages/cli`, check `packages/cli/src/parser.ts`
  doesn't already export it. A private, unexported duplicate of shared logic in a service file
  is a bug, not a style choice (this happened once with `parseMarkdownFile` — fixed, see
  `docs/FEATURE-MAP.md`).

## Tests

- New behavior needs tests, scoped to what changed. Don't attempt to fix unrelated pre-existing
  failures in the same pass (track them instead — see Epic 7 on the project board).
- Prefer a small number of tests that cover the real acceptance criteria over exhaustive
  permutation coverage. Calibrate effort to the risk of the change, not to 100% branch coverage.

## Dashboard

`npm run dashboard` (`scripts/generate-dashboard.js`) writes `studio/public/dashboard.html` —
quick-glance test/lint/typecheck health, board epic status, code size, and durable-doc sizes.
Not a PM tool, just an overview. Deployed to GitHub Pages (`.github/workflows/dashboard.yml`)
on every push to `main` &mdash; live at https://shubhtoy.github.io/AgentFlow/.

**Hybrid live/static, chosen per section based on what's actually possible** (the repo is
public, so this matters): commits, open issues, CI runs, and the project board's epic table
are all fetched **live, client-side** on page load. Commits/issues/CI call `api.github.com`
directly (public REST, sends CORS headers, no auth needed). The board's item-level data
(GitHub Projects v2 API requires auth even for a public repo, and the unauthenticated
board-page fallback has no CORS header) is fetched through a small self-hosted Cloudflare
Worker — [`github-project-info-mcp`](https://github.com/shubhtoy/github-project-info-mcp), a
separate standalone project — which adds the missing CORS header. The board table renders in
two passes: first the bulk item list (status, sub-issues progress — whatever's in the board's
default view), then Priority/Story Points per epic via one parallel per-item request each
(that data isn't in the bulk endpoint at all, only the per-item one — see that project's
README for why). A server-baked snapshot of the board (via `gh`/scrape, generated at build
time) is still rendered into the initial HTML as a progressive-enhancement fallback for no-JS
or if the Worker is ever down; the live fetch replaces it once it loads. Tests/lint/typecheck/
code-size stay server-baked — there's no API that returns a live test result; something has to
actually run the suite once. `npm run
docs:check` and `npm run dashboard` both also run in `.husky/pre-push`; the dashboard step
warns (doesn't auto-commit — see git-safety) if the local snapshot changed and needs staging.

## Commits & PRs

- Never commit without being explicitly asked. Stage specific files, not `git add .`.
- One logical change per commit (e.g. "core engine change" separate from "lint config fix").
- Never commit generated/build artifacts (`.next/`, `.source/`, `dist/`, `tsconfig.tsbuildinfo`)
  — `studio/public/dashboard.html` is the one intentional exception (see Dashboard above).
- **Commit messages are one-line, semantic-commit style** (`type: short summary`, e.g.
  `fix: correct pnpm-style workspace refs breaking npm ci`) — not multi-paragraph explanations.
  Put rationale/detail in the PR description or a linked issue, not the commit subject.

## Branch & PR workflow (branch protection is ON)

`main` is protected: **no direct pushes** (enforced for admins too), no force-pushes, no branch
deletion, conversation resolution required before merge. Everything lands via PR.

- **Branch naming**: `type/short-slug` matching the commit type — `feat/*`, `fix/*`, `docs/*`,
  `chore/*`, `ci/*`, `refactor/*`. One branch per logical change / issue.
- **Flow**: branch off `main` → commit (semantic one-liners) → push → `gh pr create` → merge
  (squash) → delete branch.
- **Auto-close issues, don't close them by hand**: put `Closes #NN` (or `Fixes #NN`) — one per
  issue — in the PR body. GitHub closes them automatically on merge. Never `gh issue close`
  manually for work a PR completes; a bare `#NN` mention does *not* auto-close, so use the keyword.
- **PR description format is mandatory — four sections, in this order:**
  - **What** — what changed, concretely (files/behaviour).
  - **Why** — the problem or issue this solves (link the issue).
  - **How** — the approach / key decisions, so a reviewer understands the shape without reading
    every line.
  - **Testing** — what was run and the result (test counts, lint, manual verification). "Not
    tested" is a valid answer only with a stated reason.
  Commit subjects stay terse; all detail lives here.
- **Mandatory docs update per PR (git rule):** every PR that adds, removes, or changes a
  capability MUST update the affected docs *in the same PR* — the relevant per-directory
  `AGENTS.md` (implementation detail for that area) and `docs/FEATURE-MAP.md` (the one-line
  inventory), plus `DECISIONS.md`/`USER-CORRECTIONS.md` when a durable decision/correction
  applies. A code change that leaves its `AGENTS.md`/FEATURE-MAP stale is incomplete — this is
  how drift (Epic #39) started. Reviewer/self-check: "did the docs move with the code?"
- **Required approvals: 0** (solo repo) — the PR *flow* is the gate, not review sign-off. Merge
  your own PRs once conversations are resolved.
- **CI status check (`check`)** is not yet a required merge gate because it is red from
  pre-existing typecheck debt (tracked under Epic 7, issue #50). Once CI is green, add `check`
  as a required status check so every PR must pass lint + typecheck + tests to merge.

## Learning from corrections (keep docs improving without bloat)

When a human correction reveals something these docs got wrong or missed, don't just fix the
code and move on — decide whether it's worth capturing so the next session doesn't repeat it.
This follows the standard "feedback loop, not perfect prompts" pattern (Warp's internal agent
work is the clearest public writeup): **principles beat rules**. A pile of one-off exceptions
("never do X in file Y because it broke on Tuesday") is how docs balloon into noise nobody
reads. A short, transferable principle is worth keeping; a one-off fact usually isn't.

Procedure, each time a correction lands:
1. **Would this recur?** If it's genuinely one-off (a typo, a fact about this one call), just
   fix it and stop — don't write anything down.
2. **Zoom out** — what's the general pattern behind the correction, not just this instance?
3. **Check for overlap first.** Read `docs/DECISIONS.md` and `docs/USER-CORRECTIONS.md` before
   adding anything. If a new correction sharpens, contradicts, or is a special case of something
   already there, **edit that entry in place** — merge or replace it, don't append a
   near-duplicate.
4. **Write a principle, not a transcript.** Not "user said X in turn 47" — the durable rule
   behind it, one or two lines. If it belongs in a specific directory's own `AGENTS.md` or in
   `docs/CODING-STANDARDS.md` instead (i.e. it's really a coding/architecture standard, not a
   one-off workflow preference), put it there instead and don't duplicate it into these files.
5. **Where it goes:**
   - `docs/DECISIONS.md` — durable architectural/product decisions ("we chose X over Y because
     Z") that would otherwise get re-litigated or re-derived next session.
   - `docs/USER-CORRECTIONS.md` — durable behavioral corrections about how to work in this repo
     specifically (communication style, process preferences) — not project facts.
   - Anything that's actually a coding standard belongs in `docs/CODING-STANDARDS.md`; anything
     that's a directory-specific implementation fact belongs in that directory's `AGENTS.md`.
   - **Plain markdown under `docs/`, never a host-specific folder** (e.g. `.kiro/`, `.cursor/`,
     `.claude/`). This project's own thesis is host-agnostic export — durable memory belongs
     somewhere every host and human can read, not locked into one vendor's config directory.
6. **Never silently rewrite in bulk.** Add/edit one entry at a time, in the same commit as the
   work that prompted it, so it's reviewable in the diff — same reasoning as never auto-merging
   agent-authored rule changes without a human seeing the diff first.
7. **Prune, don't just accumulate.** If a steering file is growing long, that's a signal to
   consolidate overlapping entries into a sharper principle, not to keep appending. A short file
   of real principles beats a long file of accumulated exceptions. `npm run docs:check`
   (`scripts/docs-prune-check.js`) runs automatically on `git push` (`.husky/pre-push`) — it's
   read-only and only ever nudges (never blocks the push on its own), flags files/entries worth
   consolidating (too long, too many entries, likely near-duplicate headings, stale dates), and
   never edits anything itself. `npm test` also runs on every push and **does** block — the
   suite must stay green; use `it.skip`/`describe.skip` with a tracking-issue comment (never a
   silent skip) for anything that needs a design decision rather than a quick fix.
