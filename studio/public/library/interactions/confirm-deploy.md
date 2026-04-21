---
name: confirm-deploy
type: approval
timeout: 0
---
# Confirm Deploy

Present the deployment plan to the user and require explicit confirmation before deploying to production. Show: what's changing, which environment, rollback plan.

## What to Present

Show the user:

1. **Changes** — list of artifacts, versions, or configs being deployed
2. **Target environment** — staging, production, region, etc.
3. **Deployment method** — rolling, blue-green, canary, etc.
4. **Rollback plan** — how to revert if something goes wrong
5. **Pre-deploy checks** — tests passed, health checks, dependencies verified

Prompt: "The following deployment is ready. Please review the plan and confirm to proceed."

## User Options

- **Deploy** — proceed with the deployment as planned
- **Cancel** — abort the deployment, no changes made
- **Deploy to staging first** — redirect to a lower environment for validation
- **Modify plan** — adjust the deployment parameters before proceeding

## Timeout Behavior

No timeout (waits indefinitely). Deployments must never proceed without explicit human confirmation.
