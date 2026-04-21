---
type: mcp
mcp: notifications
parameters:
  channel:
    type: string
    description: "Notification channel"
    enum: ["slack", "email", "webhook"]
    required: true
  message:
    type: string
    description: "Notification message body"
    required: true
  recipient:
    type: string
    description: "Channel ID, email address, or webhook URL"
    required: true
---
# Send Notification

Send a notification via Slack, email, or webhook. Configure the MCP server with your preferred notification channel.
