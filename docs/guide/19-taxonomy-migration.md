---
name: taxonomy-migration
scope: workflow
description: "Taxonomy migration reference — old to new directory names and reference syntax mapping"
tags:
  - guide
  - migration
  - taxonomy
  - legacy
---

# Taxonomy Migration Reference

If you're migrating from an older AgentFlow workspace that uses the previous directory names, use this mapping.

## Directory Migration

| Old directory | Old name | New directory | New category |
|---------------|----------|---------------|-------------|
| `tools/` | tool | `capabilities/` | capability (scope: descriptor) |
| `skills/` | skill | `instructions/` | instruction (scope: workflow) |
| `steering/` | steering | `instructions/` | instruction (scope: global) |
| `templates/` | template | `skills/` | skill (scope: condition) |
| `interactions/` | interaction | `skills/` | skill (scope: interaction) |
| `memory/` | — | `memory/` | *(unchanged)* |
| `hooks/` | — | `hooks/` | *(unchanged)* |
| `AGENTS.md` | — | `AGENTS.md` | *(unchanged)* |

## Reference Syntax Migration

| Old | New |
|-----|-----|
| `{{tools/read-code}}` | `{{capabilities/read-code}}` |
| `{{skills/code-search}}` | `{{instructions/code-search}}` |
| `{{templates/design-approved}}` | `{{skills/design-approved}}` |
| `{{interactions/review-design}}` | `{{skills/review-design}}` |

Old directory names are **not recognized** by the current parser. Files in them will be classified as untyped custom files.

## Scope Inference After Migration

| Category | Condition | Inferred scope |
|----------|-----------|---------------|
| **instructions** | Frontmatter has `inclusion` field | `global` |
| **instructions** | Otherwise | `workflow` |
| **capabilities** | Frontmatter `type` is `builtin`, `script`, `mcp`, or `package` | `descriptor` |
| **capabilities** | Otherwise | `config` |
| **skills** | Frontmatter `type` is `condition` | `condition` |
| **skills** | Otherwise | `interaction` |

Categories without scopes (`memory`, `hooks`) always return `null`.

---

Next: [Builder / Scaffolding](20-builder-scaffolding.md)
