---
type: memory
name: lessons-learned
editable: true
---
# Lessons Learned

Mistakes, failed approaches, and the correct solutions discovered afterward. This prevents repeating the same errors and accelerates debugging in future sessions.

## What Belongs Here
- Bugs that took significant effort to diagnose
- Approaches that failed and why
- Non-obvious correct solutions
- Environment-specific gotchas
- User corrections ("don't do that again")

## Format

```
[YYYY-MM-DD] Problem: <what went wrong>
Wrong approach: <what was tried and failed>
Correct approach: <what actually fixed it>
Impact: low | medium | high
```

## Read Instructions
- Read when encountering an error — a past lesson may apply directly
- Read before attempting a complex refactor or migration to avoid known pitfalls
- Read when a user says "we tried that before" or "that won't work"

## Write Instructions
- Write after resolving a non-obvious bug that took significant effort
- Write when the user explicitly says "remember this" or "don't do that again"
- Write when an approach fails and a different solution is found
- Write when a user corrects you — the correction encodes a lesson
- Keep entries concise — focus on the actionable takeaway, not the full story

## Example Entries

```
[2025-06-20] Problem: YAML frontmatter parsing failed silently on files with Windows line endings
Wrong approach: Assumed all files use LF; parser returned empty object without error.
Correct approach: Normalize line endings to LF before parsing frontmatter.
Impact: medium

[2025-07-10] Problem: ZIP export produced corrupt archives on large workspaces
Wrong approach: Used synchronous JSZip generation which hit memory limits.
Correct approach: Switched to streaming mode with generateNodeStream() and piped to file.
Impact: high

[2025-07-15] Problem: git commit --amend after pre-commit hook failure destroyed previous commit
Wrong approach: Used --amend to retry after hook failure.
Correct approach: Hook failure means the commit never happened. Always create a NEW commit after fixing the issue.
Impact: high
```
