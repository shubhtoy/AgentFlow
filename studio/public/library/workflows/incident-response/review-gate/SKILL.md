---
name: resolution-gate
description: Confirm the incident is fully resolved before closing and moving to postmortem
type: router
agent: incident-commander
context:
  max_tokens: 500
  inputs:
    - ref: nodes/mitigate
      scope: output
    - ref: nodes/triage
      scope: output
  exclude:
    - instructions/*
    - capabilities/*
outputs:
  - name: resolution-decision
    format: json
    description: Whether the incident is resolved or needs more work
---

# Resolution Gate

Confirm the incident is fully resolved before closing. This is a gate — no postmortem until the service is confirmed stable.

## Resolution Criteria

All must be true:
- [ ] Health checks passing for at least 15 minutes
- [ ] Error rates back to pre-incident baseline
- [ ] Latency back to pre-incident baseline
- [ ] No new alerts related to this incident
- [ ] Customer-facing impact has stopped

## Interactions

Use {{runbooks/approve}} to get incident commander sign-off.
Use {{runbooks/collect-feedback}} if the team has concerns about stability.

## Routing

If `serviceStatus === "recovered"` AND all verification checks pass:
- {{runbooks/is-approved}} → {{nodes/postmortem}}

If service is still degraded or checks are failing:
- {{runbooks/is-rejected}} → {{nodes/investigate}} (re-investigate with new data)
- {{runbooks/has-errors}} → {{nodes/mitigate}} (try next mitigation strategy)

## Next

{{runbooks/is-approved}} {{nodes/postmortem}}
{{runbooks/is-rejected}} {{nodes/investigate}}
{{runbooks/has-errors}} {{nodes/mitigate}}
