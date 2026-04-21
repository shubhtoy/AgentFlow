---
name: discover-skills
description: Search skills.sh for reusable skills and configure MCP servers for external tools
type: step
agent: skill-scout
model: claude-sonnet
context:
  max_tokens: 2500
  inputs:
    - ref: capabilities/web-search
      scope: signature
    - ref: capabilities/source-agent
      scope: full
    - ref: memory/decisions
      scope: full
outputs:
  - name: discovered-resources
    format: json
---

# Discover Skills & MCP

The intent is confirmed. Before picking resources manually, search for pre-built skills and external tool integrations.

## Step 1: Search skills.sh

Use {{capabilities/web-search}} to search `skills.sh` for skills matching the agent's domain. The registry has 34k+ community skills.

Search queries to try:
- The agent's domain (e.g. "code review", "data pipeline", "content writing")
- Specific capabilities needed (e.g. "github PR", "jira integration", "slack notify")
- The architecture pattern (e.g. "supervisor agent", "pipeline workflow")

For each relevant skill found, note:
- Name and description
- What capabilities/instructions it provides
- Whether it needs MCP or external APIs

## Step 2: Identify MCP needs

Based on the intent and discovered skills, determine which external services need MCP:

| Need | MCP Server | Env Vars |
|------|-----------|----------|
| GitHub access | github-mcp | `GITHUB_TOKEN` |
| Database queries | db-mcp | `DATABASE_URL` |
| Slack notifications | slack-mcp | `SLACK_TOKEN` |
| Custom API | custom-mcp | varies |
| Browser automation | browser-mcp | none |

For each MCP server needed, document:
- Server name and command/URL
- Required environment variables (use `${env:VAR}` tokens)
- Which capabilities it provides

## Step 3: Check for sub-workflow opportunities

If the agent's task has clearly separable phases that could be reused independently, suggest making them sub-workflows (`type: sub-workflow`). Examples:
- A "code-review" sub-workflow reusable across multiple parent workflows
- A "deploy-check" sub-workflow that any workflow can delegate to
- A "research" sub-workflow for gathering context

## Output

```json
{
  "skills": [
    { "name": "skill-name", "source": "skills.sh", "provides": ["capability-x"] }
  ],
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "server-package"],
      "env": { "API_KEY": "${env:API_KEY}" },
      "description": "What it does"
    }
  },
  "subWorkflows": [
    { "name": "code-review", "reason": "Reusable across multiple workflows" }
  ]
}
```

Present findings to the user. Ask if they want to include any of the discovered skills or MCP servers.

## Next

→ {{-> nodes/select-resources}}
