---
type: script
command: "curl -sf -X {method} -H 'Content-Type: application/json' -d '{body}' {url}"
parameters:
  url:
    type: string
    description: "Full URL of the API endpoint"
    required: true
  method:
    type: string
    description: "HTTP method"
    enum: ["GET", "POST", "PUT", "PATCH", "DELETE"]
    default: "GET"
  body:
    type: string
    description: "JSON request body (for POST/PUT/PATCH)"
  headers:
    type: object
    description: "Additional HTTP headers as key-value pairs"
---
# Call API

Make HTTP requests to REST APIs. Supports GET, POST, PUT, PATCH, DELETE. Use for integrating with external services, webhooks, or internal microservices.
