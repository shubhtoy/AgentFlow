---
name: playwright-mcp
type: mcp
mcp: "@playwright/mcp"
description: Browser automation via Playwright MCP. Navigate pages, click elements, fill forms, take screenshots, and extract content from web pages.
parameters:
  action:
    type: string
    description: "Action to perform: navigate, click, fill, screenshot, get_text, evaluate, etc."
    required: true
  url:
    type: string
    description: URL to navigate to
    required: false
  selector:
    type: string
    description: CSS or accessibility selector for the target element
    required: false
outputs:
  - result
  - screenshot
  - page_content
narrativeTemplate:
  prefix: "Use Playwright MCP"
  suffix: "to automate the browser"
---

# Playwright MCP

Browser automation via the Playwright MCP server. Control a real browser to navigate pages, interact with elements, take screenshots, and extract content.

## When to use

- End-to-end testing of web applications
- Scraping dynamic content that requires JavaScript
- Taking screenshots for visual verification
- Filling forms and automating web workflows
- Debugging UI issues with live browser interaction

## Configuration

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp"]
    }
  }
}
```

## Environment variables

None required. Optionally set `DISPLAY` for headed mode on Linux.
