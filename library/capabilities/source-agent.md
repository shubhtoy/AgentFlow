---
name: source-agent
type: mcp
mcp: source-agent-server
description: MCP-powered codebase intelligence agent that provides semantic code search, dependency analysis, and architectural understanding
parameters:
  query:
    type: string
    description: Natural language query about the codebase (e.g. "how does authentication work", "what calls the payment service")
    required: true
  scope:
    type: string
    description: Limit search to a directory or file pattern (e.g. "src/api/**", "tests/")
    required: false
  depth:
    type: string
    description: Analysis depth — "shallow" for signatures only, "deep" for full implementation details
    required: false
outputs:
  - relevant_files
  - code_snippets
  - dependency_graph
  - architectural_notes
narrativeTemplate:
  prefix: "Query"
  suffix: "to understand the codebase"
---

# Source Agent (MCP)

An MCP-powered tool that provides deep codebase intelligence. Unlike simple grep, this agent understands code semantics — it can trace call chains, identify architectural patterns, map dependencies, and answer natural language questions about the codebase.

## Capabilities

- Semantic code search (understands intent, not just text matching)
- Dependency graph traversal (who calls what, what imports what)
- Architectural pattern recognition (MVC, event-driven, microservices)
- Impact analysis (what breaks if I change this file)

## When to use

- During the **requirements** phase to understand existing behavior
- During the **design** phase to map dependencies and find integration points
- During the **implementation** phase to find similar patterns to follow
- During the **review** phase to verify no unintended side effects

## Configuration

The MCP server must be configured in your workspace's `mcp.json`:

```json
{
  "mcpServers": {
    "source-agent-server": {
      "command": "uvx",
      "args": ["source-agent-mcp@latest"],
      "env": { "FASTMCP_LOG_LEVEL": "ERROR" }
    }
  }
}
```
