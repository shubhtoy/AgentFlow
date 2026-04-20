---
name: builder-scaffolding
scope: workflow
description: "Builder & scaffolding — conversational workspace generation through a 5-phase process"
tags:
  - guide
  - builder
  - scaffolding
  - generation
  - patterns
---

# Builder / Scaffolding

AgentFlow includes a conversational builder that generates complete workspaces through a 5-phase process.

## The Five Phases

| Phase | What happens | Schema |
|-------|-------------|--------|
| 1. Intent | Extract purpose, suggest pattern, ask clarifying questions | `IntentResponseSchema` |
| 2. Pattern | Confirm agent pattern, select tools and instructions | `ToolSelectionResponseSchema` |
| 3. Nodes | Generate node structure with edges | `NodeStructureResponseSchema` |
| 4. Review | Final review and modifications | `ReviewResponseSchema` |
| 5. Generate | Scaffold files to disk | `AgentScaffoldSchema` |

## Supported Agent Patterns

| Pattern | Description |
|---------|-------------|
| `single` | One agent, one workflow |
| `supervisor` | One agent orchestrates sub-agents |
| `router` | Dispatches to specialized agents based on input |
| `handoff` | Agents pass work to each other in sequence |
| `blackboard` | Agents share a common workspace/state |
| `pipeline` | Linear chain of processing stages |

## How It Works

### Phase 1: Intent Extraction

The builder analyzes the user's description and produces:
- A `purpose` statement (1–500 chars)
- A `suggestedPattern` from the six patterns above
- A `patternReason` explaining why that pattern fits
- Up to 3 `clarifyingQuestions` to refine the design
- A `suggestedName` (lowercase, hyphenated, max 64 chars)

### Phase 2: Tool & Instruction Selection

The user confirms or changes the pattern. The builder selects:
- **Tools** — from the library, MCP servers, or custom definitions
- **Instructions** — reusable instruction modules the workflow needs
- **Interactions** — human touchpoints (optional)
- **Memory** — persistent state files (optional)

### Phase 3: Node Structure

The builder generates the full graph:
- Each node gets an `id`, `name`, `nodeType` (step/router/sub-workflow), `entry` flag, `description`, tool list, instruction list, and full `instructions` text
- Edges connect nodes with optional conditions

### Phase 4: Review

The user reviews the complete scaffold. They can:
- Approve as-is
- Request modifications (add/remove/modify nodes, edges, tools, instructions, or identity)

### Phase 5: Generation

The validated scaffold is written to disk:
- Root `AGENTS.md` with identity and workflow refs
- Workflow `AGENTS.md` with node summaries
- One `SKILL.md` per node with full frontmatter and instructions
- Capability files for each tool
- Instruction files for each instruction module
- Memory files if requested

The builder validates the generated scaffold against `AgentScaffoldSchema` before writing, ensuring the workspace is valid from the start.

## Scaffold Schema Constraints

- `name`: lowercase alphanumeric + hyphens, 1–64 chars
- `description`: 1–500 chars
- `identity`: requires `name`, `role`, and `constraints` array
- `nodes`: each needs `id` (lowercase alphanumeric + hyphens), `nodeType`, `entry` boolean, and non-empty `instructions`
- `edges`: each needs `from` and `to` node IDs, optional `condition`
- `tools`: each needs `name` and `source` (`library`, `mcp`, or `custom`)

---

*This concludes the AgentFlow Authoring Guide. For the architectural philosophy behind these decisions, see [architecture.md](../architecture.md). For a condensed quick-reference, see [authoring-cheatsheet.md](../authoring-cheatsheet.md).*
