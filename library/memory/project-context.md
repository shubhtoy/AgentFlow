---
type: memory
name: project-context
editable: true
---
# Project Context

Project-specific facts, conventions, and instructions that ALL contributors and agents should follow. The single source of truth for how this project works.

## What Belongs Here
- Build and test commands (`bun test`, `npm run lint`, etc.)
- Code conventions all contributors follow ("use bun not npm", "API routes use kebab-case")
- Architecture decisions that affect how code is written
- Tech stack facts (language, framework, database, deployment)
- Directory layout and module boundaries
- Naming conventions (file naming, variable naming, branch naming)
- Non-obvious project constraints or gotchas

## What Does NOT Belong Here
- Personal preferences (those go in user-preferences)
- Temporary session notes (those stay in session memory)
- Org-wide knowledge that applies across repos (those go in team-context)
- Editor/IDE preferences (not relevant to agents)

## Format

```
[YYYY-MM-DD] Category: <stack | convention | architecture | deployment | domain>
Fact: <concise statement>
```

## Read Instructions
- Read at the start of every session — this is your ground truth for the project
- Read before generating code to match established patterns
- Read before proposing changes to architecture or tooling — a convention may already exist

## Write Instructions
- Write when the user shares a project fact ("we use PostgreSQL", "deploys go through GitHub Actions")
- Write when you discover a non-obvious codebase pattern
- Update existing entries when facts change (e.g., migration from one DB to another)
- Do NOT record transient information — only stable, long-lived facts
- Do NOT duplicate — check existing entries first

## Example Entries

```
[2025-06-01] Category: stack
Fact: Backend is Node.js 20 with Fastify 5.x; frontend is React 19 with Vite and Tailwind CSS.

[2025-06-01] Category: convention
Fact: All service modules export a factory function that receives a config object. No singletons.

[2025-06-15] Category: convention
Fact: Test command is "bun test". Always run tests before committing.

[2025-07-01] Category: architecture
Fact: API routes live in src/routes/ with one file per resource. Validation uses Zod schemas from src/schemas/.
```
