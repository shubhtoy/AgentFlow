---
name: design-nodes
description: Design the full workflow graph — nodes, edges, conditions
type: step
agent: workflow-architect
model: claude-sonnet
context:
  max_tokens: 3000
  inputs:
    - ref: instructions/task-decomposition
      scope: full
    - ref: instructions/api-design
      scope: summary
    - ref: memory/decisions
      scope: full
  exclude:
    - instructions/requirements-elicitation
    - instructions/prompt-engineering
outputs:
  - name: node-graph
    format: json
---

# Design Nodes

Resources are confirmed. Now design the workflow graph.

## Rules

1. Each node gets a unique kebab-case ID
2. Exactly one node is the entry point
3. Three node types:
   - **step** — does work, uses tools, follows instructions
   - **router** — decision point only, zero tools, zero instructions
   - **sub-workflow** — delegates to another workflow
4. Add a review gate (router) between every major phase
5. Rejection loops go back to the producing node, not an earlier phase
6. Iteration loops must have a termination condition

## For each step node, write instructions that are:

- **Specific** — say exactly what to do, not "process the data"
- **Sequenced** — numbered steps in the order they should execute
- **Tool-aware** — reference which capability to use for each action
- **Bounded** — define what success and failure look like
- **Independent** — each node's instructions should make sense on their own

## For each router node:

- List the outgoing edges with their conditions
- Keep it minimal — routers just route, they don't think

## Common mistakes to avoid

- Router nodes with tools or instructions (they should have none)
- Missing termination conditions on loops (causes infinite execution)
- Rejection loops that go to the wrong node
- Nodes that try to do too much (split if instructions exceed ~3000 tokens)
- Vague instructions like "handle the response appropriately"

## Output

```json
{
  "identity": {
    "name": "Agent Name",
    "role": "What it does",
    "constraints": ["Never skip tests"]
  },
  "nodes": [
    {
      "id": "gather-requirements",
      "name": "Gather Requirements",
      "nodeType": "step",
      "entry": true,
      "description": "What this node does",
      "capabilities": ["read-code", "write-file"],
      "instructions": ["requirements-elicitation"],
      "nodeInstructions": "Step 1: ...\nStep 2: ..."
    }
  ],
  "edges": [
    { "from": "gather-requirements", "to": "review-gate" },
    { "from": "review-gate", "to": "design", "condition": "requirements-approved" },
    { "from": "review-gate", "to": "gather-requirements", "condition": "requirements-rejected" }
  ]
}
```

## Next

→ {{-> nodes/design-workflow}}
