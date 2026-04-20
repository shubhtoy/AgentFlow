---
name: review-requirements-gate
description: Router — present requirements to user, route on approval or rejection
type: router
context:
  inputs:
    - ref: memory/user
      scope: summary
---

# Review Requirements Gate

Present the requirements document from {{<< output.gather-requirements}} to the user via {{runbooks/review-requirements}}.

## Resources

This is a lightweight router node. It resolves:
- {{runbooks/review-requirements}}
- Two condition templates

**No skills or tools needed** — this node only routes.

## What to Present

Show the user:
- The full requirements document with all numbered requirements and acceptance criteria
- A summary of scope: what's included and what's explicitly excluded
- Any assumptions made during elicitation
- Open questions that need user input

## Routing

- If approved → {{-> nodes/create-design | runbooks/requirements-approved}}
- If rejected → {{-> nodes/gather-requirements | runbooks/requirements-rejected}} — incorporate the user's feedback and revise
