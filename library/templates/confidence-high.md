---
name: confidence-high
type: condition
check: "The agent's confidence score or self-assessed certainty in its output is above the high-confidence threshold (e.g., ≥ 0.9 or explicitly stated as 'high confidence'), with no unresolved ambiguities or missing information"
narrativeTemplate:
  prefix: "If confidence in the result is high,"
  suffix: "proceed without additional verification."
---
# Confidence High

The agent has high confidence in its output (clear requirements, strong evidence, well-understood domain). Proceed without additional review cycles.
