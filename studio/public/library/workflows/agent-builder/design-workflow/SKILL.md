---
name: design-workflow
description: Design the full workflow graph — all node types, edges, conditions, data flows, and token budgets
type: step
agent: workflow-architect
model: claude-sonnet
context:
  max_tokens: 3500
  inputs:
    - ref: instructions/task-decomposition
      scope: full
    - ref: instructions/technical-design
      scope: summary
    - ref: memory/decisions
      scope: full
outputs:
  - name: workflow-design
    format: json
---

# Design Workflow

Resources and skills are confirmed. Now design the complete workflow graph using every relevant AgentFlow feature.

## Node Types — use all three

### Step nodes (`type: step`)
- Do work, use tools, follow instructions
- Each gets specific, sequenced, tool-aware instructions
- Declare `context.inputs` (what it needs) and `context.exclude` (what it doesn't)

### Router nodes (`type: router`)
- Decision points only — zero tools, zero instructions
- All outgoing edges must have conditions via `{{-> nodes/X | runbooks/condition}}`
- Use for review gates, classification, error handling

### Sub-workflow nodes (`type: sub-workflow`)
- Delegate to another workflow defined in the workspace
- Use `workflow: workflow-name` in frontmatter
- Great for reusable phases (review, deploy, research)

## Edge types — use all four

1. **Unconditional**: `{{-> nodes/next-step}}` — always go here
2. **Conditional**: `{{-> nodes/X | runbooks/condition}}` — go if condition met
3. **Data flow**: `{{<< output.previous-node}}` — read output from earlier node
4. **Rejection loop**: gate → producing node (not an earlier phase)

## Token budget planning

For each node, estimate context size:
- SKILL.md content: ~500-2000 tokens
- Each instruction ref: ~300-800 tokens
- Each capability ref: ~100-300 tokens
- Data flow inputs: ~200-1000 tokens

**Rule: if a node's total exceeds ~8000 tokens, split it.**

Set `context.max_tokens` in frontmatter for each node.

## Hooks to recommend

| Trigger | Hook | When |
|---------|------|------|
| After file writes | `diagnostics-after-write` | Agent writes code |
| After code changes | `lint-on-save` | Code quality matters |
| After test files change | `test-on-change` | Tests exist |
| On session end | `memory-on-session-end` | Memory is used |
| On commit | `security-scan-on-commit` | Security matters |

## Memory strategy

- `user.md` — if agent adapts to user preferences
- `decisions.md` — if agent makes choices that affect later runs
- `lessons.md` — if agent should learn from mistakes
- `facts.md` — if agent accumulates domain knowledge

## Output

```json
{
  "identity": { "name": "...", "role": "...", "constraints": [] },
  "nodes": [
    {
      "id": "gather-requirements",
      "name": "Gather Requirements",
      "nodeType": "step",
      "entry": true,
      "description": "...",
      "capabilities": ["read-code"],
      "instructions": ["requirements-elicitation"],
      "nodeInstructions": "Step 1: ...\nStep 2: ...",
      "contextMaxTokens": 3000,
      "contextInputs": [
        { "ref": "instructions/requirements-elicitation", "scope": "full" }
      ],
      "contextExclude": ["instructions/technical-design"]
    },
    {
      "id": "review-gate",
      "nodeType": "router",
      "description": "User approves requirements"
    },
    {
      "id": "research-phase",
      "nodeType": "sub-workflow",
      "workflow": "research",
      "description": "Delegates deep research to a sub-workflow"
    }
  ],
  "edges": [
    { "from": "gather-requirements", "to": "review-gate" },
    { "from": "review-gate", "to": "design", "condition": "requirements-approved" },
    { "from": "review-gate", "to": "gather-requirements", "condition": "requirements-rejected" }
  ],
  "dataFlows": [
    { "from": "gather-requirements", "to": "design", "output": "requirements-doc" }
  ],
  "hooks": ["diagnostics-after-write", "memory-on-session-end"],
  "memory": ["user", "decisions"],
  "mcpServers": {}
}
```

## Next

→ {{-> nodes/review-scaffold-gate}}
