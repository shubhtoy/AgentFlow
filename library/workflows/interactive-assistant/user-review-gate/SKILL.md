---
name: user-review-gate
description: Router — present results to user, collect feedback, route to next action
type: router
---

# User Review Gate

Present the results of the previous action to the user and collect feedback.

## Resources

Lightweight router. Resolves:
- {{runbooks/collect-feedback}}
- {{runbooks/show-diff}}

**No instructions or capabilities needed.**

## What to Present

Based on the previous node:
- **explore-codebase**: Show the findings summary
- **write-code**: Show the diff via {{runbooks/show-diff}} and test results
- **debug-issue**: Show the root cause analysis and fix
- **refactor-code**: Show the diff via {{runbooks/show-diff}} and test results
- **explain**: Show the explanation

Then collect feedback via {{runbooks/collect-feedback}}.

## Routing

- User satisfied, new request → {{-> nodes/triage | runbooks/new-request}}
- User wants changes → {{-> nodes/triage | runbooks/retry-with-feedback}} — route back with feedback
- User is done → {{-> nodes/wrap-up | runbooks/session-ending}}
