---
type: script
command: "curl -sf {healthcheck_url} && echo 'healthy' || echo 'unhealthy'"
parameters:
  healthcheck_url:
    type: string
    description: "URL of the healthcheck endpoint"
    required: true
  timeout:
    type: number
    description: "Request timeout in seconds"
    default: 10
---
# Deploy Check

Verify deployment health by hitting the healthcheck endpoint. Returns healthy/unhealthy status.
