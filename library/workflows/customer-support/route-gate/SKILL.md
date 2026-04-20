---
name: route-gate
description: Dispatch to the correct specialist based on triage classification
type: router
agent: support-router
context:
  max_tokens: 500
  inputs:
    - ref: nodes/triage
      scope: output
  exclude:
    - instructions/*
    - capabilities/*
outputs:
  - name: routing-decision
    format: json
    description: Selected route with reason
---

# Route Gate

Lightweight dispatcher. Zero tools, zero skills. Routes based on triage output only.

## Routing Rules

Read the `triage-result` from the previous node and route:

| Category    | Urgency    | Route                  |
|-------------|------------|------------------------|
| `billing`   | any        | → {{nodes/billing}}    |
| `technical` | any        | → {{nodes/technical}}  |
| `general`   | any        | → {{nodes/general}}    |

### Urgency Override

If urgency is `critical` regardless of category:
- {{runbooks/is-urgent}} → fast-track: skip detailed investigation, go straight to {{nodes/respond}} with an escalation note
- {{runbooks/escalate}} → notify on-call team immediately

## Next

{{runbooks/is-urgent}} {{nodes/respond}}
{{nodes/billing}}
{{nodes/technical}}
{{nodes/general}}
