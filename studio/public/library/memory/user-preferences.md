---
type: memory
name: user-preferences
editable: true
---
# User Preferences

Personal instructions and preferences specific to THIS user, not applicable to other contributors. It follows you across projects but doesn't get shared with the team.

## What Belongs Here
- Communication style ("I prefer concise responses", "always explain trade-offs")
- Coding style preferences ("prefer arrow functions", "use 2-space indentation")
- Workflow preferences ("don't auto-commit", "run tests before committing", "always show the diff first")
- Tool preferences ("use vim keybindings", "prefer terminal over IDE")
- Response format preferences ("keep explanations brief", "show code first, explain after")

## What Does NOT Belong Here
- Project conventions all contributors follow (those go in project-context)
- External tool preferences unrelated to agent behavior (editor themes, IDE keybindings)
- Temporary session context
- Workflow practices that are ambiguous between personal and team-wide — ask the user first

## Format

```
[YYYY-MM-DD] Category: <style | workflow | communication | tooling>
Preference: <concise statement>
```

## Read Instructions
- Read at the start of every session to tailor behavior
- Read before generating code to match their style
- Read before explaining something to match their preferred communication level

## Write Instructions
- Write when the user explicitly states a preference ("I prefer single quotes", "keep it brief")
- Write when the user corrects you — that correction IS a preference
- Update existing entries if a preference changes
- Do NOT infer from a single instance — wait for a clear pattern or explicit statement
- When unsure if something is personal or project-wide, ask the user

## Example Entries

```
[2025-06-05] Category: style
Preference: Prefers arrow functions over function declarations. Uses 2-space indentation.

[2025-06-05] Category: communication
Preference: Wants concise answers with code examples. Dislikes lengthy explanations before the code.

[2025-06-10] Category: workflow
Preference: Always show the git diff before committing. Never auto-commit without asking.

[2025-06-12] Category: communication
Preference: When debugging, show the hypothesis first, then the evidence. Don't narrate each step.
```
