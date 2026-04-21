---
name: review-design-gate
description: Router — present design to user, route on approval or rejection
type: router
context:
  inputs: []
---

# Review Design Gate

Present the technical design from {{<< output.create-design}} to the user via {{runbooks/review-design}}.

## Resources

Lightweight router node. Resolves:
- {{runbooks/review-design}}
- Two condition templates

**No skills or tools needed.**

## What to Present

Show the user:
- Architecture overview with component relationships
- Data models and type definitions
- API contracts (endpoints, request/response schemas)
- Testing strategy and correctness properties
- Key design decisions and alternatives considered

## Routing

- If approved and feature is an AgentFlow workflow → {{-> nodes/design-agentflow-feature | runbooks/design-approved}}
- If approved → {{-> nodes/plan-tasks | runbooks/design-approved}}
- If rejected → {{-> nodes/create-design | runbooks/design-rejected}} — incorporate architectural feedback and revise
