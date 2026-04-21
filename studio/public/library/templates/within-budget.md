---
name: within-budget
type: condition
check: "The cumulative resource consumption (token count, API cost, execution time, or compute units) is at or below the allocated budget limit for the current operation or workflow run"
narrativeTemplate:
  prefix: "If usage is within budget,"
  suffix: "continue processing."
---
# Within Budget

Token usage, cost, or time is within the allocated budget. Continue processing.
