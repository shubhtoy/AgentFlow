---
name: retry-limit-reached
type: condition
check: "The number of retry attempts for the current operation has reached or exceeded the configured maximum retry count (default: 3), and the operation has not yet succeeded"
narrativeTemplate:
  prefix: "If the retry limit has been reached,"
  suffix: "escalate or abort the operation."
---
# Retry Limit Reached

The maximum number of retry attempts has been exhausted. Stop retrying and either escalate to a human, log the failure, or take a fallback action.
