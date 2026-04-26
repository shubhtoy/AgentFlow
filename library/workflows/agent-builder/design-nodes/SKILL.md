---
name: design-nodes
description: Define the node graph — nodes, edges, conditions, data flow
context:
  inputs: [output.intent, output.resources]
outputs:
  - name: graph
    format: markdown
    description: Node graph with edges, conditions, and resource assignments
---

# Design Nodes

Design the workflow graph from {{<< output.intent}} and {{<< output.resources}}.

## Process

1. Define each node — name, description, what it does
2. Define edges — which node connects to which
3. Add conditions on edges where routing is needed (use `{{-> target | condition}}` syntax)
4. Add data flow where nodes consume upstream outputs (`{{<< output.node}}`)
5. Assign resources to each node — which skills, instructions, capabilities it references
6. Mark the entry point node (`entry: true`)
7. Set context budgets on heavy nodes (`context.max_tokens`)

## Router nodes

Nodes with conditional edges are automatically rendered as routers. Do NOT set `type: router` — it's inferred from the edges.

{{-> generate-files | graph design is complete}}
