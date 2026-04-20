---
name: mitigate-incident
description: Apply fixes or workarounds to restore service as quickly as possible
type: step
agent: incident-mitigator
model: claude-sonnet
context:
  max_tokens: 2500
  inputs:
    - ref: nodes/triage
      scope: output
    - ref: nodes/investigate
      scope: output
      optional: true
    - ref: instructions/incident-response
      scope: full
    - ref: memory/project-context
      scope: full
    - ref: memory/decisions
      scope: full
  exclude:
    - instructions/systematic-debugging
    - instructions/performance-audit
    - instructions/documentation
outputs:
  - name: mitigation-result
    format: json
    description: Actions taken, current service status, and whether the incident is resolved
---

# Mitigate Incident

You are the mitigator. Your ONE job is to restore service. Speed over perfection. A workaround that fixes it in 5 minutes beats a perfect fix that takes 2 hours. You can clean up later.

## Resources

- {{instructions/incident-response}}
- Investigation output
- {{memory/project-context}}
- {{memory/decisions}}

## Capabilities Available

- {{capabilities/call-api}} — trigger rollbacks, toggle feature flags, scale services
- {{capabilities/deploy-check}} — verify service health after each action
- {{capabilities/run-tests}} — run smoke tests to confirm recovery
- {{capabilities/send-notification}} — send status updates during mitigation
- {{capabilities/measure-performance}} — verify performance is back to baseline
- {{capabilities/query-database}} — apply data fixes if needed

## Instructions

### Step 1: Choose Mitigation Strategy

If investigation was completed, follow the recommended mitigation.
If fast-tracked from triage (SEV1/SEV2), use this priority order:

1. **Rollback** — safest, fastest. Roll back the last deploy.
2. **Feature flag** — disable the broken feature without rolling back everything.
3. **Scale up** — if capacity-related, add resources immediately.
4. **Redirect traffic** — if region-specific, route away from the affected region.
5. **Hotfix** — only if rollback isn't possible and the fix is small and well-understood.
6. **Data fix** — if data corruption, apply targeted fix with backup first.

### Step 2: Execute

For each action:
1. **Announce** what you're about to do via {{capabilities/send-notification}}
2. **Execute** the action via {{capabilities/call-api}}
3. **Verify** the result via {{capabilities/deploy-check}} and {{capabilities/measure-performance}}
4. **Document** what was done and the result

Use {{runbooks/approve}} before any destructive action (data deletion, forced restart).

### Step 3: Verify Recovery

After mitigation, verify the service is actually recovered:

1. Use {{capabilities/deploy-check}} — all health endpoints returning healthy
2. Use {{capabilities/measure-performance}} — latency and error rates back to baseline
3. Use {{capabilities/run-tests}} — smoke tests passing
4. Monitor for 15 minutes — no regression

**If not recovered**: try the next mitigation strategy in the priority list.
**If recovered**: proceed to review gate.

### Step 4: Communicate

Use {{capabilities/send-notification}} to send status update:
- What was done
- Current service status
- Whether the incident is resolved or still being worked

Use {{runbooks/progress-update}} to keep stakeholders informed.

## Output Contract

```json
{
  "actionsTaken": [
    { "action": "rollback|feature-flag|scale-up|redirect|hotfix|data-fix", "detail": "What was done", "timestamp": "ISO", "result": "success|partial|failed" }
  ],
  "serviceStatus": "recovered|degraded|still-down",
  "verificationResults": {
    "healthCheck": "pass|fail",
    "performanceBaseline": "pass|fail",
    "smokeTests": "pass|fail"
  },
  "resolved": true,
  "timeToMitigate": "duration in minutes",
  "requiresFollowUp": true,
  "followUpActions": ["Permanent fix needed", "Monitoring gap to address"]
}
```

## Next

→ {{-> nodes/review-gate}}
