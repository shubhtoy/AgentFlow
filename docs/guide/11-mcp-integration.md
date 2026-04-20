---
name: mcp-integration
scope: workflow
description: "Part 11: MCP integration — server configuration, capability linking, defaults, env tokens"
tags:
  - guide
  - mcp
  - model-context-protocol
  - tools
  - servers
---

# Part 11 — MCP Integration

The [Model Context Protocol](https://modelcontextprotocol.io) (MCP) is the standard for connecting AI agents to external tools and services. AgentFlow integrates MCP at two levels: tool declarations and server configuration.

## Server Configuration

MCP servers are configured in `.agentflow/mcp.json`:

```json
{
  "mcpServers": {
    "source-agent-server": {
      "command": "uvx",
      "args": ["source-agent-mcp@latest"],
      "env": {
        "GITHUB_TOKEN": "${env:GITHUB_TOKEN}",
        "FASTMCP_LOG_LEVEL": "ERROR"
      },
      "required": true,
      "description": "Semantic code search and architectural understanding"
    },
    "filesystem-server": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "{rootDir}"],
      "enabled": true,
      "description": "File system operations"
    }
  }
}
```

## Configuration Fields

| Field | Standard? | Purpose |
|-------|-----------|---------|
| `command` | Yes | Executable to run (stdio transport) |
| `args` | Yes | Command arguments |
| `env` | Yes | Environment variables |
| `url` | Yes | HTTP/SSE endpoint (alternative to command) |
| `enabled` | Yes | Toggle server on/off |
| `required` | AgentFlow extension | If `true`, workflow fails if server is unavailable |
| `description` | AgentFlow extension | Human-readable description |
| `autoApprove` | Extension | Tool names to auto-approve without user confirmation |

## Environment Variable Tokens

The `${env:VARIABLE_NAME}` syntax in `env` fields is preserved as a literal string in the config file. It is only resolved at connection time from `process.env`. **Secrets never appear in the config file.**

## Linking Capabilities to MCP Servers

A capability file with `type: mcp` references its server by name:

```yaml
---
name: source-agent
type: mcp
mcp: source-agent-server    # ← must match a key in mcp.json
parameters:
  query:
    type: string
    required: true
---
```

The `mcp` field must match a key in `mcp.json`. The validator warns if no matching server exists.

## Default MCP Servers

If no `mcp.json` or `protocols.json` exists, the runtime provides these defaults:

| Server | Package | Purpose |
|--------|---------|---------|
| `filesystem` | `@modelcontextprotocol/server-filesystem` | File system operations |
| `git` | `@modelcontextprotocol/server-git` | Git operations |
| `memory` | `@modelcontextprotocol/server-memory` | Persistent memory |
| `fetch` | `@modelcontextprotocol/server-fetch` | HTTP fetching |
| `sequentialthinking` | `@modelcontextprotocol/server-sequentialthinking` | Structured reasoning |

## Template Variables

Server args and env values support `{rootDir}` placeholders, which are replaced with the workspace root path at connection time.

---

Next: [The Pre-Shipped Library](12-library.md)
