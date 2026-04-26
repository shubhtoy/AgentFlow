---
name: sentry-mcp
type: mcp
mcp: "@sentry/mcp-server"
description: Sentry error monitoring via MCP. Search issues, view stack traces, analyze error trends, and resolve incidents.
parameters:
  action:
    type: string
    description: "Action to perform: list_issues, get_issue, search_issues, get_event, list_projects, etc."
    required: true
  issueId:
    type: string
    description: Sentry issue ID
    required: false
  query:
    type: string
    description: Search query for filtering issues
    required: false
outputs:
  - result
  - issues
  - events
narrativeTemplate:
  prefix: "Use Sentry MCP"
  suffix: "to investigate errors"
---

# Sentry MCP

Sentry error monitoring via the official MCP server. Search issues, view stack traces, analyze error trends, and manage incidents.

## When to use

- Investigating production errors and exceptions
- Viewing stack traces to identify root causes
- Searching for error patterns across projects
- Checking error frequency and trends after deployments

## Configuration

```json
{
  "mcpServers": {
    "sentry": {
      "command": "npx",
      "args": ["-y", "@sentry/mcp-server"],
      "env": {
        "SENTRY_AUTH_TOKEN": "<your-sentry-auth-token>"
      }
    }
  }
}
```

## Environment variables

- `SENTRY_AUTH_TOKEN` — Sentry auth token with `project:read`, `event:read`, `org:read` scopes
