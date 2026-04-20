---
name: validation
scope: workflow
description: "Part 14: Validation & quality — checks, severity levels, common errors and fixes"
tags:
  - guide
  - validation
  - quality
  - errors
  - strict-mode
---

# Part 14 — Validation & Quality

AgentFlow validates workspaces at multiple levels. Validation is permissive by default — most issues are warnings. Strict mode promotes them to errors.

## Running Validation

```bash
node src/cli.js validate path/to/.agentflow
# or with strict mode:
node src/cli.js validate path/to/.agentflow --strict
```

## What Gets Checked

### Always Errors (even in permissive mode)

| Check | What it catches |
|-------|----------------|
| Broken refs | A `{{ref}}` that doesn't resolve to any file |
| Missing required frontmatter | e.g., `name` on conditions, `check` on conditions |
| Invalid frontmatter types | e.g., string where integer expected |
| Missing entry point | No node marked `entry: true` in a workflow |

### Warnings (errors in strict mode)

| Check | What it catches |
|-------|----------------|
| Schema violations | Frontmatter fields that don't match expected schema |
| Cycles detected | Informational — cycles are valid but noted |
| Unreachable nodes | Nodes with no incoming edges and not marked as entry |
| Unknown category prefixes | Refs using unrecognized category names |
| Context budget exceeded | Declared `max_tokens` vs. estimated actual |
| Missing output directories | Nodes declaring outputs without `output/` dirs |
| Identity structure | Root AGENTS.md missing identity block |
| MCP server refs | Tool files referencing servers not in `mcp.json` |
| Variable format | `env` fields not following `${env:VAR}` format |

## Validation Summary Table

| Check | Scope | Default severity |
|-------|-------|-----------------|
| Ref resolution | All refs in all files | Error |
| Frontmatter schema | All typed resources | Warning |
| Cycle detection | Workflow graphs | Warning (informational) |
| Unreachable nodes | Workflow graphs | Warning |
| Entry point existence | Each workflow | Error |
| Context budget | Nodes with `max_tokens` | Warning |
| Output declarations | Nodes with `outputs` | Warning |
| Identity structure | Root AGENTS.md | Warning |
| MCP server refs | Tool files with `type: mcp` | Warning |
| Variable format | `env` fields in mcp.json | Warning |

## Common Validation Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Broken ref: {{capabilities/foo}}` | No file at `capabilities/foo.md` | Create the file or fix the ref name |
| `No entry point in workflow X` | No node has `entry: true` | Add `entry: true` to the first node's frontmatter |
| `Router node has capabilities` | Router references tools | Remove tool refs or change type to `step` |
| `MCP server not found: X` | Capability references server not in `mcp.json` | Add the server to `mcp.json` |
| `Context budget exceeded` | Node + refs > declared `max_tokens` | Split the node or reduce refs |

---

Next: [Branding & Customization](15-branding.md)
