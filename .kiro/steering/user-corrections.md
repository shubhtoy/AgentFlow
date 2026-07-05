# User Corrections

Durable behavioral corrections about how to work in this repo/with this user — not project
facts (those go in `decisions.md`) or coding standards (those go in
`docs/CODING-STANDARDS.md`). One entry per principle; edit in place if a later correction
sharpens or supersedes one. See "Learning from corrections" in `docs/CODING-STANDARDS.md`.

## Verify tooling/environment claims against hard evidence, don't infer from convention (2026-07-06)

When something looks like it might be using a different toolchain than assumed (e.g. a
`workspace:*` dependency string suggesting pnpm/yarn), check for the actual signal — lockfile
present, `packageManager` field, CI workflow commands — before concluding, and before "fixing"
anything. In this repo that check surfaced a real bug (pnpm-only syntax breaking `npm ci`), not
just a style mismatch.

## Don't silently work around a rule/config you disagree with — fix it or scope a justified exception

Applies beyond lint (where it's captured as a coding standard): if something in the repo's
setup is fighting you, the fix belongs in that setup, with a comment explaining why. Matching
your code to a rule you believe is wrong just relocates the problem.
