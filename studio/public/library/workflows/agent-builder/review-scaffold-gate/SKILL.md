---
name: review-scaffold-gate
description: User approves or requests changes to the designed workflow
type: router
context:
  max_tokens: 500
---

# Review Scaffold Gate

Show the complete design from {{<< output.design-nodes}} to the user via {{runbooks/review-scaffold}}.

Present:
- Agent name and pattern
- Node count (steps vs. routers)
- The flow: entry → ... → final node
- Which tools and instructions each node uses
- Review gates and their conditions

Ask: "Ready to generate? Want to change anything?"

## Routing

- Approved → {{-> nodes/generate-workspace | runbooks/scaffold-approved}}
- Rejected → {{-> nodes/design-nodes | runbooks/scaffold-rejected}}
