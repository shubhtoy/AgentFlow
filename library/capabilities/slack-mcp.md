---
name: slack-mcp
type: mcp
mcp: "@modelcontextprotocol/server-slack"
description: Slack workspace integration via MCP. Read channels, send messages, manage threads, and search conversation history.
parameters:
  action:
    type: string
    description: "Action to perform: list_channels, read_channel, post_message, reply_to_thread, search_messages, etc."
    required: true
  channel:
    type: string
    description: Channel name or ID
    required: false
  message:
    type: string
    description: Message text to send
    required: false
outputs:
  - result
  - messages
  - channels
narrativeTemplate:
  prefix: "Use Slack MCP"
  suffix: "to interact with the workspace"
---

# Slack MCP

Slack workspace integration via the official MCP server. Read channels, send messages, manage threads, and search conversation history.

## When to use

- Reading channel messages for context on discussions
- Sending status updates or notifications
- Searching conversation history for decisions or links
- Managing threads and replies

## Configuration

```json
{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-bot-token",
        "SLACK_TEAM_ID": "T0123456789"
      }
    }
  }
}
```

## Environment variables

- `SLACK_BOT_TOKEN` — Bot token with `channels:history`, `channels:read`, `chat:write` scopes
- `SLACK_TEAM_ID` — Slack workspace/team ID
