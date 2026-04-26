---
name: github-mcp
type: mcp
mcp: "@modelcontextprotocol/server-github"
description: GitHub integration via MCP. Manage repositories, issues, pull requests, Actions workflows, branches, and file contents.
parameters:
  action:
    type: string
    description: "Action to perform: create_issue, list_issues, create_pull_request, get_file_contents, search_repositories, list_commits, create_branch, etc."
    required: true
  owner:
    type: string
    description: Repository owner (user or org)
    required: false
  repo:
    type: string
    description: Repository name
    required: false
outputs:
  - result
  - metadata
narrativeTemplate:
  prefix: "Use GitHub MCP"
  suffix: "to interact with the repository"
---

# GitHub MCP

GitHub integration via the official MCP server. Provides full access to repositories, issues, pull requests, Actions, branches, and file contents.

## When to use

- Creating or triaging issues and pull requests
- Searching repositories or code on GitHub
- Reading file contents from remote repos
- Managing branches and reviewing commits
- Triggering or checking GitHub Actions workflows

## Configuration

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<your-github-pat>"
      }
    }
  }
}
```

## Environment variables

- `GITHUB_PERSONAL_ACCESS_TOKEN` — GitHub PAT with `repo`, `issues`, `actions` scopes
