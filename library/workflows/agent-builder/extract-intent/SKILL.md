---
name: extract-intent
description: Analyze the user's request and suggest an architecture pattern
type: step
agent: requirements-analyst
model: claude-sonnet
context:
  max_tokens: 2000
  inputs:
    - ref: instructions/prompt-engineering
      scope: summary
    - ref: memory/user
      scope: full
    - ref: memory/decisions
      scope: full
  exclude:
    - instructions/task-decomposition
    - instructions/technical-design
    - instructions/api-design
outputs:
  - name: intent-summary
    format: json
---

# Extract Intent

The user has defined their agent's identity. Now understand what they want the agent to actually do.

## What to figure out

- What problem does this agent solve?
- What domain is it in?
- Is it a single task or a multi-step workflow?
- Does it need external services (APIs, databases)?
- Should it pause for human review between phases?
- Does it need to remember things across sessions?

## Pick a pattern

Choose the architecture that fits:

| Pattern | When to use |
|---------|-------------|
| single | One agent, linear steps, simple tasks |
| supervisor | Central agent delegates to specialists |
| router | Dispatcher routes to the right handler based on input type |
| handoff | Agents pass work in sequence, each adding value |
| pipeline | Data flows through processing stages mechanically |
| blackboard | Multiple agents read/write a shared workspace |

Explain your reasoning in one sentence.

## Ask up to 3 clarifying questions

Only if the intent is genuinely unclear. If the user said "build me a code review agent", you already know enough — don't over-ask.

## Suggest a name

Kebab-case, descriptive, max 64 chars. `code-review`, `data-pipeline`, `content-writer`.

## Output

```json
{
  "name": "code-review",
  "purpose": "Systematic code review with automated scanning and structured reports",
  "pattern": "pipeline",
  "patternReason": "Each phase builds on the previous — scan, analyze, report",
  "clarifyingQuestions": [],
  "needsMCP": false,
  "needsMemory": true,
  "needsHumanReview": true
}
```

## If something is unclear

Ask. Don't guess the pattern — a wrong architecture is expensive to fix later.

## Next

→ {{-> nodes/review-intent-gate}}
