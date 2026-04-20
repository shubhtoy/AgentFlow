---
name: confidence-low
type: condition
check: "The agent's confidence score or self-assessed certainty in its output is below the low-confidence threshold (e.g., < 0.5 or explicitly stated as 'low confidence'), or there are unresolved ambiguities, missing data, or unfamiliar domain concepts"
narrativeTemplate:
  prefix: "If confidence is low,"
  suffix: "escalate for human review or gather more information."
---
# Confidence Low

The agent is uncertain about its output (ambiguous requirements, insufficient data, unfamiliar domain). Escalate to a human or gather additional information before proceeding.
