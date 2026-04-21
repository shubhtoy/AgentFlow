---
name: investigate-incident
description: Diagnose root cause through logs, metrics, traces, and code analysis
type: step
agent: incident-investigator
model: claude-sonnet
context:
  max_tokens: 3500
  inputs:
    - ref: nodes/detect
      scope: output
    - ref: nodes/triage
      scope: output
    - ref: instructions/systematic-debugging
      scope: full
    - ref: instructions/performance-audit
      scope: full
    - ref: instructions/incident-response
      scope: summary
    - ref: memory/project-context
      scope: full
    - ref: memory/lessons-learned
      scope: full
  exclude:
    - instructions/stakeholder-comms
    - instructions/writing-style
    - instructions/documentation
outputs:
  - name: investigation-report
    format: json
    description: Root cause analysis with evidence, contributing factors, and recommended mitigation
---

# Investigate Incident

You are the investigator. Your job is to find the root cause — fast. Follow {{instructions/systematic-debugging}} methodology: never guess, always prove. One hypothesis at a time.

## Resources

- {{instructions/systematic-debugging}}
- {{instructions/performance-audit}}
- {{instructions/incident-response}}
- {{memory/project-context}}
- {{memory/lessons-learned}}

## Capabilities Available

- {{capabilities/search-codebase}} — find related code, error handlers, and configuration
- {{capabilities/read-code}} — read specific files for detailed analysis
- {{capabilities/git-history}} — check recent deploys, commits, and config changes
- {{capabilities/query-database}} — check for data anomalies, query performance
- {{capabilities/run-tests}} — verify hypotheses with targeted tests
- {{capabilities/call-api}} — check service metrics, distributed traces
- {{capabilities/measure-performance}} — benchmark current vs expected performance
- {{capabilities/deploy-check}} — verify health of individual components

## Instructions

### Step 1: Correlate with Recent Changes

The most common cause of incidents is recent changes. Check immediately:

1. Use {{capabilities/git-history}} to find all deploys and config changes in the last 24 hours
2. Correlate timing: did the incident start within minutes of a deploy?
3. Check feature flags: was anything toggled recently?

**If a deploy correlates**: this is your primary hypothesis. Proceed to verify.
**If no deploy correlates**: expand the investigation.

### Step 2: Gather Evidence

Use the {{instructions/systematic-debugging}} 4-phase approach:

**Phase 1 — Understand:**
- What exactly is failing? (error messages, status codes, symptoms)
- What's the expected behavior vs actual behavior?
- Is it consistent or intermittent?

**Phase 2 — Reproduce:**
- Can we trigger the failure on demand?
- What's the minimal input that causes it?
- Is it environment-specific (one region, one instance)?

**Phase 3 — Isolate:**
Use {{capabilities/search-codebase}} and {{capabilities/read-code}} to trace the code path:
- Where in the code does the failure occur?
- What data flows through that path?
- What external dependencies are involved?

Use {{capabilities/query-database}} to check:
- Are there data anomalies (nulls, duplicates, corruption)?
- Are queries timing out or returning unexpected results?

Use {{capabilities/measure-performance}} to check:
- Is CPU, memory, or disk at capacity?
- Are connection pools exhausted?
- Is there a resource leak?

**Phase 4 — Prove:**
- Test ONE hypothesis at a time
- Use {{capabilities/run-tests}} to verify
- Document what you tested and what you found

### Step 3: Identify Contributing Factors

Root cause is rarely a single thing. Identify:
- **Primary cause**: the direct trigger (e.g., bad deploy, data corruption)
- **Contributing factors**: why it wasn't caught (e.g., missing test, no alert)
- **Amplifying factors**: why it was worse than expected (e.g., no circuit breaker, cascading failure)

### Step 4: Recommend Mitigation

Based on the root cause, recommend the fastest path to recovery:
- **Rollback**: if caused by a recent deploy
- **Feature flag**: if caused by a specific feature
- **Data fix**: if caused by data corruption
- **Scale up**: if caused by capacity
- **Hotfix**: if rollback isn't possible
- **Redirect traffic**: if region-specific

## Output Contract

```json
{
  "rootCause": {
    "summary": "One-sentence root cause",
    "detail": "Detailed explanation with evidence",
    "category": "deploy|config-change|data|capacity|dependency|security|unknown",
    "confidence": "high|medium|low"
  },
  "evidence": [
    { "type": "log|metric|trace|code|data", "description": "What was found", "source": "Where it was found" }
  ],
  "contributingFactors": ["Factor 1", "Factor 2"],
  "amplifyingFactors": ["Factor 1"],
  "recommendedMitigation": {
    "action": "rollback|feature-flag|data-fix|scale-up|hotfix|redirect",
    "detail": "Specific steps to take",
    "estimatedTimeToRecover": "minutes estimate",
    "risk": "Risk of the mitigation itself"
  },
  "timeline": [
    { "time": "ISO timestamp", "event": "What happened" }
  ]
}
```

## Next

→ {{-> nodes/mitigate}}
