---
name: branding
scope: workflow
description: "Part 15: Branding & customization — config file, environment variables, schema constraints"
tags:
  - guide
  - branding
  - customization
  - white-label
---

# Part 15 — Branding & Customization

AgentFlow supports white-labeling through a branding system. You can customize the product name, directory name, and CLI command.

## Configuration Precedence

1. **Environment variables** (highest) — fatal if invalid
2. **Config file** — `agentflow.config.json` in the project root — non-fatal if invalid
3. **Defaults** — `name: "AgentFlow"`, `dir: ".agentflow"`, `cli: "agentflow"`

## Config File

Create `agentflow.config.json` in the parent directory of your `.agentflow/` workspace:

```json
{
  "name": "MyAgent",
  "dir": ".myagent",
  "cli": "myagent",
  "logo": "/path/to/logo.svg",
  "theme": "dark"
}
```

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `AGENTFLOW_BRAND_NAME` | Product name | `MyAgent` |
| `AGENTFLOW_DIR` | Workspace directory name | `.myagent` |
| `AGENTFLOW_CLI` | CLI command name | `myagent` |

## Schema Constraints

| Field | Type | Constraints |
|-------|------|-------------|
| `name` | string | 1–64 characters |
| `dir` | string | 1–64 characters, alphanumeric + `.` `_` `-` |
| `cli` | string | 1–32 characters, lowercase alphanumeric + `-` |
| `logo` | string | Optional path |
| `theme` | string | Optional theme name |

---

Next: [Import, Export & Sharing](16-import-export.md)
