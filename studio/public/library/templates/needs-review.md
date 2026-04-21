---
name: needs-review
type: condition
check: "The output modifies production systems, affects user-facing data, involves security-sensitive changes, or exceeds the agent's autonomous action threshold as defined by the workflow policy"
narrativeTemplate:
  prefix: "If the output is high-risk,"
  suffix: "require human review before proceeding."
---
# Needs Review

The output requires human review before proceeding. Use when changes are high-risk, affect production, or involve sensitive data.
