---
name: notion-mcp
type: mcp
mcp: "@notionhq/mcp-server"
description: Notion workspace integration via MCP. Search, read, and create pages, manage databases, and query structured data.
parameters:
  action:
    type: string
    description: "Action to perform: search, get_page, create_page, query_database, update_page, list_databases, etc."
    required: true
  query:
    type: string
    description: Search query or database filter
    required: false
  pageId:
    type: string
    description: Notion page ID
    required: false
outputs:
  - result
  - pages
  - databases
narrativeTemplate:
  prefix: "Use Notion MCP"
  suffix: "to access the workspace"
---

# Notion MCP

Notion workspace integration via the official MCP server. Search, read, and create pages, manage databases, and query structured data.

## When to use

- Searching Notion for project documentation or specs
- Creating pages for meeting notes, design docs, or runbooks
- Querying databases for task tracking or inventory
- Reading existing pages for context

## Configuration

```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/mcp-server"],
      "env": {
        "NOTION_API_KEY": "<your-notion-integration-token>"
      }
    }
  }
}
```

## Environment variables

- `NOTION_API_KEY` — Internal integration token from [notion.so/my-integrations](https://www.notion.so/my-integrations). Must be connected to the target workspace pages.
