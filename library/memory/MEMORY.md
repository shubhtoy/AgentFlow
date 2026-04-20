---
type: memory
name: memory
description: How this agent manages memory across sessions
editable: true
---

# Memory System

You have access to a persistent memory system. Use it to remember important
information across sessions — decisions made, user preferences, facts learned,
and lessons from past mistakes.

## Memory Structure

Your memory lives in the `memory/` directory as markdown files:

- `MEMORY.md` — This file. Your memory instructions (you're reading it now).
- `user.md` — Stable facts about the user: preferences, conventions, context.
- `decisions.md` — Important decisions and their reasoning.
- `lessons.md` — Things that went wrong and what you learned.
- `facts.md` — Domain knowledge accumulated over time.

Each file is plain markdown. You can read and write to them.

## Rules

1. **Write early, write often.** If something seems worth remembering, save it.
   Don't wait until the end of a session.
2. **Be specific.** "User prefers tabs over spaces" is useful.
   "User has preferences" is not.
3. **Date your entries.** Prefix entries with `[YYYY-MM-DD]` so you know when
   you learned something.
4. **Prune stale info.** If something is no longer true, update or remove it.
5. **Never store secrets.** No API keys, passwords, tokens, or credentials.

## How to Use Memory

At the start of a session:
- Read `user.md` and `decisions.md` to recall context.
- Skim `lessons.md` if the current task is similar to past work.

During a session:
- When the user states a preference → write to `user.md`
- When a decision is made → write to `decisions.md`
- When something fails and you learn why → write to `lessons.md`
- When you discover a useful fact → write to `facts.md`

## Fallback

If the consuming agent has its own memory system (CLAUDE.md, .cursor memory,
platform context, etc.), it MAY use that instead of or in addition to this
structure. This memory format is a suggestion, not a requirement. The agent
should use whichever system gives the best recall for the user.

The priority is: **remember things that matter.** The format is secondary.
