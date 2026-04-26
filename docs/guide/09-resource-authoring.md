---
name: resource-authoring
scope: workflow
description: "Part 9: Authoring resources — capabilities, instructions, skills, memory"
tags:
  - guide
  - resources
  - capabilities
  - instructions
  - skills
  - memory
  - tools
---

# Part 9 — Resource Authoring

Resources are the shared building blocks that nodes reference. Each category has its own conventions.

## 9.1 — Capabilities (Tool Definitions)

Capabilities declare what the agent can do. They live in `capabilities/` and come in three types.

### Builtin — maps to agent runtime capability

```yaml
---
name: read-code
type: builtin
builtin_mapping: readCode
description: Read and analyze source code files, list directories, search for symbols.
outputs:
  - source_code
  - file_structure
narrativeTemplate:
  prefix: "Use"
  suffix: "to examine the source files"
---

# Read Code

Read and analyze source code files. Understands AST structure, can search
for symbols, and navigate definitions.
```

The `builtin_mapping` field tells the executor which internal function to use. Common mappings: `readCode`, `fsWrite`, `getDiagnostics`, `webSearch`.

### Script — runs a shell command

```yaml
---
name: run-tests
type: script
command: npm test
description: Execute the project test suite and return pass/fail results.
outputs:
  - test_results
  - pass_count
  - fail_count
narrativeTemplate:
  prefix: "Run"
  suffix: "after every logical change"
---

# Run Tests

Execute the project's test suite and return results.
Parses output for pass/fail counts and failure details.
```

### MCP — connects to an MCP server

```yaml
---
name: source-agent
type: mcp
mcp: source-agent-server
description: Semantic code search and architectural understanding
parameters:
  query:
    type: string
    description: Natural language query about the codebase
    required: true
  scope:
    type: string
    description: Limit search to a directory or file pattern
    required: false
  depth:
    type: string
    description: "shallow" for signatures, "deep" for full details
    required: false
outputs:
  - relevant_files
  - code_snippets
  - dependency_graph
narrativeTemplate:
  prefix: "Query"
  suffix: "to understand the codebase"
---

# Source Agent (MCP)

An MCP-powered tool that provides deep codebase intelligence.

## Configuration

The MCP server must be configured in `.agentflow/mcp.json`:

```json
{
  "mcpServers": {
    "source-agent-server": {
      "command": "uvx",
      "args": ["source-agent-mcp@latest"],
      "env": { "FASTMCP_LOG_LEVEL": "ERROR" }
    }
  }
}
```

Always document the MCP server configuration in the body of an MCP capability so users know how to set it up.

### Capability Frontmatter Reference

| Field | Type | When required | Purpose |
|-------|------|---------------|---------|
| `name` | string | Always | Tool identifier |
| `type` | `builtin` / `script` / `mcp` | Always | Execution type |
| `builtin_mapping` | string | When type=builtin | Maps to executor function |
| `command` | string | When type=script | Shell command to execute |
| `mcp` | string | When type=mcp | MCP server name (must match `mcp.json`) |
| `description` | string | Recommended | What this tool does |
| `parameters` | object | For MCP/script | Parameter definitions |
| `outputs` | string[] | Recommended | What this tool returns |
| `narrativeTemplate` | object | Optional | How to reference in prose (`prefix` + `suffix`) |

## 9.2 — Instructions (Reusable Instruction Modules)

Instructions are self-contained teaching documents. They should make sense without knowing which node references them. Two scopes exist:

### Workflow scope (default) — loaded by specific nodes

```yaml
---
name: requirements-elicitation
scope: workflow
domain: product-engineering
description: Systematic approach to gathering and structuring requirements
tags:
  - requirements
  - user-stories
  - acceptance-criteria
---

# Requirements Elicitation

Transform vague feature requests into precise, testable requirements.

## Process

### 1. Understand the Request
- What problem does this solve? Who has this problem?
- What does success look like from the user's perspective?
- What are the boundaries — what is explicitly NOT in scope?

### 2. Write User Stories
Use the format: "As a [role], I want [capability], so that [benefit]."
- Each story should be independently deliverable
- Each story should be testable

### 3. Define Acceptance Criteria
For each user story, write criteria using WHEN/THEN format:
- WHEN [condition], THEN [expected behavior]
- Cover happy path, edge cases, and error cases

