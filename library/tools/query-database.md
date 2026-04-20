---
type: mcp
mcp: database
parameters:
  query:
    type: string
    description: "SQL query to execute (read-only)"
    required: true
  database:
    type: string
    description: "Database name or connection alias"
  limit:
    type: number
    description: "Maximum number of rows to return"
    default: 100
---
# Query Database

Run read-only SQL queries against a configured database. Returns results as JSON rows. Never runs mutations.
