# AgentFlow Knowledge Index
# The agent greps this file to find format details, syntax, and examples on demand.
# Each section is self-contained — the agent reads only the section it needs.

## SECTION: workspace-structure
```
.agentflow/
  AGENTS.md              ← Identity + workflow discovery      (Layer 0, ~200-800 tok)
  mcp.json               ← MCP server configuration           (optional)
  capabilities/          ← Tool definitions: builtin, script, MCP
  instructions/          ← Reusable instruction modules (workflow + global)
  runbooks/              ← Routing conditions + human touchpoints
  memory/                ← Persistent state across sessions
  hooks/                 ← Event-driven automation (JSON)
  <workflow>/
    AGENTS.md            ← Workflow descriptor + node summaries (Layer 1)
    <node>/
      SKILL.md           ← Stage contract + instructions       (Layer 2)
      output/            ← Runtime artifacts                   (Layer 4, never loaded)
```

## SECTION: agents-md-frontmatter
```yaml
---
type: agents
name: your-workspace
description: One-sentence purpose
identity:
  name: Agent Name
  role: What it does
  personality: How it behaves
  constraints:
    - Hard rules
---
```
Body: workflows as `{{-> nodes/...}}` refs, capabilities, instructions, memory refs, boundaries, when-stuck rules.

## SECTION: skill-md-frontmatter
```yaml
---
name: gather-requirements
type: step                    # step | router | sub-workflow
entry: true                   # exactly 1 per workflow
agent: requirements-analyst   # optional persona
model: claude-sonnet          # optional preferred model
context:
  max_tokens: 3000
  inputs:
    - ref: instructions/requirements-elicitation
      scope: full             # full | summary | signature
    - ref: capabilities/read-code
      scope: signature
  exclude:
    - instructions/technical-design
outputs:
  - name: requirements-doc
    format: markdown
---
```

## SECTION: reference-syntax
Four types of references:
- `{{capabilities/read-code}}` — mention: load resource as context
- `{{instructions/code-search}}` — mention: load instruction
- `{{-> nodes/create-design}}` — edge: go here next
- `{{-> nodes/plan-tasks | runbooks/design-approved}}` — conditional edge: go here IF condition met
- `{{<< output.gather-requirements}}` — data flow: read output from previous node

Resolution: path match first (category/name.md), then frontmatter `name` fallback.

## SECTION: node-types
| Type | Purpose | Has capabilities? | Has instructions? |
|------|---------|-------------------|-------------------|
| step | Does work | Yes | Yes |
| router | Routes only | NO | NO |
| sub-workflow | Delegates | Inherited | Inherited |

Router nodes: zero capabilities, zero instructions, all outgoing edges must have conditions.

## SECTION: capability-frontmatter
Builtin:
```yaml
---
name: read-code
type: builtin
builtin_mapping: readCode
description: Read and analyze source code files
outputs: [source_code, file_structure]
---
```

Script:
```yaml
---
name: run-tests
type: script
command: npm test
outputs: [test_results, pass_count, fail_count]
---
```

MCP:
```yaml
---
name: source-agent
type: mcp
mcp: source-agent-server    # must match key in mcp.json
parameters:
  query: { type: string, required: true }
outputs: [relevant_files, code_snippets]
---
```

## SECTION: instruction-frontmatter
Workflow scope (loaded by specific nodes):
```yaml
---
name: requirements-elicitation
scope: workflow
domain: product-engineering
description: Transform requests into testable requirements
---
```

Global scope (auto-loaded every session):
```yaml
---
name: coding-standards
scope: global
inclusion: auto
description: Project-wide coding conventions
---
```

## SECTION: runbook-frontmatter
Condition (used in conditional edges):
```yaml
---
name: design-approved
type: condition
check: The user explicitly approved the design with no outstanding concerns
---
```

Interaction (human touchpoints):
```yaml
---
name: review-design
type: approval          # approval | freeform | choice | confirm
timeout: 300
---
```

## SECTION: hook-format
```json
{
  "name": "lint-on-save",
  "version": "1.0.0",
  "event": "fileEdited",
  "condition": { "field": "path", "operator": "matches", "value": "\\.(ts|js)$" },
  "action": { "type": "run-script", "target": "npm run lint" },
  "enabled": true,
  "priority": 100
}
```
Events: fileEdited, fileCreated, fileDeleted, preToolUse, postToolUse, workflowStarted, workflowCompleted, nodeEntered, nodeCompleted, memoryUpdated, session-end
Actions: trigger-workflow, run-script, notify, log
Operators: equals, contains, matches, startsWith, endsWith
Priority: 0-1000 (lower runs first)

## SECTION: mcp-json
```json
{
  "mcpServers": {
    "server-name": {
      "command": "command",
      "args": ["arg1"],
      "env": { "API_KEY": "${env:API_KEY}" },
      "required": true,
      "description": "What this server does"
    }
  }
}
```
Use `${env:VAR}` for secrets. `{rootDir}` replaced with workspace root.

## SECTION: memory-format
```yaml
---
name: decisions
editable: true
---
```
Files: MEMORY.md (instructions), user.md (preferences), decisions.md (choices), facts.md (domain knowledge), lessons.md (mistakes).
Rules: date-prefix entries [YYYY-MM-DD], be specific, never store secrets, prune stale info.

## SECTION: graph-patterns
Linear: req → design → tasks → implement → verify
Review gates: req → gate → design → gate → tasks
Rejection loops: gate --rejected--> req (revise)
Iteration: implement → gate --more--> implement, gate --done--> verify

## SECTION: token-estimation
~1 token ≈ 4 chars (English), ~3 chars (code)
Root AGENTS.md: ~200 tok
Workflow AGENTS.md: ~500-800 tok
Node SKILL.md: ~1000-3000 tok
Each instruction: ~300-800 tok
Each capability: ~100-300 tok
Total per active step: ~5k-8k tok
Split a node if total > 8k tokens.

## SECTION: validation-rules
Errors (will break):
- broken_ref: ref target doesn't exist
- broken_data_flow: data flow to non-existent node
- missing_condition: conditional edge references missing condition
- malformed_variable: ${...} token is syntactically broken
- no_entry_point: workflow has no entry node
- multiple_entry_points: workflow has >1 entry node

Warnings (won't break):
- router_non_conditional: router edge without condition
- router_has_capabilities: router with tools (should have none)
- router_has_instructions: router with instructions (should have none)
- ambiguous_ref: ref matches multiple files
- missing_mcp_server: MCP tool references undeclared server
- schema: frontmatter type/field issues
- unreachable: node with no incoming edges
- context_budget_high: max_tokens > 8000

## SECTION: library-resources
Capabilities (12): read-code, write-file, run-tests, get-diagnostics, web-search, git-history, source-agent, analyze-image, file-search, list-directory, grep-search, shell-exec
Instructions (12): requirements-elicitation, technical-design, task-decomposition, implementation-discipline, code-search, security-review, api-design, test-analysis, coding-standards, debugging, refactoring, prompt-engineering
Runbooks: 17 conditions + 12 interactions
Hooks (5): diagnostics-after-write, lint-on-save, test-on-change, security-scan-on-commit, memory-on-session-end
Memory (5): MEMORY, user, decisions, facts, lessons
Workflows (4): build-feature, code-review, interactive-assistant, agent-builder

## SECTION: builder-patterns
single · supervisor · router · handoff · pipeline · blackboard
