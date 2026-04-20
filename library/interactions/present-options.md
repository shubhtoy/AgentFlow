---
name: present-options
type: input
timeout: 300
---
# Present Options

Present the user with 2-4 options for how to proceed. Each option should include: a short label, a description of the approach, trade-offs (pros/cons), and a recommendation if one option is clearly better. Let the user choose.

## What to Present

Show the user:

1. **Decision context** — what decision needs to be made and why
2. **Options list** (2-4 options), each with:
   - Label (short name)
   - Description (one sentence)
   - Pros and cons
3. **Recommendation** — which option the agent suggests, if any

Prompt: "There are multiple ways to proceed. Please review the options below and select one."

## User Options

- **Select option by number** — pick one of the presented options (e.g., "Option 1")
- **Request more detail** — ask for deeper analysis of a specific option
- **Suggest alternative** — propose a different approach not listed (free-text)
- **Let agent decide** — defer to the agent's recommendation

## Timeout Behavior

After 300 seconds (5 minutes), the agent proceeds with its recommended option. If no recommendation was given, the agent picks the first option and logs the assumption.
