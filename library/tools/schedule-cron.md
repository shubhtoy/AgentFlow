---
type: builtin
builtin_mapping: schedule_cron
parameters:
  cron:
    type: string
    description: "Cron expression (e.g. '*/5 * * * *')"
    required: true
  prompt:
    type: string
    description: "Prompt or command to execute on schedule"
    required: true
  recurring:
    type: boolean
    description: "Whether the schedule repeats"
    default: true
---
# Schedule Cron

Create a scheduled trigger that runs a prompt or command on a cron schedule. Recurring tasks auto-expire after 30 days. Use for polling, monitoring, or periodic maintenance.
