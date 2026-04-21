---
name: commit-push-pr
domain: development
---
# Commit, Push, and Create PR

Analyze all changes that will be included in the pull request, making sure to look at all relevant commits (NOT just the latest commit, but ALL commits that will be included in the pull request).

## Context

- `git status`
- `git diff HEAD`
- `git branch --show-current`
- `git diff main...HEAD`
- `gh pr view --json number 2>/dev/null || true`

## Git Safety Protocol
- NEVER update the git config
- NEVER run destructive/irreversible git commands (like `push --force`, hard reset, etc) unless the user explicitly requests them
- NEVER skip hooks (`--no-verify`, `--no-gpg-sign`, etc) unless the user explicitly requests it
- NEVER run force push to main/master, warn the user if they request it
- Do not commit files that likely contain secrets (`.env`, `credentials.json`, etc)
- Never use git commands with the `-i` flag since they require interactive input

## Steps

1. Create a new branch if on main (use `username/feature-name` pattern)

2. Create a single commit with an appropriate message using heredoc syntax:
```
git commit -m "$(cat <<'EOF'
Commit message here.
EOF
)"
```

3. Push the branch to origin

4. If a PR already exists for this branch (check the `gh pr view` output above), update the PR title and body using `gh pr edit` to reflect the current diff. Otherwise, create a pull request using `gh pr create` with heredoc syntax for the body.
   - IMPORTANT: Keep PR titles short (under 70 characters). Use the body for details.
```
gh pr create --title "Short, descriptive title" --body "$(cat <<'EOF'
## Summary
<1-3 bullet points>

## Test plan
[Bulleted markdown checklist of TODOs for testing the pull request...]
EOF
)"
```

You have the capability to call multiple tools in a single response. You MUST do all of the above in a single message.

Return the PR URL when you're done, so the user can see it.
