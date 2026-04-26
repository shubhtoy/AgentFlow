---
name: filesystem-mcp
type: mcp
mcp: "@modelcontextprotocol/server-filesystem"
description: Sandboxed filesystem access via MCP. Read, write, search, and manage files within allowed directories.
parameters:
  action:
    type: string
    description: "Action to perform: read_file, write_file, list_directory, search_files, move_file, get_file_info, etc."
    required: true
  path:
    type: string
    description: File or directory path within the allowed directories
    required: true
outputs:
  - result
  - metadata
narrativeTemplate:
  prefix: "Use filesystem MCP"
  suffix: "to access files"
---

# Filesystem MCP

Sandboxed filesystem access via the official MCP server. Provides read, write, search, and directory operations restricted to explicitly allowed paths.

## When to use

- Reading or writing files outside the current workspace
- Searching across multiple project directories
- File management operations (move, copy, get info)
- When you need sandboxed filesystem access with explicit path allowlists

## Configuration

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y", "@modelcontextprotocol/server-filesystem",
        "/Users/you/projects",
        "/Users/you/documents"
      ]
    }
  }
}
```

The positional args after the package name are the allowed directories. The server will refuse access to paths outside these roots.

## Environment variables

None required. Access is controlled by the allowed directory arguments.
