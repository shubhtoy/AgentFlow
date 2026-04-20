---
name: code-review-skill
domain: development
---
# Code Review

Systematic approach to reviewing code for correctness, clarity, and maintainability.

## Process Steps
1. Read the PR description and linked issue to understand intent
2. Run `gh pr diff` or `git diff` to get the changes
3. Scan the diff for scope — which files changed and why
4. Review for correctness: logic errors, edge cases, null handling
5. Review for security: injection, auth gaps, secret exposure
6. Review for readability: naming, structure, comments where needed
7. Write structured feedback with blocking issues separated from suggestions

## Review Priorities (in order)
1. Correctness — does it do what it's supposed to?
2. Security — any vulnerabilities introduced?
3. Performance — any obvious bottlenecks?
4. Readability — can another developer understand this?
5. Maintainability — will this be easy to change later?
6. Style — consistent with the codebase?

## What to Look For
- Off-by-one errors, null/undefined handling, race conditions
- Missing error handling or swallowed exceptions
- Hardcoded values that should be configurable
- Functions doing too many things (single responsibility)
- Missing or inadequate tests for new behavior
- Breaking changes to public APIs
- Redundant state that duplicates existing state
- Copy-paste with slight variation that should be unified
- Independent operations run sequentially that could be parallel
- Unnecessary existence checks before operations

## Feedback Style
- Be specific: point to the exact file:line and explain why
- Suggest alternatives, don't just criticize
- Distinguish blocking issues from nits
- Praise good patterns when you see them
- Ask questions when intent is unclear

## Anti-Patterns
- Rubber-stamping without reading the code
- Reviewing style/formatting instead of logic
- Leaving vague feedback without explanation
- Blocking on personal preference rather than objective issues
- Reviewing a 2000-line PR in one pass instead of requesting a split

## Output Format
A structured review with: one-line summary, list of blocking issues (must fix), list of suggestions (nice to have), and open questions.
