# AgentFlow Studio — Feature Map

## Canvas
- Drag-and-drop node positioning with auto-layout (dagre)
- Three node types: Step (agent), Gateway (router), Sub-workflow
- Condition gate nodes rendered between conditional edges
- Custom edges: default (blue solid), condition-in (amber dashed), condition-out (amber solid)
- Node hover toolbar: Focus, Duplicate, Delete
- Minimap: pannable, zoomable, click-to-focus, selected node highlight
- Background dot grid, dark/light mode aware
- Spotlight mode: focus a node, dim others, highlight path
- Canvas context menu: add node, paste, fit view
- Edge click popover for editing conditions
- Empty state with onboarding prompts

## Explorer (Files Tab)
- File tree scoped to active workflow + shared resources
- Search/filter files
- New file, new folder, import files (drag-drop or file picker)
- Context menu: rename, duplicate, copy path, delete
- Category icons per resource type
- Drag-drop file import with conflict detection + preview

## Panels
- **Validation**: auto-validate, severity/type/workflow filters, click-to-navigate issues
- **MCP Servers**: add from registry, add custom, configure env vars, test connection, discover tools, enable/disable
- **Git**: two-layer auth (identity + transport), repo status, changes list, commit+push, clone
- **Protocols/Hooks**: view/edit hook JSON files
- **Tokens**: per-node, per-workflow, full workspace token calculation
- **Export**: raw, parsed, platform (7 targets), file tree preview, Monaco viewer, download ZIP

## Git Panel
- Two-layer auth: Identity (who you are) + Transport (how you clone/push)
- Identity: GitHub Device Flow (no server config needed), PAT (universal), OAuth (if env configured)
- Transport: SSH auto-detected from ~/.ssh keys (local mode), HTTPS+token fallback
- SSH keys detected automatically — used for clone/push after sign-in
- Provider auto-detection from repo URL (GitHub, GitLab, Bitbucket, Gitea)
- Repo card: branch, clean/dirty status, ahead/behind counts, sync/refresh
- Changes list: M/A/D file status, commit message input, commit+push
- Smart clone errors: distinguishes auth vs 404 vs network failures
- Env setup for OAuth (optional, per provider): `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`, `GITLAB_CLIENT_ID` + `GITLAB_CLIENT_SECRET`, `BITBUCKET_CLIENT_ID` + `BITBUCKET_CLIENT_SECRET`
- Env setup for Device Flow (optional): `GITHUB_CLIENT_ID` only (no secret)
- No env needed for PAT or SSH — works out of the box

## Node Detail
- NodeCard: inline editing, frontmatter form, markdown preview
- NodeFocusModal: full-screen node editor with Monaco
- FrontmatterForm: schema-driven form per node/resource type

## Copilot (Flow)
- CopilotKit v2 integration with frontend tools
- 15 tools: CRUD files, validate, tokens, library, MCP, UI navigation, memory
- 5 readables: workspace graph, selection context, UI state, validation, MCP servers
- Model picker with multi-provider support
- Welcome screen with workflow picker
- Tool renderers for visual tool execution feedback

## Export
- Raw: exact source files, refs untouched
- Parsed: refs resolved to file paths
- Platform: Kiro, Cursor, Claude Code, VS Code, Windsurf, OpenClaw, Agent Spec
- Client-side export pipeline (no server needed)
- Fidelity report per platform

## Library
- Pre-built workflows, instructions, capabilities, skills, memory, hooks
- Install from library via ActionBar dropdown
- Skills.sh search + install via npx

## Workspace
- Browser-based: IDB, OPFS, File System Access API adapters
- Git adapter for clone/push
- Sync engine between adapters
- Auto-create workspace with AGENTS.md on first load
- Template variable system (`{{$var}}`) resolved at export time

## Theming
- Light + dark mode with system detection
- 6 color palettes: default, midnight, forest, ocean, sunset, rose
- CSS variable-based, fumadocs-compatible (shadcn v4 format)
- CopilotKit theme bridge

## Keyboard Shortcuts
- Cmd+B: toggle left panel
- Cmd+J: toggle bottom panel
- Cmd+K: command palette
- Cmd+P: command palette (alt)
- Escape: close modals/panels

## Security
- safePath utility enforces workspace boundary on all filesystem operations
- API routes scoped: skills/rollback validates paths before deletion
- SSH key detection returns metadata only, never key content
- Session-scoped API keys in multi-user mode

## CLI (`npx agentflow`)
- init, parse, validate, graph, tokens, dry-run
- add, search, library
- export (raw, parsed, platform), import
- git, mcp subcommands
- dev (starts studio), dev --agent (studio + LangGraph)

## Docs
- Fumadocs-powered MDX site at /docs
- 94 pages across 8 sections
- Live studio component embeds (DocsShowcase)
- Search: fetch mode in dev, static (Orama advanced) in prod
- LLMs.txt endpoint at /docs/llms.txt
- Fumadocs MCP integration planned
- All fumadocs-ui components registered globally: Callout, Steps, Tabs, Files, Accordion, TypeTable, ImageZoom, InlineTOC, Banner, Card, Cards, CodeBlock, Heading
- Remark plugins: GFM, admonition (:::note), steps (:::steps), image optimization, npm tabs, mermaid code blocks, code tabs
- Rehype plugins: code highlighting, TOC generation
- Source plugins: lucide icons, status badges (new/beta/deprecated in sidebar)
- Custom components: Mermaid (chart prop), ComponentPreview, DocsShowcase, DocsPlayground

---

*Last updated: 2026-04-22*
