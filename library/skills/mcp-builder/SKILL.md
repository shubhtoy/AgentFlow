---
name: mcp-builder
description: Build Model Context Protocol (MCP) servers — protocol overview, tool and resource definitions, transport types (stdio, SSE, streamable HTTP), error handling, and testing strategies.
---

# MCP Builder

## What Is MCP

Model Context Protocol (MCP) is an open protocol that standardizes how AI applications connect to external tools and data sources. An MCP server exposes capabilities (tools, resources, prompts) that an AI client can discover and invoke.

Think of MCP as a USB-C port for AI — a standard interface that lets any compatible client use any compatible server without custom integration.

## Architecture

```
┌─────────────┐     MCP Protocol     ┌─────────────┐
│  AI Client   │ ◄──────────────────► │  MCP Server  │
│  (Host App)  │   JSON-RPC 2.0      │  (Your Code) │
└─────────────┘                       └──────┬───────┘
                                             │
                                      ┌──────▼───────┐
                                      │  External     │
                                      │  Services,    │
                                      │  APIs, DBs    │
                                      └──────────────┘
```

- **Client (Host):** The AI application that connects to MCP servers (e.g., Claude Desktop, VS Code, custom apps)
- **Server:** Your code that exposes tools, resources, and prompts
- **Transport:** The communication channel between client and server

## Core Concepts

### Tools

Tools are functions the AI can call. They perform actions and return results.

```typescript
server.tool(
  "search-issues",
  "Search for issues by query string",
  {
    query: z.string().describe("Search query"),
    status: z.enum(["open", "closed", "all"]).default("open")
      .describe("Filter by issue status"),
    limit: z.number().min(1).max(100).default(20)
      .describe("Maximum results to return")
  },
  async ({ query, status, limit }) => {
    const results = await issueTracker.search(query, { status, limit });
    return {
      content: [{
        type: "text",
        text: JSON.stringify(results, null, 2)
      }]
    };
  }
);
```

Tool design rules:
- **Name:** Verb-noun format, kebab-case (`search-issues`, `create-user`, `get-file`)
- **Description:** One sentence explaining what the tool does. This is how the AI decides whether to use it.
- **Parameters:** Use Zod schemas with `.describe()` on every parameter. The AI reads these descriptions.
- **Return value:** Always return structured content. Use `type: "text"` for most cases.
- **Errors:** Throw descriptive errors. The AI uses error messages to recover.

### Resources

Resources are data the AI can read. They are identified by URIs.

```typescript
server.resource(
  "project-readme",
  "file:///project/README.md",
  "The project README with setup instructions",
  async () => ({
    contents: [{
      uri: "file:///project/README.md",
      mimeType: "text/markdown",
      text: await fs.readFile("README.md", "utf-8")
    }]
  })
);
```

Resource design rules:
- Use meaningful URI schemes (`file://`, `db://`, `api://`)
- Resources are read-only — use tools for mutations
- Include MIME types for proper rendering
- Keep resource content reasonably sized — paginate large datasets

### Resource Templates

For dynamic resources, use URI templates:

```typescript
server.resourceTemplate(
  "issue-detail",
  "issues://{issueId}",
  "Get details for a specific issue",
  async ({ issueId }) => ({
    contents: [{
      uri: `issues://${issueId}`,
      mimeType: "application/json",
      text: JSON.stringify(await getIssue(issueId))
    }]
  })
);
```

### Prompts

Prompts are reusable prompt templates the AI can use:

```typescript
server.prompt(
  "code-review",
  "Review code for bugs, security issues, and style",
  { language: z.string(), code: z.string() },
  ({ language, code }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Review this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nFocus on: correctness, security, performance, readability.`
      }
    }]
  })
);
```

## Transport Types

### stdio (Standard I/O)

Communication over stdin/stdout. The simplest transport.

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "my-server", version: "1.0.0" });
// ... register tools, resources, prompts ...

const transport = new StdioServerTransport();
await server.connect(transport);
```

Use when: The client launches the server as a subprocess (most common for local tools).

### SSE (Server-Sent Events)

HTTP-based transport with SSE for server-to-client messages.

```typescript
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";

const app = express();

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  await transport.handlePostMessage(req, res);
});

app.listen(3001);
```

Use when: The server runs as a standalone HTTP service.

### Streamable HTTP

The newest transport. Single HTTP endpoint with bidirectional streaming.

Use when: You need a modern HTTP-based transport with full streaming support.

## Server Structure

### Recommended Project Layout

```
my-mcp-server/
  src/
    index.ts          # Entry point, server setup
    tools/            # Tool implementations
      search.ts
      create.ts
    resources/        # Resource implementations
      files.ts
    lib/              # Shared utilities
      client.ts       # External API client
  tests/
    tools.test.ts
    resources.test.ts
  package.json
  tsconfig.json
  README.md
```

### Server Initialization Pattern

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "my-server",
  version: "1.0.0"
});

// Register tools
server.tool("tool-name", "description", schema, handler);

// Register resources
server.resource("name", "uri", "description", handler);

// Connect transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Error Handling

Return errors as structured content, not exceptions, when the error is expected:

```typescript
server.tool("get-user", "Get user by ID", { id: z.string() },
  async ({ id }) => {
    const user = await db.findUser(id);
    if (!user) {
      return {
        content: [{ type: "text", text: `User ${id} not found` }],
        isError: true
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(user) }]
    };
  }
);
```

Throw exceptions for unexpected errors (bugs, infrastructure failures). The SDK will convert them to error responses.

## Testing

### Unit Test Tools Directly

```typescript
test("search-issues returns matching results", async () => {
  const result = await searchHandler({ query: "bug", status: "open", limit: 5 });
  expect(result.content[0].type).toBe("text");
  const data = JSON.parse(result.content[0].text);
  expect(data.length).toBeLessThanOrEqual(5);
});
```

### Integration Test with MCP Client

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

test("server responds to tool call", async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(clientTransport);

  const result = await client.callTool("search-issues", { query: "bug" });
  expect(result.content).toBeDefined();
});
```

### Manual Testing

Use the MCP Inspector:
```bash
npx @modelcontextprotocol/inspector node src/index.ts
```

This opens a web UI where you can call tools, read resources, and inspect responses.

## Design Checklist

- [ ] Every tool has a clear verb-noun name
- [ ] Every tool and parameter has a descriptive `.describe()` string
- [ ] Tools return structured content, not raw strings
- [ ] Errors include actionable messages
- [ ] Resources use meaningful URI schemes
- [ ] Large datasets are paginated
- [ ] Server handles graceful shutdown
- [ ] Tools are unit tested
- [ ] Integration tested with MCP client
- [ ] README documents all tools and resources
