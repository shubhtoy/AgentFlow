---
name: wrap-up
type: step
description: Summarize completed work, persist learnings, suggest next steps
context:
  inputs: [output.gather-requirements, output.design, output.implementation]
---

# Wrap Up

The feature is implemented and verified. Summarize what was built, persist learnings for future sessions, and suggest follow-up work.

## Process

### 1. Write Summary

Use {{skills/documentation}} to produce a clear summary of the completed work:
- What was built (one paragraph overview)
- Key architectural decisions and why they were made
- Files created or modified (grouped by purpose)
- Tests added and what they cover
- Any deviations from the original plan and why

Reference {{<< output.gather-requirements}} for the original intent, {{<< output.design}} for the architectural approach, and {{<< output.implementation}} for what was actually delivered.

### 2. Prepare for Code Review

Follow {{skills/requesting-code-review}} to prepare the work for review:
- Ensure commit history tells a clear story
- Write a PR description that explains the change
- Highlight areas that need careful review
- Note any known limitations or tech debt

### 3. Persist Learnings

The {{hooks/memory-on-session-end}} hook will fire when this workflow completes, prompting memory persistence. Proactively update these memory files now:

**{{memory/decisions}}** — Record all architectural decisions made during this feature:
- What was decided, what alternatives existed, why this choice was made

**{{memory/lessons-learned}}** — Capture what worked and what didn't:
- Techniques that saved time
- Mistakes that cost time
- Surprises encountered during implementation

**{{memory/project-context}}** — Update the project state:
- New components or modules added
- Changed interfaces or APIs
- Updated dependencies

### 4. Suggest Next Steps

Based on what was learned during implementation, suggest:
- Follow-up features or improvements
- Tech debt items to address
- Monitoring or observability to add
- Documentation to write or update
- Performance optimizations to consider

Be specific — each suggestion should be actionable, not vague.
