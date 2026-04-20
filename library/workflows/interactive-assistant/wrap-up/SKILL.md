---
name: wrap-up
description: Summarize session, persist memory, suggest next steps
type: step
agent: session-manager
model: claude-sonnet
context:
  max_tokens: 1000
  inputs:
    - ref: capabilities/write-file
      scope: signature
    - ref: memory/user
      scope: full
    - ref: memory/decisions
      scope: full
    - ref: memory/lessons
      scope: full
    - ref: memory/facts
      scope: full
outputs:
  - name: session-summary
    format: markdown
    description: Brief summary of what was accomplished
---

# Wrap Up

Session is ending. Persist everything important to memory and give the user a clean summary.

## Resources

- Use {{capabilities/write-file}} to update memory files
- {{memory/user}}
- {{memory/decisions}}
- {{memory/lessons}}
- {{memory/facts}}

## Instructions

### Step 1: Review Memory

Check each memory file. Ensure everything important from this session is recorded:
- New user preferences → {{memory/user}}
- Decisions made → {{memory/decisions}}
- Lessons learned → {{memory/lessons}}
- Facts discovered → {{memory/facts}}

Use {{capabilities/write-file}} to update any memory files that need it.

### Step 2: Summarize

Produce a brief session summary:
- What was accomplished (2-3 sentences)
- Any open items or suggested follow-ups
- Key decisions made

### Step 3: Suggest Next Steps

Based on what was done, suggest what the user might want to do next:
- Related features to build
- Tests to add
- Documentation to update
- Code to review

## Deliverable

A clean session summary with memory persisted and next steps suggested.
