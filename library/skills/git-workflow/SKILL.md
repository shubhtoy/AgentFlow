---
name: git-workflow
description: Git branching strategies, conventional commit messages, PR best practices, code review etiquette, merge strategies, and release tagging for team-based development.
---

# Git Workflow

## Branching Strategy

### Trunk-Based Development (Recommended)

All developers commit to `main` (or `mainline`) through short-lived feature branches.

```
main ─────●────●────●────●────●────●─────
           \       /      \       /
            ●──●──●        ●──●──●
            feature-a      feature-b
```

Rules:
- Feature branches live less than 2 days
- Every merge to main must pass CI
- Use feature flags for incomplete work, not long-lived branches
- Release from main (tag the commit)

### Git Flow (When Required)

For projects with formal release cycles:

```
main     ─────●──────────────────●─────
              ↑                  ↑
release  ────●──●               ●──●
             ↑                  ↑
develop  ●──●──●──●──●──●──●──●──●──●
          \   /    \       /
           ●─●      ●──●──●
           feat-a   feat-b
```

Use only when you need to maintain multiple release versions simultaneously.

### Branch Naming

```
feature/short-description     # New functionality
fix/issue-number-description  # Bug fixes
chore/description             # Maintenance, tooling
docs/description              # Documentation changes
refactor/description          # Code restructuring
```

Rules:
- Use lowercase with hyphens
- Include the ticket/issue number when applicable: `fix/PROJ-123-null-pointer`
- Keep names short but descriptive
- Delete branches after merging

## Commit Messages

Follow the Conventional Commits specification.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | When to Use |
|------|-------------|
| `feat` | New feature visible to users |
| `fix` | Bug fix |
| `docs` | Documentation changes only |
| `style` | Formatting, whitespace — no logic change |
| `refactor` | Code restructuring — no behavior change |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `chore` | Build, CI, tooling, dependencies |
| `ci` | CI/CD configuration changes |
| `revert` | Reverting a previous commit |

### Subject Line Rules

- Use imperative mood: "Add feature" not "Added feature" or "Adds feature"
- Do not end with a period
- Limit to 50 characters
- Capitalize the first word
- Complete the sentence: "If applied, this commit will ___"

### Body Rules

- Separate from subject with a blank line
- Wrap at 72 characters
- Explain WHAT changed and WHY — the diff shows HOW
- Use bullet points for multiple changes

### Breaking Changes

```
feat(api)!: Remove deprecated /v1/users endpoint

BREAKING CHANGE: The /v1/users endpoint has been removed.
Migrate to /v2/users before upgrading.
```

### Examples

```
fix(auth): Prevent session fixation on login

Regenerate session ID after successful authentication to prevent
session fixation attacks. Previously, the session ID was preserved
across the login boundary.

Closes #456
```

```
chore(deps): Update express from 4.18.2 to 4.19.0

Security patch for CVE-2024-XXXXX (request smuggling via
malformed Transfer-Encoding headers).
```

## Pull Request Best Practices

### Before Opening a PR

1. Rebase on the latest main: `git fetch && git rebase origin/main`
2. Run the full test suite locally
3. Run linters and formatters
4. Review your own diff — read every line as if reviewing someone else's code
5. Remove debug logging, commented-out code, and TODOs that should be issues

### PR Structure

- **Title:** Follow the same format as commit messages
- **Description:** Include:
  - What this PR does (one paragraph)
  - Why this change is needed
  - How to test it
  - Screenshots/recordings for UI changes
  - Link to the issue/ticket
- **Size:** Keep PRs under 400 lines of diff. Split larger changes into stacked PRs.
- **Scope:** One logical change per PR. Do not mix refactoring with feature work.

### PR Size Guidelines

| Lines Changed | Assessment |
|--------------|------------|
| 1-50 | Ideal — easy to review thoroughly |
| 50-200 | Good — reviewable in one session |
| 200-400 | Acceptable — may need focused review time |
| 400-800 | Too large — split if possible |
| 800+ | Must split — reviewers will miss issues |

### Responding to Review Feedback

- Respond to every comment
- Push fixes as new commits (don't force-push during review — it destroys comment context)
- Squash when merging, not during review
- If you disagree, explain your reasoning respectfully
- If a discussion stalls, involve a third reviewer

## Merge Strategies

### Squash and Merge (Recommended for Feature Branches)

Combines all commits into one on main. Clean history, easy to revert.

```bash
git merge --squash feature-branch
git commit -m "feat(auth): Add OAuth2 login flow"
```

Use when: feature branch has messy WIP commits.

### Merge Commit

Preserves all commits and adds a merge commit. Full history visible.

```bash
git merge --no-ff feature-branch
```

Use when: each commit in the branch is meaningful and well-crafted.

### Rebase and Merge

Replays commits on top of main. Linear history, no merge commits.

```bash
git rebase main
git checkout main
git merge feature-branch
```

Use when: commits are clean and you want linear history.

### Never Use

- `git merge` (fast-forward) for feature branches — no merge commit means no record of the branch
- `git push --force` on shared branches — rewrites history for everyone

## Release Tagging

### Semantic Versioning

```
MAJOR.MINOR.PATCH
```

- **MAJOR** — Breaking changes (incompatible API changes)
- **MINOR** — New features (backward compatible)
- **PATCH** — Bug fixes (backward compatible)

### Tagging a Release

```bash
git tag -a v1.2.0 -m "Release v1.2.0: Add OAuth2 support"
git push origin v1.2.0
```

### Pre-release Tags

```
v1.2.0-alpha.1
v1.2.0-beta.1
v1.2.0-rc.1
```

### Changelog

Maintain a CHANGELOG.md. Generate it from conventional commits:

```markdown
## [1.2.0] - 2024-03-15

### Added
- OAuth2 login flow (#123)
- Rate limiting on API endpoints (#145)

### Fixed
- Session fixation vulnerability (#456)
- Memory leak in WebSocket handler (#478)

### Changed
- Upgraded Express from 4.18 to 4.19
```

## Git Hygiene

- Commit early and often — small commits are easier to review and revert
- Never commit generated files (build output, node_modules, .env)
- Keep `.gitignore` up to date
- Use `git stash` for temporary context switches, not uncommitted files on branches
- Delete merged branches: `git branch -d feature-branch`
- Fetch before assuming your local state matches remote: `git fetch`
