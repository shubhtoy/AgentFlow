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

## Commits & PRs

- Never commit without being explicitly asked. Stage specific files, not `git add .`.
- One logical change per commit (e.g. "core engine change" separate from "lint config fix").
- Never commit generated/build artifacts (`.next/`, `.source/`, `dist/`, `tsconfig.tsbuildinfo`).
