---
name: memory-review
domain: planning
---
# Memory Review

## Goal
Review the agent's memory landscape and produce a clear report of proposed changes, grouped by action type. Do NOT apply changes — present proposals for user approval.

## Steps

### 1. Gather all memory layers
Read all memory files from the project (project-context, user-preferences, lessons-learned, decisions, team-context, session-notes). Note which layers exist and which are empty.

**Success criteria**: You have the contents of all memory layers and can compare them.

### 2. Classify each session-notes entry
For each substantive entry in session-notes, determine the best destination:

| Destination | What belongs there | Examples |
|---|---|---|
| **project-context** | Project conventions and facts that all contributors should follow | "use bun not npm", "API routes use kebab-case", "test command is bun test" |
| **user-preferences** | Personal preferences specific to this user, not applicable to others | "I prefer concise responses", "always explain trade-offs", "don't auto-commit" |
| **team-context** | Org-wide knowledge that applies across repositories (only if configured) | "deploy PRs go through #deploy-queue", "staging is at staging.internal" |
| **lessons-learned** | Mistakes made and correct approaches discovered | "don't use --amend after hook failure", "normalize line endings before parsing" |
| **decisions** | Explicit choices between alternatives with reasoning | "chose Fastify over Express for performance" |
| **Stay in session-notes** | Working notes, temporary context, or entries that don't clearly fit elsewhere | Session-specific observations, uncertain patterns |

**Important distinctions:**
- Project-context contains instructions for agents that all contributors should follow
- User-preferences contains personal instructions not applicable to other contributors
- Workflow practices (PR conventions, merge strategies) are ambiguous — ask the user whether they're personal or project-wide
- When unsure, ask rather than guess

**Success criteria**: Each entry has a proposed destination or is flagged as ambiguous.

### 3. Identify cleanup opportunities
Scan across all layers for:
- **Duplicates**: Session-notes entries already captured in a permanent layer → propose removing from session-notes
- **Outdated**: Permanent layer entries contradicted by newer session-notes → propose updating the older layer
- **Conflicts**: Contradictions between any two layers → propose resolution, noting which is more recent

**Success criteria**: All cross-layer issues identified.

### 4. Present the report
Output a structured report grouped by action type:
1. **Promotions** — entries to move, with destination and rationale
2. **Cleanup** — duplicates, outdated entries, conflicts to resolve
3. **Ambiguous** — entries where you need the user's input on destination
4. **No action needed** — brief note on entries that should stay put

If session-notes is empty, say so and offer to review other layers for cleanup.

**Success criteria**: User can review and approve/reject each proposal individually.

## Rules
- Present ALL proposals before making any changes
- Do NOT modify files without explicit user approval
- Do NOT create new files unless the target doesn't exist yet
- Ask about ambiguous entries — don't guess
