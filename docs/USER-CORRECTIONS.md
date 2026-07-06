# User Corrections

Durable behavioral corrections about how to work in this repo/with this user — not project
facts (those go in `DECISIONS.md`) or coding standards (those go in `CODING-STANDARDS.md`).
One entry per principle; edit in place if a later correction sharpens or supersedes one. See
"Learning from corrections" in `docs/CODING-STANDARDS.md`.

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

## Don't lock durable project memory into one host's proprietary folder (2026-07-06)

`.kiro/steering/` is Kiro-specific. This repo's own product thesis is host-agnostic export —
putting cross-session memory somewhere only one host reads contradicts that. Durable docs
(decisions, corrections, standards, feature map) belong under `docs/`, in plain markdown any
host or human can read. Host-specific config (if ever needed) is the only thing that belongs
in a dotfolder like `.kiro/`.

## Read all three living docs before implementing, not just FEATURE-MAP/AGENTS.md (2026-07-06)

Before starting an implementation task, read `docs/DECISIONS.md` and `docs/USER-CORRECTIONS.md`
in addition to `docs/FEATURE-MAP.md` and the relevant `AGENTS.md` files — root `AGENTS.md`
points at `CODING-STANDARDS.md` by name for exactly this reason ("read it before writing new
code, not after lint turns up red"), and that file's own "Learning from corrections" section
says to check `DECISIONS.md`/`USER-CORRECTIONS.md` before adding anything. Skipping straight to
the feature map and planning docs missed this once (Epic 2 #11/#12 implementation) even though
the pointer was sitting in the first file read. The three docs are meant to be read together,
every time, not opportunistically.

The other half of this: when a real bug or gap is found mid-implementation (not just "add a
feature," but "discovered X is broken"), file it as a tracked issue *and* capture it here or in
`DECISIONS.md` if it's a durable fact worth not re-discovering — a GitHub issue alone doesn't
get re-surfaced next session the way these docs do.
