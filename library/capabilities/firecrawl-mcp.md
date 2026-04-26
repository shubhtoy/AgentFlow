---
name: firecrawl-mcp
type: mcp
mcp: "@firecrawl/mcp"
description: Web scraping and crawling via MCP. Crawl websites, scrape pages, extract structured data, and convert content to markdown.
parameters:
  action:
    type: string
    description: "Action to perform: scrape, crawl, map, extract"
    required: true
  url:
    type: string
    description: URL to scrape or starting URL for crawling
    required: true
  formats:
    type: array
    description: "Output formats: markdown, html, rawHtml, links, screenshot"
    required: false
outputs:
  - content
  - links
  - metadata
narrativeTemplate:
  prefix: "Use Firecrawl MCP"
  suffix: "to scrape the content"
---

# Firecrawl MCP

Web scraping and crawling via the Firecrawl MCP server. Crawl entire sites, scrape individual pages, extract structured data, and convert web content to clean markdown.

## When to use

- Scraping documentation sites for offline reference
- Extracting structured data from web pages
- Crawling a site to build a sitemap or content index
- Converting web content to markdown for processing

## Configuration

```json
{
  "mcpServers": {
    "firecrawl": {
      "command": "npx",
      "args": ["-y", "@firecrawl/mcp"],
      "env": {
        "FIRECRAWL_API_KEY": "<your-firecrawl-api-key>"
      }
    }
  }
}
```

## Environment variables

- `FIRECRAWL_API_KEY` — API key from [firecrawl.dev](https://firecrawl.dev). Free tier available.
