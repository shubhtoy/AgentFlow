# AgentFlow

Directory-based agent workflow orchestration. Design, validate, and export agent workflows defined in markdown.

## What is it

AgentFlow lets you build AI agent workflows visually. Each workflow is a graph of nodes — steps, gateways, and sub-workflows — defined as markdown files in a `.agentflow/` directory. A visual studio lets you design, edit, and test workflows in the browser.

## Quick Start

```bash
npm install
cd studio && npm install
npm run dev
```

Open `http://localhost:3000`.

## Project Structure

```
.agentflow/           # Your workspace (workflows, resources, config)
  AGENTS.md           # Workspace identity
  build-feature/      # A workflow
    AGENTS.md         # Workflow descriptor
    step-1/SKILL.md   # A node
    step-2/SKILL.md
  instructions/       # Reusable instructions
  capabilities/       # Tool definitions
  runbooks/           # Conditions & interactions
  memory/             # Persistent context
  hooks/              # Event triggers

src/                  # Core engine (parser, validator, exporter)
studio/               # Visual editor (Next.js + ReactFlow)
library/              # Reusable templates & skills
```

## Features

- **Visual workflow editor** — drag-and-drop nodes, connect edges, edit markdown
- **Markdown-native** — everything is `.md` files, version-controllable
- **Skills.sh integration** — search and install from 34k+ agent skills
- **Multi-platform export** — LangGraph, Claude, GitHub Actions
- **MCP support** — connect external tools via Model Context Protocol
- **Git integration** — sync, commit, push from the studio
- **AI copilot** — chat with your workflow, get suggestions

## Environment Variables

Copy `.env.example` to `studio/.env.local` and fill in your API keys.

## License

MIT
