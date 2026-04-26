---
name: approval-criteria
description: Criteria for approving deliverables at review gates
narrativeTemplate:
  prefix: "Evaluate the deliverable against these criteria:"
  suffix: "All criteria must pass for approval. If any fail, route back for revision."
---

# Approval Criteria

## Requirements Review
- Every user story has acceptance criteria
- Non-functional requirements are specified (performance, security, accessibility)
- Edge cases and error scenarios are documented
- Scope boundaries are clear (what's in, what's out)

## Design Review
- Architecture traces back to specific requirements
- At least two alternatives were considered
- Trade-offs are documented with rationale
- Data models have field types and constraints
- API contracts include error responses
- Testing strategy covers unit, integration, and edge cases

## Plan Review
- Every task is atomic (completable in one session)
- Tasks have clear acceptance criteria
- Dependencies are identified and ordered correctly
- No task is estimated as "large" without being split
