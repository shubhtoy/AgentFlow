---
name: git-commit
domain: development
---
# Git Commit

Based on the current changes, create a single git commit.

## Context

- Current git status: `git status`
- Current git diff (staged and unstaged changes): `git diff HEAD`
- Current branch: `git branch --show-current`
- Recent commits: `git log --oneline -10`

## Git Safety Protocol
- NEVER update the git config
- NEVER skip hooks (`--no-verify`, `--no-gpg-sign`, etc) unless the user explicitly requests it
- CRITICAL: ALWAYS create NEW commits. NEVER use `git commit --amend`, unless the user explicitly requests it. When a pre-commit hook fails, the commit did NOT happen — so `--amend` would modify the PREVIOUS commit, which may result in destroying work or losing previous changes. Instead, after hook failure, fix the issue, re-stage, and create a NEW commit
- Do not commit files that likely contain secrets (`.env`, `credentials.json`, etc). Warn the user if they specifically request to commit those files
- If there are no changes to commit (i.e., no untracked files and no modifications), do not create an empty commit
- Never use git commands with the `-i` flag (like `git rebase -i` or `git add -i`) since they require interactive input which is not supported
- When staging files, prefer adding specific files by name rather than using `git add -A` or `git add .`, which can accidentally include sensitive files or large binaries

## Steps

1. Analyze all staged changes and draft a commit message:
   - Look at the recent commits above to follow this repository's commit message style
   - Summarize the nature of the changes (new feature, enhancement, bug fix, refactoring, test, docs, etc.). Ensure the message accurately reflects the changes and their purpose (i.e. "add" means a wholly new feature, "update" means an enhancement to an existing feature, "fix" means a bug fix, etc.)
   - Draft a concise (1-2 sentences) commit message that focuses on the "why" rather than the "what"

2. Stage relevant files and create the commit using HEREDOC syntax:
```
git commit -m "$(cat <<'EOF'
Commit message here.
EOF
)"
```

You have the capability to call multiple tools in a single response. Stage and create the commit using a single message. Do not use any other tools or do anything else.
