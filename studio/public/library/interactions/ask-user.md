---
name: ask-user
type: input
timeout: 300
---
# Ask User

Ask the user a clarifying question when requirements are ambiguous, multiple valid approaches exist, or a decision requires human judgment.

## What to Present
1. **Context** — why this question is being asked now
2. **Question** — the specific question, clearly phrased
3. **Options** (if applicable) — suggested answers with brief rationale for each

## Question Types
- **Single select** — pick one option from a list
- **Multi select** — pick multiple options
- **Free text** — open-ended response
- **Confirmation** — yes/no with context

## Preview Feature
Use optional previews on options when presenting concrete artifacts for visual comparison:
- ASCII mockups of UI layouts
- Code snippets showing different implementations
- Configuration examples
- Diagram variations

Previews render as markdown in a side-by-side layout. Only use for single-select questions where visual comparison matters — not for simple preference questions.

## User Options
- **Free-text response** — user types their answer directly
- **Select from suggestions** — pick one of the provided options
- **Skip** — defer the decision; agent uses its best judgment

## Timeout Behavior
After 300 seconds (5 minutes), the agent proceeds using its best judgment and logs the assumption made.
