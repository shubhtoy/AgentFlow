---
name: git-history
type: script
command: git log --oneline -20
description: View recent git commits and changes.
outputs:
  - commit_history
  - recent_changes
narrativeTemplate:
  prefix: "Check"
  suffix: "to understand recent changes"
---

# Git History

View recent git commits and changes. Useful for understanding what changed recently and who changed it.
