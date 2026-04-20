---
type: instruction
name: coding-standards
scope: global
inclusion: auto
description: Project-wide coding conventions loaded into every agent session
tags:
  - standards
  - conventions
  - style
---

# Coding Standards

These conventions apply to all code written in this workspace.

## General
- Use descriptive names — `getUserById` not `getU` or `fetchData`
- One function does one thing. If you need "and" to describe it, split it.
- Prefer pure functions over side effects
- Handle errors explicitly — no empty catch blocks, no silent failures
- Delete dead code. Don't comment it out.

## Files
- One module per file. Name the file after its primary export.
- Keep files under 300 lines. If longer, extract modules.
- Group imports: stdlib → external → internal → relative

## Functions
- Max 3 parameters. Use an options object for more.
- Max 30 lines per function. Extract helpers for complex logic.
- Return early for error cases (guard clauses)

## Comments
- Comment the WHY, not the WHAT
- Delete commented-out code
- Use JSDoc/docstrings for public APIs

## Testing
- Test behavior, not implementation details
- One assertion per test when practical
- Name tests: `should [expected behavior] when [condition]`

## Git
- Atomic commits — one logical change per commit
- Descriptive commit messages: `fix(auth): handle expired token refresh`
- Never commit secrets, credentials, or API keys
