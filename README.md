# AgentFlow

Directory-based agent workflow orchestration. Design, validate, and export agent workflows defined in markdown.

## What is it

AgentFlow lets you build AI agent workflows visually. Each workflow is a graph of nodes — steps, gateways, and sub-workflows — defined as markdown files in a `.agentflow/` directory. A visual studio lets you design, edit, and test workflows in the browser.

## Quick Start

```bash
git clone https://github.com/shubhtoy/agentflow.git
cd agentflow
npm ci               # fast, lockfile-exact install (~17s)
cp .env.example studio/.env.local
# edit studio/.env.local — add your API keys
npm run dev          # starts the studio at http://localhost:3000
```

> **Adding new dependencies?** Run `npm install <pkg> --workspace=studio` (or `--workspace=packages/core`), which updates `package-lock.json`. Then `npm ci` will work for everyone.

### Requirements

- Node.js 18+ (20 recommended)
- npm 9+

## Project Structure

```
packages/
  core/               # Parser, validator, schemas (TypeScript, no build step)
  cli/                # CLI services, exporters, MCP bridge (TypeScript, no build step)
studio/               # Visual editor (Next.js + ReactFlow)
library/              # Reusable templates, skills, instructions, hooks
tests/                # Unit, integration, property tests (vitest)
```

### Workspace layout (`.agentflow/` directory)

```
.agentflow/
  AGENTS.md           # Workspace identity
  build-feature/      # A workflow
    AGENTS.md         # Workflow descriptor
    step-1/SKILL.md   # A node
    step-2/SKILL.md
  instructions/       # Reusable instructions
  capabilities/       # Tool definitions
  skills/             # Conditions & interactions
  memory/             # Persistent context
  hooks/              # Event triggers
```

## Features

- **Visual workflow editor** — drag-and-drop nodes, connect edges, edit markdown
- **Markdown-native** — everything is `.md` files, version-controllable
- **Skills.sh integration** — search and install from 34k+ agent skills
- **Multi-platform export** — LangGraph, Claude, GitHub Actions
- **MCP support** — connect external tools via Model Context Protocol
- **Git integration** — sync, commit, push from the studio
- **AI copilot** — chat with your workflow, get suggestions

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the studio (Next.js dev server) |
| `npm run build` | Production build |
| `npm test` | Run all tests (vitest) |
| `npm run lint` | Lint packages |
| `npm run format` | Format with prettier |
| `npm run dashboard` | Regenerate the status dashboard (`studio/public/dashboard.html`) |
| `npm run docs:check` | Advisory check for durable docs worth consolidating |

## Environment Variables

Copy `.env.example` to `studio/.env.local` and fill in your API keys. The studio will start without them, but AI features (copilot, chat) require at least one LLM provider key.

## Dashboard

A living status snapshot (tests/lint/typecheck health, board progress, recent commits) is
deployed to GitHub Pages on every push to `main`: **https://shubhtoy.github.io/AgentFlow/**.
Not a project-management tool — just a quick-glance overview. Source: `scripts/generate-dashboard.js`.

## License

MIT
