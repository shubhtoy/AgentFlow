---
type: mcp
mcp: project-tracker
parameters:
  title:
    type: string
    description: "Ticket title"
    required: true
  description:
    type: string
    description: "Detailed description of the issue or task"
    required: true
  priority:
    type: string
    description: "Ticket priority"
    enum: ["critical", "high", "medium", "low"]
    required: true
  labels:
    type: array
    description: "Labels or tags to apply"
    items:
      type: string
  assignee:
    type: string
    description: "Username to assign the ticket to"
---
# Create Ticket

Create an issue or ticket in the project tracker (Jira, Linear, GitHub Issues, etc.). Requires title, description, and priority.
