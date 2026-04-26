---
name: coding-standards
description: Project-wide coding conventions loaded into every agent session
domain: development
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
- Delete dead code. Don't comment it out — git has history.
- Prefer immutable data structures. Mutate only when performance requires it.

## Files
- One module per file. Name the file after its primary export.
- Keep files under 300 lines. If longer, extract modules.
- Group imports: stdlib → external → internal → relative
- Every file should have a single clear responsibility

## Functions
- Max 3 parameters. Use an options object for more.
- Max 30 lines per function. Extract helpers for complex logic.
- Return early for error cases (guard clauses)
- Avoid boolean parameters — they make call sites unreadable. Use options or enums.
- Prefer named return values over positional when returning multiple values

## Types and Interfaces
- Define types for all public API boundaries
- Prefer interfaces over type aliases for object shapes
- Use union types instead of enums when possible
- Make illegal states unrepresentable through the type system

## Comments
- Comment the WHY, not the WHAT
- Delete commented-out code
- Use JSDoc/docstrings for public APIs
- TODO comments must include a tracking reference or owner

## Testing
- Test behavior, not implementation details
- One assertion per test when practical
- Name tests: `should [expected behavior] when [condition]`
- Arrange-Act-Assert structure for every test

## Git
- Atomic commits — one logical change per commit
- Descriptive commit messages: `fix(auth): handle expired token refresh`
- Never commit secrets, credentials, or API keys
- Keep commits small enough to review in under 10 minutes
