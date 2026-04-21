---
name: generate-workspace
description: Write all files to disk and validate the workspace
type: step
agent: workspace-builder
model: claude-sonnet
context:
  max_tokens: 2000
  inputs:
    - ref: capabilities/write-file
      scope: full
    - ref: capabilities/get-diagnostics
      scope: signature
    - ref: memory/decisions
      scope: full
  exclude:
    - instructions/requirements-elicitation
    - instructions/task-decomposition
    - instructions/prompt-engineering
    - instructions/api-design
outputs:
  - name: workspace-path
    format: text
---

# Generate Workspace

The design is approved. Write everything to disk.

## Step 1: Create the directory structure

```
.agentflow/
  AGENTS.md
  mcp.json                  ← only if MCP capabilities were selected
  capabilities/
  instructions/
  runbooks/
  memory/
  hooks/
  <workflow-name>/
    AGENTS.md
    <node-id>/SKILL.md
```

Use {{capabilities/write-file}} for every file.

## Step 2: Write the root AGENTS.md

Include:
- `type: agents` in frontmatter
- The identity from the customize-identity phase
- A list of workflows with `{{-> nodes/...}}` refs
- References to global capabilities, instructions, and memory

## Step 3: Write the workflow AGENTS.md

Include:
- `type: agents` in frontmatter
- A summary of each node with `{{-> nodes/...}}` refs
- References to capabilities and instructions used across the workflow

## Step 4: Write each node's SKILL.md

For step nodes:
- `type: step` in frontmatter, `entry: true` on the entry node
- `context.inputs` listing the capabilities and instructions this node needs
- `context.exclude` listing resources that belong to other nodes
- The instructions from the design phase
- Edge refs at the bottom

For router nodes:
- `type: router` in frontmatter
- The routing conditions as conditional edge refs
- Zero capability refs, zero instruction refs

## Step 5: Write resource files

- Capability files: copy from library or create stubs for custom/MCP tools
- Instruction files: copy from library
- Runbook files: copy conditions and interactions from library
- Memory files: create with standard structure
- Hook files: create as JSON

## Step 6: Write mcp.json (if needed)

Use `${env:VAR}` tokens for secrets — never hardcode API keys.

## Step 7: Validate

Use {{capabilities/get-diagnostics}} to check:
- All `{{ref}}` tokens resolve to files that exist
- Exactly one entry node per workflow
- Router nodes have zero capabilities and zero instructions
- No orphan nodes (every node reachable from entry)

If validation fails, fix the issues and re-validate.

## Step 8: Report

Tell the user:
- How many files were created
- How many nodes, capabilities, instructions, runbooks
- Any validation warnings
- What to do next (e.g. "configure your MCP server API keys")

Record what was generated in {{memory/decisions}}.

## If something goes wrong

Don't silently skip files. Report the error, explain what happened, and suggest a fix.

## Next

→ {{-> nodes/validate-and-fix}}
