---
type: script
command: "curl -sf {url} | head -c 50000"
parameters:
  url:
    type: string
    description: "URL to fetch content from"
    required: true
  max_bytes:
    type: number
    description: "Maximum bytes to return"
    default: 50000
---
# Fetch URL

Fetch content from a URL. Returns the first 50KB of the response body.
