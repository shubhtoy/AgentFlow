---
name: is-urgent
type: condition
check: "The task is marked as high severity (e.g., SEV-1 or SEV-2), has an SLA breach imminent within 1 hour, or has been explicitly flagged as urgent by a human operator"
narrativeTemplate:
  prefix: "If the task is urgent,"
  suffix: "fast-track to resolution."
---
# Is Urgent

The task is high severity or time-sensitive. Skip optional steps and fast-track to resolution.
