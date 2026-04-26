---
name: generate-files
description: Write the actual .agentflow/ directory structure
context:
  inputs: [output.graph, output.resources]
---

# Generate Files

Generate the AgentFlow directory structure from {{<< output.graph}} and {{<< output.resources}}.

## Process

1. Create AGENTS.md with identity and workflow-scoped instruction refs
2. Create workflow-scoped instructions/ if needed
3. For each node, create `node-name/SKILL.md` with:
   - Proper frontmatter (name, description, context, outputs)
   - Resource references using `{{ref}}` syntax
   - Data flow using `{{<< output.node}}` syntax
   - Conditional edges using `{{-> target | condition}}` syntax
4. Create any context files (extra .md files in node directories)

Use {{capabilities/write-file}} to create all files. Follow {{instructions/agentflow-authoring}} for format conventions.
