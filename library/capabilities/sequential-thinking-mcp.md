---
name: sequential-thinking-mcp
type: mcp
mcp: "@modelcontextprotocol/server-sequential-thinking"
description: Structured step-by-step reasoning via MCP. Break down complex problems into sequential thought steps with revision and branching support.
parameters:
  thought:
    type: string
    description: The current thinking step content
    required: true
  thoughtNumber:
    type: number
    description: Current step number in the sequence
    required: true
  totalThoughts:
    type: number
    description: Estimated total steps (can be revised)
    required: true
  nextThoughtNeeded:
    type: boolean
    description: Whether another thinking step is needed
    required: true
outputs:
  - thought_chain
  - conclusion
narrativeTemplate:
  prefix: "Think through"
  suffix: "step by step"
---

# Sequential Thinking MCP

Structured step-by-step reasoning for complex problems. Supports revising earlier steps and branching into alternative reasoning paths.

## When to use

- Complex debugging that requires systematic analysis
- Architecture decisions with multiple trade-offs
- Multi-step planning where each step depends on prior conclusions
- Problems where you need to backtrack and revise assumptions

## Configuration

```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
```

## Environment variables

None required.
