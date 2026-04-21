---
type: memory
name: session-notes
editable: true
---
# Session Notes

Working notes, temporary context, and observations from the current session. This is the auto-memory layer — things the agent noticed that might be worth promoting to a permanent memory layer later.

## What Belongs Here
- Observations about the codebase discovered during this session
- Patterns noticed but not yet confirmed as conventions
- Temporary context needed for the current task
- Things the user said that might be preferences but need confirmation
- Intermediate findings during debugging or research

## Lifecycle
Session notes are ephemeral by default. At the end of a session (or periodically), use the `memory-review` skill to:
1. Promote confirmed patterns to project-context
2. Promote confirmed preferences to user-preferences
3. Promote confirmed lessons to lessons-learned
4. Discard notes that are no longer relevant

## Format

```
[timestamp] Note: <observation or finding>
Confidence: low | medium | high
Promote to: <project-context | user-preferences | lessons-learned | team-context | discard>
```

## Read Instructions
- Read to recall what was discovered earlier in this session
- Read before the memory-review skill runs to have context for promotion decisions

## Write Instructions
- Write freely during the session — this is scratch space
- Write when you notice something that might be a pattern but aren't sure yet
- Write when the user says something that sounds like a preference but hasn't been confirmed
- Don't worry about duplicates here — cleanup happens during memory-review

## Example Entries

```
[2025-06-20T14:30] Note: User seems to prefer seeing test output before committing
Confidence: medium
Promote to: user-preferences (ask first)

[2025-06-20T14:45] Note: The src/utils/ directory has 3 different date formatting functions
Confidence: high
Promote to: lessons-learned (consolidate these)

[2025-06-20T15:00] Note: CI takes ~8 minutes on this repo
Confidence: high
Promote to: project-context
```
