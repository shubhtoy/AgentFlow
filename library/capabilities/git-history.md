---
name: git-history
type: builtin
description: View recent git commits, diffs, and change history. Understand what changed, when, and by whom.
parameters:
  count:
    type: number
    description: Number of recent commits to show (default 20)
    required: false
  path:
    type: string
    description: Limit history to a specific file or directory
    required: false
outputs:
  - commit_history
  - recent_changes
narrativeTemplate:
  prefix: "Check"
  suffix: "to understand recent changes"
---

# Git History

View recent git commits and changes. Useful for understanding what changed recently and who changed it.

## When to use

- Understanding recent changes before making edits
- Finding when a bug was introduced
- Reviewing commit messages for context
