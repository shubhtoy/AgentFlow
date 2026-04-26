---
name: postgres-mcp
type: mcp
mcp: "@modelcontextprotocol/server-postgres"
description: PostgreSQL database access via MCP. Inspect schemas, run read-only queries, and explore database structure.
parameters:
  query:
    type: string
    description: SQL query to execute (read-only by default)
    required: true
outputs:
  - rows
  - columns
  - row_count
narrativeTemplate:
  prefix: "Query Postgres with"
  suffix: "to retrieve data"
---

# PostgreSQL MCP

PostgreSQL database access via the official MCP server. Provides schema inspection and read-only query execution for safe database exploration.

## When to use

- Exploring database schema and table structures
- Running SELECT queries to understand data
- Inspecting indexes, constraints, and relationships
- Generating reports or data summaries from the database

## Configuration

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y", "@modelcontextprotocol/server-postgres",
        "postgresql://user:password@localhost:5432/dbname"
      ]
    }
  }
}
```

The connection string is passed as a positional argument. Use environment variables for credentials in production.

## Environment variables

None required directly. Pass credentials via the connection string or use `PGPASSWORD`, `PGUSER`, `PGHOST`, `PGDATABASE` standard PostgreSQL env vars.
