---
name: authoring-checklist
scope: workflow
description: "Part 18: Complete authoring checklist — workspace, workflow, node, resource, and hook level checks"
tags:
  - guide
  - checklist
  - validation
  - quality
---

# Part 18 — Authoring Checklist

Use this when creating or reviewing a workflow. Every item maps to a validation rule or a best practice from this guide.

## Workspace Level

- [ ] Root `AGENTS.md` exists with `type: agents` frontmatter
- [ ] Root `AGENTS.md` has an `identity` block with name, role, and constraints
- [ ] Root `AGENTS.md` is under 800 tokens
- [ ] All `{{ref}}` tokens resolve to existing files
- [ ] `mcp.json` exists if any capabilities use `type: mcp`
- [ ] All refs use the current taxonomy: `capabilities/`, `instructions/`, `runbooks/`
  (not the old names: `tools/`, `skills/`, `templates/`, `interactions/`)

## Workflow Level

- [ ] Workflow directory has an `AGENTS.md` descriptor listing all nodes
- [ ] Exactly one node is marked `entry: true`
- [ ] Review gates exist between every major phase
- [ ] Rejection loops go back to the correct producing node
- [ ] Iteration loops have termination conditions (e.g., `all-tasks-done`)

## Node Level

- [ ] Every node has a Context Budget section with token estimates
- [ ] Every ref has resolve timing (now / on use / on write)
- [ ] Excluded refs are explicitly listed per node
- [ ] Active stage total (Layer 0 + 1 + 2 + resolved 3) is under 8k tokens
- [ ] Router nodes have zero capabilities and zero instructions
- [ ] Entry node is marked `entry: true` in frontmatter
- [ ] Data flow refs (`{{<< output.X}}`) point to nodes that produce output
- [ ] Edge refs (`{{-> nodes/X}}`) point to nodes that exist in the workflow
- [ ] `output/` directories exist for nodes that declare outputs

## Resource Level

- [ ] Every conditional edge has a matching runbook with a `check` field
- [ ] Runbook `check` fields are unambiguous and evaluable
- [ ] Capability files declare their type (`builtin`, `script`, or `mcp`)
- [ ] Script capabilities have a `command` field
- [ ] MCP capabilities have an `mcp` field matching a server in `mcp.json`
- [ ] MCP capabilities document their server configuration in the body
- [ ] Interaction runbooks declare their type (`approval`, `freeform`, `choice`, `confirm`)
- [ ] Instructions are self-contained — they make sense without the referencing node
- [ ] Global instructions use `inclusion: auto` in frontmatter
- [ ] Memory files are append-friendly with date-prefix conventions
- [ ] No secrets in any file (use `${env:VAR}` tokens in `mcp.json` instead)

## Hook Level

- [ ] Hooks use valid event names (see [Part 10](10-hooks.md))
- [ ] Hooks use valid action types (`trigger-workflow`, `run-script`, `notify`, `log`)
- [ ] Hook conditions use valid operators (`equals`, `contains`, `matches`, `startsWith`, `endsWith`)
- [ ] Hook priority is between 0 and 1000
- [ ] Disabled hooks are marked `"enabled": false` (not deleted)

---

Next: [Taxonomy Migration](19-taxonomy-migration.md)
