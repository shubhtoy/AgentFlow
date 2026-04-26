---
name: docker-mcp
type: mcp
mcp: "@docker/mcp-server"
description: Docker container management via MCP. List, start, stop, inspect containers, view logs, and manage images.
parameters:
  action:
    type: string
    description: "Action to perform: list_containers, start_container, stop_container, container_logs, list_images, etc."
    required: true
  containerId:
    type: string
    description: Container ID or name
    required: false
outputs:
  - result
  - containers
  - logs
narrativeTemplate:
  prefix: "Use Docker MCP"
  suffix: "to manage containers"
---

# Docker MCP

Docker container management via the official Docker MCP server. List, start, stop, inspect containers, view logs, and manage images.

## When to use

- Listing running containers and their status
- Starting or stopping development containers
- Viewing container logs for debugging
- Inspecting container configuration and networking
- Managing Docker images

## Configuration

```json
{
  "mcpServers": {
    "docker": {
      "command": "npx",
      "args": ["-y", "@docker/mcp-server"]
    }
  }
}
```

## Environment variables

None required. Uses the local Docker socket (`/var/run/docker.sock`) by default. Set `DOCKER_HOST` to connect to a remote Docker daemon.
