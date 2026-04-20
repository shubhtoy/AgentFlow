---
name: output-changed
type: condition
check: "A diff comparison between the current output and the previous run's output (or established baseline) shows one or more material differences in content, structure, or values"
narrativeTemplate:
  prefix: "If the output differs from the previous version,"
  suffix: "trigger a review of the changes."
---
# Output Changed

The output has changed compared to the previous run or baseline. Trigger a diff review, notify stakeholders, or run regression checks.
