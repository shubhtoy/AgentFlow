---
name: implementation-discipline
description: Best practices for writing production-quality code during implementation
domain: development
tags:
  - coding
  - best-practices
  - quality
---

# Implementation Discipline

Guidelines for writing clean, correct, production-quality code during the implementation phase.

## Before Writing Code
1. Re-read the task description and the relevant design section
2. Check past decisions in memory for any relevant context
3. Explore the existing codebase to understand current patterns
4. Identify the minimal change needed — don't over-engineer
5. Check if similar functionality already exists before writing new code

## While Writing Code
1. Follow existing code conventions (naming, formatting, structure)
2. Write the smallest possible change that satisfies the task
3. Run diagnostics after every file edit — catch errors immediately
4. Run tests after every logical change — don't batch verification
5. Handle errors explicitly — no silent failures, no empty catch blocks
6. Add comments only when the WHY isn't obvious from the code
7. Keep functions short and focused — extract when complexity grows
8. Use meaningful variable names even for temporary values

## After Writing Code
1. Re-read the diff — does every line serve the task?
2. Check that no unrelated changes snuck in (formatting, imports, whitespace)
3. Verify acceptance criteria from the requirements
4. Update decision records if you made a non-obvious choice
5. Record lessons learned if you hit a gotcha worth remembering

## Common Mistakes
- Changing code style in files you're editing — stay consistent with the file
- Adding dependencies without justification
- Writing tests that test implementation details instead of behavior
- Leaving TODO comments without tracking them
- Gold-plating — adding features or abstractions nobody asked for
- Copying code instead of extracting a shared function
- Ignoring compiler/linter warnings — they're usually right