## Anti-Patterns to Avoid
- Requirements that describe HOW instead of WHAT
- Acceptance criteria that can't be objectively verified
- Missing error/edge case handling
```

### Global scope — auto-loaded into every session

```yaml
---
name: coding-standards
scope: global
inclusion: auto
description: Project-wide coding conventions loaded into every agent session
---

# Coding Standards

These conventions apply to all code written in this workspace.

## General
- Use descriptive names — `getUserById` not `getU`
- One function does one thing
- Handle errors explicitly — no empty catch blocks
- Delete dead code. Don't comment it out.

## Functions
- Max 3 parameters. Use an options object for more.
- Max 30 lines per function. Extract helpers for complex logic.
- Return early for error cases (guard clauses)
```

**Key difference:** Global instructions use `inclusion: auto` in frontmatter and are loaded into every session automatically. Workflow instructions are loaded only when a node references them.

### Scope Inference Rules

When no explicit `scope` is set:

| Condition | Inferred scope |
|-----------|---------------|
| Frontmatter has `inclusion` field | `global` |
| Otherwise | `workflow` |

## 9.3 — Skills (Conditions & Interactions)

Skills serve two purposes: defining routing conditions and defining human touchpoints.

### Conditions — used in conditional edges

```yaml
---
name: design-approved
scope: condition
type: condition
check: The user has reviewed the technical design document and explicitly
       approved the architecture, data models, and API contracts with no
       outstanding concerns
---
```

The `check` field must be **unambiguous and evaluable**. The executor reads this to decide which edge to follow at a router node.

**Good:** `"The user explicitly approved the design with no outstanding concerns"`
**Bad:** `"The design seems okay"`

More examples:

```yaml
# skills/all-tasks-done.md
---
name: all-tasks-done
type: condition
check: Every task in the implementation plan has been completed and marked
       as done, all tests pass, and no diagnostics errors remain
---

# skills/tests-pass.md
---
name: tests-pass
type: condition
check: All tests in the full test suite pass with zero failures and zero
       diagnostics errors across all modified files
---
```

### Interactions — human touchpoints

```yaml
---
name: review-design
scope: interaction
type: approval
timeout: 300
---

# Review Design

Present the technical design document to the user for review.

## What to Present
- Architecture overview with component diagram
- Data models and type definitions
- API contracts (endpoints, request/response schemas)
- Key design decisions and alternatives considered

## User Options
- **Approve** — design is sound, proceed to task breakdown
- **Reject** — provide feedback on architecture or API design
- **Edit** — make direct changes to the design document
```

### Interaction Types

| Type | Purpose | User action |
|------|---------|-------------|
| `approval` | Present work for review | Approve / Reject / Edit |
| `freeform` | Ask an open-ended question | Free text response |
| `choice` | Present 2–4 options | Pick one |
| `confirm` | Yes/no checkpoint | Confirm / Cancel |

## 9.4 — Memory

Memory files are append-friendly persistent state. The agent reads them at session start and writes to them during work.

### Standard Memory Files

| File | Purpose |
|------|---------|
| `MEMORY.md` | Instructions for how to use the memory system (read once) |
| `user.md` | User preferences, conventions, working style |
| `decisions.md` | Important decisions and their reasoning |
| `lessons.md` | Mistakes made and what was learned |
| `facts.md` | Domain knowledge accumulated over time |

### Memory Rules

1. **Write early, write often.** If something seems worth remembering, save it.
2. **Be specific.** "User prefers tabs over spaces" is useful. "User has preferences" is not.
3. **Date your entries.** Prefix with `[YYYY-MM-DD]` so you know when you learned something.
4. **Prune stale info.** If something is no longer true, update or remove it.
5. **Never store secrets.** No API keys, passwords, tokens, or credentials.

### How Nodes Declare Memory Usage

In the node's instructions, be explicit:

```markdown
### Step 1: Load Context
Read {{memory/user}} to recall the user's preferences.
Read {{memory/decisions}} to check for relevant past decisions.

### Step 4: Record What You Learned
Write any useful facts to {{memory/facts}}.
Write any decisions made to {{memory/decisions}}.
```

---

Next: [Hooks & Event Automation](10-hooks.md)
