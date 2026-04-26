---
name: fetch-mcp
type: mcp
mcp: "@modelcontextprotocol/server-fetch"
description: Make HTTP requests to fetch web content and APIs. Supports GET/POST with automatic content extraction and markdown conversion.
parameters:
  url:
    type: string
    description: URL to fetch
    required: true
  method:
    type: string
    description: "HTTP method: GET (default) or POST"
    required: false
  headers:
    type: object
    description: Request headers as key-value pairs
    required: false
  body:
    type: string
    description: Request body (for POST requests)
    required: false
outputs:
  - content
  - status_code
  - headers
narrativeTemplate:
  prefix: "Fetch"
  suffix: "to retrieve the content"
---

# Fetch MCP

Make HTTP requests to fetch web content and APIs. Automatically converts HTML to markdown for easier consumption. Respects robots.txt by default.

## When to use

- Fetching documentation or web pages for context
- Calling REST APIs to retrieve data
- Downloading configuration files or schemas
- Reading remote markdown or text content

## Configuration

```json
{
  "mcpServers": {
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    }
  }
}
```

## Environment variables

None required. Optionally set `HTTP_PROXY` / `HTTPS_PROXY` for proxy support.
