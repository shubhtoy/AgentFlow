---
name: codebase-explorer
type: mcp
mcp: codebase-explorer-server
description: MCP-powered codebase exploration for understanding project structure, patterns, and architecture before designing workflows
parameters:
  query:
    type: string
    description: Natural language query about the codebase (e.g. "what's the directory structure", "how does auth work", "list all API endpoints")
    required: true
  scope:
    type: string
    description: Limit exploration to a directory or file pattern
    required: false
  action:
    type: string
    description: "Specific action: list_directory, read_file, search_source, get_architecture"
    required: false
outputs:
  - relevant_files
  - code_snippets
  - architecture_notes
  - directory_structure
narrativeTemplate:
  prefix: "Explore"
  suffix: "to understand the project"
---

# Codebase Explorer (MCP)

<!-- NOTE FOR SHUBH:
     This is a placeholder. Replace the MCP server config below with your actual
     codebase explorer MCP server once ready. The capability interface is designed
     to work with any MCP server that provides:
     - list_directory / list_tools / list_commands
     - read_source_file / get_tool_source / get_command_source
     - search_source (grep across source tree)
     - get_architecture (high-level overview)

     The workflow-builder workflow references this capability in the
     research-codebase node. When you plug in your MCP, the workflow
     will use it to understand target projects before designing workflows.
-->

An MCP-powered tool for deep codebase exploration. Use this to understand a project's structure, patterns, and architecture before designing workflows for it.

## Capabilities

- Directory structure listing
- File reading with line ranges
- Source code search (regex across the tree)
- Architecture overview generation
- Tool and command discovery (for agent-based projects)

## When to Use

- During **extract-intent** to understand what the user's project does
- During **research-codebase** to map the project's structure and patterns
- During **design-workflow** to find existing patterns to follow
- During **generate-workspace** to verify generated files match project conventions

## Configuration

The MCP server must be configured in `mcp.json`:

```json
{
  "mcpServers": {
    "codebase-explorer-server": {
      "command": "node",
      "args": ["/path/to/your/mcp-server/dist/index.js"],
      "env": {
        "PROJECT_ROOT": "${env:PROJECT_ROOT}"
      }
    }
  }
}
```
