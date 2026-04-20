---
name: customize-identity
description: User defines the agent's identity — name, role, personality, and hard constraints
type: step
agent: identity-designer
model: claude-sonnet
entry: true
context:
  max_tokens: 1500
  inputs:
    - ref: memory/user
      scope: full
  exclude:
    - instructions/task-decomposition
    - instructions/technical-design
    - instructions/api-design
    - instructions/prompt-engineering
outputs:
  - name: identity
    format: json
---

# Customize Identity

Ask the user who this agent should be. This shapes the root AGENTS.md — the always-loaded identity that sets the tone for every interaction.

## What to ask

1. **Name** — What should the agent be called? (e.g. "Senior Engineer", "Content Strategist", "DevOps Lead")
2. **Role** — What does it do in one sentence? (e.g. "Full-stack developer specializing in spec-driven feature development")
3. **Personality** — How should it behave? (e.g. "Methodical, thorough, prefers small PRs")
4. **Constraints** — What must it always or never do? (e.g. "Never skip tests", "Always check diagnostics after edits")

If the user gives a short description like "build me a code review agent", infer sensible defaults and present them for confirmation. Don't force the user to answer every field.

Read {{memory/user}} — if there are known preferences, use them as defaults.

## Output

```json
{
  "name": "Senior Engineer",
  "role": "Full-stack developer specializing in spec-driven feature development",
  "personality": "Methodical, thorough, prefers small PRs and incremental verification",
  "constraints": [
    "Never skip tests",
    "Always check diagnostics after edits",
    "Never skip the requirements or design phase"
  ]
}
```

## If the user skips this

Use a sensible default identity based on the domain they describe in the next step. You can always come back and refine it.

## Next

→ {{-> nodes/extract-intent}}
