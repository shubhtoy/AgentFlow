---
type: memory
name: decisions
editable: true
---
# Decisions

Important architectural, technical, and process decisions along with their reasoning. This prevents re-debating settled questions and gives future sessions the context behind past choices.

## What Belongs Here
- Architecture choices (monolith vs microservices, database selection, API style)
- Tooling choices (framework, build tool, test runner, linter)
- Process decisions (branching strategy, deploy process, review requirements)
- Trade-off decisions where alternatives were explicitly considered

## Format

```
[YYYY-MM-DD] Decision: <what was decided>
Reason: <why this option was chosen>
Alternatives: <other options considered and why they were rejected>
Status: active | superseded | revisit
```

## Read Instructions
- Read at the start of every session to understand prior decisions
- Read before proposing changes to architecture, tooling, or process — a decision may already exist
- Search by keyword when a user asks "why do we…" or "why did we choose…"

## Write Instructions
- Write whenever the user explicitly decides between alternatives
- Write when an architectural or tooling choice is made that future sessions should respect
- Update an existing entry's `Status` to `superseded` if a newer decision replaces it — don't delete the old one, the reasoning history matters
- Do NOT duplicate — check existing entries before adding

## Example Entries

```
[2025-06-15] Decision: Use Fastify instead of Express for the API server
Reason: Fastify has built-in schema validation, better performance, and native async support.
Alternatives: Express (larger ecosystem but slower), Koa (lighter but less plugin support)
Status: active

[2025-07-02] Decision: Store workflow state as flat JSON files, not SQLite
Reason: Keeps the project dependency-free and makes version control trivial.
Alternatives: SQLite (better querying but adds a binary dep), LevelDB (overkill for this scale)
Status: active

[2025-08-01] Decision: Migrate from flat JSON to SQLite for workflow state
Reason: JSON files don't scale past ~500 workflows; concurrent writes cause corruption.
Alternatives: Staying with JSON (too fragile), PostgreSQL (overkill for local-first tool)
Status: active
[Note: Supersedes 2025-07-02 decision]
```
