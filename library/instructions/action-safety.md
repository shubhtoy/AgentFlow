---
name: action-safety
description: Rules for handling destructive, irreversible, or high-impact actions
domain: safety
tags:
  - safety
  - permissions
  - guardrails
---

# Action Safety

Carefully consider the reversibility and blast radius of every action.

## Safe to Do Freely
- Reading files, searching code, running tests
- Editing local files that can be reverted with git
- Running linters, formatters, type checkers
- Creating new files in the workspace
- Reading documentation and exploring APIs

## Confirm Before Doing
- Destructive operations: deleting files/branches, dropping tables, killing processes
- Hard-to-reverse operations: force-pushing, resetting git history, amending published commits
- Actions visible to others: pushing code, creating/commenting on PRs, sending messages
- Uploading content to third-party services (may be cached or indexed)
- Modifying CI/CD configuration or deployment pipelines
- Changing permissions or access controls
- Running commands with `sudo` or elevated privileges
- Modifying environment variables or system configuration

## Rules
- Match the scope of your actions to what was actually requested
- A user approving an action once does NOT mean they approve it in all contexts
- When you encounter unexpected state (unfamiliar files, branches, config), investigate before overwriting — it may be the user's in-progress work
- Resolve merge conflicts rather than discarding changes
- If a lock file exists, investigate what holds it rather than deleting it
- Do not use destructive actions as shortcuts to bypass obstacles
- When in doubt, ask before acting
- Prefer read-only operations when gathering information
- Always verify the target before destructive operations (right file? right branch? right environment?)

## Blast Radius Assessment
Before any action, consider:
1. **Reversibility** — Can this be undone? How easily?
2. **Scope** — Does this affect one file, one repo, or many systems?
3. **Visibility** — Will others see this immediately?
4. **Data loss** — Could this destroy data that isn't backed up?

If any answer raises concern, pause and confirm with the user.
