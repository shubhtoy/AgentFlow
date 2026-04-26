# AgentFlow Taxonomy Reference

AgentFlow uses 6 canonical resource categories. Old directory names (`tools/`, `skills/`, `steering/`, `interactions/`, `templates/`) are no longer recognized.

---

## Categories

| Category | Directory | Absorbs | Scopes | Default Scope |
|---|---|---|---|---|
| **instructions** | `instructions/` | skills + steering | `workflow`, `global` | `workflow` |
| **capabilities** | `capabilities/` | tools + protocols | `descriptor`, `config` | `descriptor` |
| **skills** | `skills/` | interactions + templates | `interaction`, `condition` | `interaction` |
| **memory** | `memory/` | *(unchanged)* | *(none)* | `null` |
| **hooks** | `hooks/` | *(unchanged)* | *(none)* | `null` |
| **identity** | `AGENTS.md` | *(unchanged)* | *(singular file)* | N/A |

---

## Directory Structure

```
.agentflow/
  AGENTS.md                      ← Identity (singular top-level file)
  instructions/                  ← Was: skills/ + steering/
    code-search.md                 scope: workflow
    coding-standards.md            scope: global
  capabilities/                  ← Was: tools/ + protocols/
    read-code.md                   scope: descriptor
    source-agent.md                scope: descriptor
  skills/                      ← Was: interactions/ + templates/
    checkpoint.md                  scope: interaction
    design-approved.md             scope: condition
  memory/                        ← Unchanged
    decisions.md
    lessons.md
  hooks/                         ← Unchanged
    on-file-edit.json
  <workflow>/                    ← Workflow graphs (unchanged)
    AGENTS.md
    <node>/SKILL.md
```

---

## Scope System

Each resource in `instructions/`, `capabilities/`, or `skills/` has a `scope` that distinguishes its sub-type. Scope is set via frontmatter or inferred automatically.

### Explicit Scope

Add `scope:` to frontmatter. It takes priority over inference.

```yaml
---
name: coding-standards
scope: global
---
```

### Scope Inference Rules

When no explicit `scope` is set, the system infers it:

| Category | Condition | Inferred Scope |
|---|---|---|
| **instructions** | Frontmatter has `inclusion` field | `global` |
| **instructions** | Otherwise | `workflow` |
| **capabilities** | Frontmatter `type` is `builtin`, `script`, `mcp`, or `package` | `descriptor` |
| **capabilities** | Otherwise | `config` |
| **skills** | Frontmatter `type` is `condition` | `condition` |
| **skills** | Otherwise | `interaction` |

Categories without scopes (`memory`, `hooks`) always return `null`.

---

## Frontmatter Conventions

### instructions/ (was skills/ + steering/)

**Workflow scope** (was "skill"):
```yaml
---
name: requirements-elicitation
domain: product-engineering
description: Transform vague requests into testable requirements
---
```

**Global scope** (was "steering"):
```yaml
---
name: coding-standards
inclusion: auto
description: Project-wide coding conventions
---
```

### capabilities/ (was tools/)

**Descriptor scope** — builtin:
```yaml
---
name: read-code
type: builtin
outputs: [source_code, file_structure]
---
```

**Descriptor scope** — MCP:
```yaml
---
name: source-agent
type: mcp
mcp:
  server: source-agent-server
  tool: query_codebase
parameters:
  query: { type: string, required: true }
outputs: [relevant_files, code_snippets]
---
```

**Descriptor scope** — script:
```yaml
---
name: run-tests
type: script
command: npm test
outputs: [test_results, pass_count, fail_count]
---
```

### skills/ (was interactions/ + templates/)

**Interaction scope** (was "interaction"):
```yaml
---
name: review-design
type: approval
timeout: 300
---
```

**Condition scope** (was "template"):
```yaml
---
name: design-approved
type: condition
check: The user explicitly approved the design with no outstanding concerns
---
```

### memory/

No scope. No changes from previous format.

### hooks/

JSON files. No scope. No changes from previous format.

---

## Reference Syntax

References use canonical category names:

```
{{instructions/code-search}}                          → mention (load resource)
{{capabilities/read-code}}                            → mention
{{skills/checkpoint}}                               → mention
{{-> nodes/create-design}}                            → edge (unchanged)
{{-> nodes/plan-tasks | skills/design-approved}}    → conditional edge
{{<< output.gather-requirements}}                     → data flow (unchanged)
```

---

## Migration: Old → New

| Old Name | Old Directory | New Category | New Directory |
|---|---|---|---|
| skill | `skills/` | instruction (scope: workflow) | `instructions/` |
| steering | `steering/` | instruction (scope: global) | `instructions/` |
| tool | `tools/` | capability (scope: descriptor) | `capabilities/` |
| protocol | `protocols/` | capability (scope: config) | `capabilities/` |
| interaction | `interactions/` | skill (scope: interaction) | `skills/` |
| template | `templates/` | skill (scope: condition) | `skills/` |
| memory | `memory/` | memory | `memory/` *(unchanged)* |
| hooks | `hooks/` | hooks | `hooks/` *(unchanged)* |
| identity | `AGENTS.md` | identity | `AGENTS.md` *(unchanged)* |

### Reference syntax migration

| Old | New |
|---|---|
| `{{tools/read-code}}` | `{{capabilities/read-code}}` |
| `{{skills/code-search}}` | `{{instructions/code-search}}` |
| `{{templates/design-approved}}` | `{{skills/design-approved}}` |
| `{{interactions/review-design}}` | `{{skills/review-design}}` |

This is a clean break. Old directory names are not recognized and files in them will fall into `customFiles`.
