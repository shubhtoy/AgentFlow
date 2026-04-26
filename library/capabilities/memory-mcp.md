---
name: memory-mcp
type: mcp
mcp: "@modelcontextprotocol/server-memory"
description: Persistent knowledge graph for storing entities, relationships, and observations across sessions. Use for long-term memory and context retention.
parameters:
  action:
    type: string
    description: "Action to perform: create_entities, create_relations, add_observations, search_nodes, open_nodes, delete_entities, etc."
    required: true
  entities:
    type: array
    description: Array of entity objects with name, entityType, and observations
    required: false
outputs:
  - result
  - entities
  - relations
narrativeTemplate:
  prefix: "Use memory MCP"
  suffix: "to persist knowledge"
---

# Memory MCP

Persistent knowledge graph for storing entities, relationships, and observations. Data persists across sessions in a local JSON file.

## When to use

- Remembering user preferences and project context across sessions
- Building a knowledge graph of codebase architecture
- Tracking decisions, rationale, and design choices
- Maintaining a persistent TODO or task list

## Configuration

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```

## Environment variables

None required. Data is stored in a local `memory.json` file in the working directory.
