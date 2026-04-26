# MCP Specification Overview

Source: https://modelcontextprotocol.io/specification

## Protocol Basics

- **Wire format:** JSON-RPC 2.0
- **Direction:** Bidirectional — both client and server can send requests and notifications
- **Session lifecycle:** Initialize → exchange capabilities → operate → shutdown

## Initialization

Client sends `initialize` request with:
- Protocol version
- Client capabilities
- Client info (name, version)

Server responds with:
- Protocol version
- Server capabilities (tools, resources, prompts)
- Server info (name, version)

Client sends `initialized` notification to confirm.

## Capabilities

### Server Capabilities

| Capability | Description |
|-----------|-------------|
| `tools` | Server exposes callable tools |
| `resources` | Server exposes readable resources |
| `prompts` | Server exposes prompt templates |
| `logging` | Server can send log messages |

### Client Capabilities

| Capability | Description |
|-----------|-------------|
| `roots` | Client can provide filesystem roots |
| `sampling` | Client supports LLM sampling requests |

## Message Types

### Requests (expect a response)

- `tools/list` — List available tools
- `tools/call` — Invoke a tool
- `resources/list` — List available resources
- `resources/read` — Read a resource
- `resources/templates/list` — List resource templates
- `prompts/list` — List available prompts
- `prompts/get` — Get a prompt with arguments

### Notifications (no response expected)

- `notifications/initialized` — Client initialization complete
- `notifications/tools/list_changed` — Server's tool list changed
- `notifications/resources/list_changed` — Server's resource list changed
- `notifications/resources/updated` — A specific resource was updated

## Tool Call Flow

```
Client                          Server
  │                               │
  │  tools/call {name, arguments} │
  │──────────────────────────────►│
  │                               │ Execute tool
  │                               │
  │  result {content, isError?}   │
  │◄──────────────────────────────│
```

## Content Types

Tool results and resource contents use typed content blocks:

```json
{ "type": "text", "text": "Hello world" }
{ "type": "image", "data": "base64...", "mimeType": "image/png" }
{ "type": "resource", "resource": { "uri": "...", "text": "..." } }
```

## Transport Requirements

All transports must support:
- Sending and receiving JSON-RPC 2.0 messages
- Graceful shutdown
- Error propagation

Defined transports:
- **stdio** — stdin/stdout, newline-delimited JSON
- **SSE** — HTTP GET for SSE stream, HTTP POST for client messages
- **Streamable HTTP** — Single HTTP endpoint with bidirectional streaming

## Error Codes

Standard JSON-RPC 2.0 error codes plus MCP-specific codes:

| Code | Meaning |
|------|---------|
| -32700 | Parse error |
| -32600 | Invalid request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |
