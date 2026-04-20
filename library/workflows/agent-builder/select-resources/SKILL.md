---
name: select-resources
description: Pick capabilities, instructions, and runbooks from the library
type: step
agent: resource-curator
model: claude-sonnet
context:
  max_tokens: 2500
  inputs:
    - ref: instructions/task-decomposition
      scope: summary
    - ref: memory/decisions
      scope: full
  exclude:
    - instructions/requirements-elicitation
    - instructions/technical-design
    - instructions/prompt-engineering
outputs:
  - name: resource-selection
    format: json
---

# Select Resources

The intent is confirmed. Now pick the building blocks.

## What's available

### Capabilities (tools the agent can use)

From the library — pick what the workflow needs:
- File ops: `read-code`, `write-file`, `file-search`, `list-directory`, `grep-search`
- Execution: `run-tests`, `shell-exec`, `get-diagnostics`
- Intelligence: `source-agent` (MCP), `web-search`, `analyze-image`, `git-history`

If the agent needs something not in this list, mark it as `source: mcp` (needs an MCP server) or `source: custom` (user will define it).

### Instructions (reusable how-to guides)

Pick the ones relevant to the workflow's domain:
`requirements-elicitation`, `technical-design`, `task-decomposition`, `implementation-discipline`, `code-search`, `security-review`, `api-design`, `test-analysis`, `coding-standards`, `debugging`, `refactoring`, `prompt-engineering`

### Runbooks (routing conditions + human touchpoints)

For each review gate, pick:
- A **condition pair**: e.g. `design-approved` + `design-rejected`
- An **interaction**: e.g. `review-design`

Available conditions: `design-approved`, `design-rejected`, `requirements-approved`, `requirements-rejected`, `tasks-approved`, `tasks-rejected`, `tests-pass`, `tests-fail`, `all-tasks-done`, `more-tasks-remain`, `task-complete`, `task-failed`, `implementation-ready`, `intent-approved`, `intent-rejected`, `scaffold-approved`, `scaffold-rejected`

Available interactions: `review-design`, `review-requirements`, `review-tasks`, `review-intent`, `review-scaffold`, `checkpoint`, `collect-feedback`, `show-diff`, `escalate-to-human`, `confirm-destructive`, `session-ending`

### Memory

Recommend if the agent should persist state: `user`, `decisions`, `lessons`, `facts`

### Hooks

Recommend if automation helps: `diagnostics-after-write`, `lint-on-save`, `test-on-change`

## How to decide

- Match capabilities to what each workflow phase needs to do
- Match instructions to the domain expertise each phase needs
- Every review gate needs a condition pair + interaction
- Every iteration loop needs a termination condition
- If the agent calls external APIs, it needs MCP — note which env vars are required

Present your selection. Ask if they want to add, remove, or swap anything.

## Output

```json
{
  "capabilities": [
    { "name": "read-code", "source": "library" }
  ],
  "instructions": ["code-search", "security-review"],
  "runbooks": {
    "conditions": ["design-approved", "design-rejected"],
    "interactions": ["review-design"]
  },
  "memory": ["user", "decisions"],
  "hooks": ["diagnostics-after-write"],
  "mcpServers": {}
}
```

## Next

→ {{-> nodes/design-nodes}}
