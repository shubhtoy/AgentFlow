---
name: validate-and-fix
description: Validate workspace, fix errors, optimize token budgets, report results
type: step
agent: qa-engineer
model: claude-sonnet
context:
  max_tokens: 2000
  inputs:
    - ref: capabilities/get-diagnostics
      scope: full
    - ref: memory/decisions
      scope: full
outputs:
  - name: validation-report
    format: json
---

# Validate & Fix

Workspace is generated. Now validate everything and fix issues in a loop.

## Step 1: Run validation

Use {{capabilities/get-diagnostics}} to check:
- All `{{ref}}` tokens resolve to existing files
- Exactly one entry node per workflow
- Router nodes have zero capabilities and zero instructions
- All conditional edges have matching runbook files
- No orphan nodes (every node reachable from entry)
- Data flow refs (`{{<< output.X}}`) point to nodes that produce that output
- MCP capabilities reference servers declared in mcp.json
- Sub-workflow nodes reference workflows that exist

## Step 2: Fix errors

For each error:
1. Identify the file and line
2. Determine the fix (missing file, wrong ref, bad frontmatter)
3. Apply the fix using write tools
4. Re-validate

**Loop until zero errors.** Warnings are OK to report but don't block.

## Step 3: Token budget check

For each node, estimate total context:
- Count tokens in SKILL.md + all `context.inputs` refs
- Flag any node exceeding 8000 tokens
- Suggest splits or scope reductions (`scope: summary` instead of `full`)

## Step 4: Report

Tell the user:
- Files created (count by type: nodes, capabilities, instructions, runbooks, hooks, memory)
- Validation: errors fixed, warnings remaining
- Token budgets per node
- MCP servers configured (and which env vars need setting)
- What to do next

Record results in {{memory/decisions}}.

## If validation keeps failing

After 3 fix attempts on the same error, stop and ask the user for help. Don't loop forever.

## Next

This is the final node. Workflow complete.
