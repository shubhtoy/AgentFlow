---
name: review-intent-gate
description: User confirms or adjusts the proposed intent and pattern
type: router
context:
  max_tokens: 500
---

# Review Intent Gate

Show the user what you understood via {{runbooks/review-intent}}.

Present:
- The identity from {{<< output.customize-identity}}
- The intent from {{<< output.extract-intent}} — name, purpose, pattern, reasoning

Ask: "Does this look right? Want to change anything?"

## Routing

- Approved → {{-> nodes/discover-skills | runbooks/intent-approved}}
- Rejected → {{-> nodes/extract-intent | runbooks/intent-rejected}}
