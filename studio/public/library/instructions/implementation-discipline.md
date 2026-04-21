---
type: instruction
name: implementation-discipline
scope: workflow
domain: development
description: Best practices for writing production-quality code during implementation
tags:
  - coding
  - best-practices
  - quality
narrativeTemplate:
  prefix: "Follow"
  suffix: "while writing the code"
---

# Implementation Discipline

Guidelines for writing clean, correct, production-quality code during the implementation phase.

## Before Writing Code
1. Re-read the task description and the relevant design section
2. Check {{memory/decisions}} for any relevant past decisions
3. Query {{capabilities/source-agent}} to understand the existing code patterns
4. Identify the minimal change needed — don't over-engineer

## While Writing Code
1. Follow existing code conventions (naming, formatting, structure)
2. Write the smallest possible change that satisfies the task
3. Run {{capabilities/get-diagnostics}} after every file edit
4. Run {{capabilities/run-tests}} after every logical change
5. Handle errors explicitly — no silent failures
6. Add comments only when the WHY isn't obvious from the code

## After Writing Code
1. Re-read the diff — does every line serve the task?
2. Check that no unrelated changes snuck in
3. Verify acceptance criteria from the requirements
4. Update {{memory/decisions}} if you made a non-obvious choice
5. Update {{memory/lessons}} if you hit a gotcha

## Common Mistakes
- Changing code style in files you're editing (stay consistent)
- Adding dependencies without justification
- Writing tests that test implementation details instead of behavior
- Leaving TODO comments without tracking them
