# Production Deployment — Deep Research

> Generated 2026-04-21. Based on full codebase read of every relevant file.

---

## 1. Git Panel (`studio/components/GitPanel.tsx`)

### Current State
- **~250 lines**, single monolith component (`GitPanelContent`)
- Uses shadcn primitives (Button, Badge, Tooltip) but poorly structured
- Two internal helpers: `RepoCard`, `SectionHeader` — both inline, not reusable

### SSH Handling — Broken
- SSH is a **tiny green label**: `<Terminal size={10} /> SSH` — not a button, not clickable
- Shows only when `localMode` is true (detected from `/api/git/config`)
- **No SSH key detection** — never checks `~/.ssh/` for available keys
- **No credential display** — user has no idea what auth method is active or what's available
- **Auth priority is wrong** — OAuth/device flow buttons render first, SSH is an afterthought label

### Auth Flow
1. On mount: fetches `/api/git/config` for provider availability + `localMode`
2. On mount: fetches `/api/auth/session` for existing OAuth session
3. Falls back to `localStorage.getItem('af-git-token')` → validates against GitHub API
4. Three auth views: `buttons` (default), `device` (GitHub device flow), `pat` (token input)
5. Device flow: proxied through `/api/auth/device` (server-side, needs `GITHUB_CLIENT_ID`)

### What's Missing
- SSH key detection (check `~/.ssh/id_*` via API or client-side)
- Credential status display (which auth method is active, what keys exist)
- SSH-first priority (if SSH keys exist, show SSH as primary)
- Proper component decomposition (AuthSection, CredentialStatus, RepoList, CloneInput)
- Quality parity with MCPPanel/ValidationPanel

### Quality Reference — MCPPanel
MCPPanel is the gold standard in this codebase:
- **~600 lines** but cleanly decomposed: `ServerCard`, `RegistryCard`, `AddServerDialog`, `AddCustomDialog`, `ConfigureDialog`
- Each sub-component is self-contained with its own state
- Proper Tabs layout (Servers / Registry)
- Expandable cards with connection info, auth status, tools list, test results
- Env var status with ✓/✗ indicators per variable
- Transport type badges (HTTP/SSE/stdio)
- Search with debounce, empty states, loading states

### Quality Reference — ValidationPanel
- Clean decomposition: `IssueRow`, `WorkflowGroup`, `ValidationPanelContent`
- `memo()` on expensive components
- Filter chips (severity, workflow, type) with clear button
- Auto-validate on mount, external refresh via custom events
- Grouped by workflow with collapsible sections

---

## 2. API Routes

### Full Inventory (12 routes)

| Route | Method | Server-only? | What it does |
|-------|--------|-------------|--------------|
| `auth/[[...nextauth]]` | GET/POST | Yes (NextAuth) | OAuth redirect flow (GitHub, GitLab, Bitbucket) |
| `auth/device` | POST | Yes (needs CLIENT_ID) | GitHub device flow proxy — start + poll |
| `git/config` | GET | Partial | Returns provider availability + localMode flag |
| `copilot/keys` | GET/POST | Yes (reads .env.local) | API key management — read status, write keys |
| `copilot/model` | GET/POST | No (in-memory) | Model selection — list models, get/set current |
| `copilotkit/[[...path]]` | GET/POST | Yes (CopilotRuntime) | CopilotKit runtime endpoint with MCP wiring |
| `skills/search` | GET | No (proxy) | Proxy to `skills.sh/api/search` |
| `skills/preview` | POST | Yes (execSync, fs) | Runs `npx skills add` in temp dir, reads results |
| `skills/rollback` | POST | Yes (fs.rmSync) | Deletes skill dirs from `.agents/skills/` |
| `search` | GET | No | Fumadocs search — 4 lines, static |
| `config/mode` | GET | Partial | Returns `local` or `online` mode — 6 lines |
| `mcp` | GET/POST | Yes (fs, MCP SDK) | Full MCP management — config, add, remove, toggle, discover, test, search |

### Consolidation Opportunities

**skills/* → single route** (3→1)
- `skills/search` is a 10-line proxy — can be an action
- `skills/preview` is the heavy one (execSync) — stays server-only
- `skills/rollback` is 15 lines of fs.rmSync — can be an action
- Merge into `skills/route.ts` with `action` param: `search`, `preview`, `rollback`

**copilot/* → single route** (2→1)
- `copilot/keys` and `copilot/model` are both config management
- Merge into `copilot/route.ts` with `action` param: `keys-status`, `keys-update`, `model-list`, `model-set`

**Cannot consolidate:**
- `auth/*` — NextAuth needs its catch-all route structure
- `copilotkit/*` — CopilotKit needs its catch-all route
- `mcp` — already consolidated (single route with actions)
- `search` — fumadocs integration, 4 lines, leave it
- `config/mode` — 6 lines, leave it
- `git/config` — separate concern from auth

### Server-Only Routes (cannot move to client)
- `auth/device` — needs `GITHUB_CLIENT_ID` env var, CORS proxy
- `copilot/keys` — reads/writes `.env.local`, patches `process.env`
- `skills/preview` — runs `execSync('npx skills add ...')`
- `skills/rollback` — uses `fs.rmSync`
- `copilotkit/*` — CopilotRuntime is server-side
- `mcp` — uses `@agentflow/cli/mcp/config-manager` (Node fs)

---

## 3. Flow Agent (On-Platform AI)

### What Exists — Frontend (complete)

**CopilotProvider** (`studio/components/copilot/CopilotProvider.tsx`)
- Wraps app in `CopilotKitProvider` with `runtimeUrl="/api/copilotkit"`
- **`agent="none"`** — explicitly disables backend agent
- Suppresses agent connection errors silently
- Mounts: CopilotReadables, CopilotActions, CopilotToolRenderers, CopilotSuggestions, AgentStateSync

**CopilotReadables** (`CopilotReadables.tsx`)
- Exposes 5 context objects via `useAgentContext()`:
  1. Full parsed workspace graph (summarized)
  2. Rich selection context (what user is looking at)
  3. UI state (theme, active workflow, focus modal)
  4. Validation results
  5. MCP server config

**CopilotActions** (`CopilotActions.tsx`)
- 15 frontend tools via `useFrontendTool()`:
  - CRUD: createFile, editFile, deleteFile
  - Validate: validateWorkspace
  - Tokens: calculateTokens
  - Library: addFromLibrary
  - MCP: listMcpServers, toggleMcpServer, discoverMcpTools
  - UI: selectNode, selectResource, switchWorkflow, focusNode, setTheme
  - Memory: readMemory, writeMemory

**CopilotPanel** (`CopilotPanel.tsx`)
- Welcome screen with FlowAvatar, workflow picker, model picker
- `FlowPanelContent` wraps `<CopilotChat>` with thread persistence (sessionStorage)

**FlowChatPanel** (`FlowChatPanel.tsx`)
- Headless CopilotKit chat with custom message rendering

### What's Missing — Backend

**No agent.ts with actual logic.** The copilotkit route creates a bare `CopilotRuntime`:
```ts
const runtime = new CopilotRuntime({
  mcpApps: { servers: [...PRECONFIGURED_MCPS, ...getMcpServers()] },
})
```
No agent, no tools, no system prompt, no LangGraph.

**What needs to happen:**
1. Create `studio/lib/copilot/agent.ts` with workspace tools:
   - `readWorkspaceFile(path)` — read from .agentflow/
   - `listWorkspaceDirectory(path)` — list files
   - `searchWorkspace(query)` — grep content
   - `safePath(path)` — enforce .agentflow/ boundary
2. Wire agent into CopilotRuntime (replace `agent="none"`)
3. Add system prompt from `studio/lib/copilot/system-prompt.ts` (exists but unused)
4. LangGraph is optional — CopilotKit v2 can work without it using frontend tools only
5. Graceful degradation: if no API keys configured, show "Configure API keys in Settings"

### CopilotKit v2 Status
- **Imports are correct**: `@copilotkit/react-core/v2`, `@copilotkit/runtime/v2`
- **Frontend tools work** — 15 tools registered, all functional
- **Readables work** — 5 context objects exposed
- **Missing**: actual agent that uses these tools + context to respond intelligently

---

## 4. Package Structure

### Layout
```
packages/
  core/     @agentflow/core  — pure logic, no Node APIs
    src/
      parser-core.js, parser-browser.js, validator.js, exporter.js
      taxonomy.js, errors.js
      schemas/    (frontmatter, brand, agent, builder)
      transport/  (registry, adapter, pipeline, transforms, platforms/)
      services/   (validation-service, event-hook-engine)
      mcp/        (registry-client)
      utils/      (compatibility, narrative)

  cli/      @agentflow/cli   — Node.js, filesystem, CLI
    bin/cli.js               (47KB, commander-based)
    src/
      parser.js, branding.js, library.js, pretty-printer.js
      structured-exporter.js
      git/        (git-manager, config-manager, sync-engine, repo-scanner)
      mcp/        (config-manager, tool-provider, server-lifecycle, tool-scaffolder, unified-search)
      services/   (workflow, validation, template, export, import, git, scaffold-gen, instruction-manager, hook-registry, mcp-bridge)
      svc-utils/  (validate-path, file-io)
      transport/  (import-pipeline)
      utils/      (resolve-root)
```

### Studio Imports (8 files import from packages)
- `lib/api.ts` → `@agentflow/core/parser-browser`, `@agentflow/core/validator`
- `lib/service-context.ts` → `@agentflow/cli/services/*` (workflow, validation, template, export, git, scaffold-gen, instruction-manager, hook-registry, mcp-bridge)
- `lib/export-client.ts` → `@agentflow/core/transport/*` (registry, adapter-factory, export-pipeline)
- `lib/parse-client-files.ts` → `@agentflow/cli/parser`
- `lib/workspace/browser-adapter.ts` → `@agentflow/core/parser-core` (WORKSPACE_EXTENSIONS)
- `app/api/mcp/route.ts` → `@agentflow/cli/mcp/config-manager`, `@agentflow/core/mcp/registry-client`
- `app/api/copilotkit/route.ts` → `@agentflow/cli/mcp/config-manager`
- `app/api/skills/preview/route.ts` → `@agentflow/core/parser-core` (parseFrontmatter)

### Observations
- Clean split: core is browser-safe, cli is Node-only
- Studio uses `require()` (not import) for all package refs — works but not ideal for tree-shaking
- `lib/service-context.ts` imports 9 services from cli — this is the server-side service layer, only used by API routes
- No missing exports detected — all imports resolve

---

## 5. Fumadocs Integration (Studio Docs Route)

### Architecture
- Route group: `studio/app/(docs)/` with its own layout
- Content: `studio/content/docs/` — **94 MDX files** across 8 sections (getting-started, concepts, authoring, guides, studio, reference, contributing, troubleshooting)
- Source config: `studio/source.config.ts` → `fumadocs-mdx/config` with `defineDocs({ dir: 'content/docs' })`
- Loader: `studio/lib/docs-source.ts` → `fumadocs-core/source` loader with lucide icons plugin
- Generated: `studio/.source/` — auto-generated by fumadocs-mdx (dynamic.ts, browser.ts, server.ts, source.config.mjs)
- MDX processing: `next.config.ts` uses `createMDX()` from `fumadocs-mdx/next`
- Search: `app/api/search/route.ts` — fumadocs `createFromSource` (static search)
- LLMs.txt: `app/docs/llms.txt/route.ts` — fumadocs `llms()` helper

### CSS Problem — The Core Issue

**Current state:** `docs.css` is commented out:
```ts
// import './docs.css' // TODO: fix CSS isolation before re-enabling
```

**What `docs.css` contains:** Just a comment:
```css
/* Fumadocs CSS is loaded via app/globals.css to avoid a second Tailwind instance */
```

**What `globals.css` does:** Tries to scope studio styles away from docs:
```css
body:not(:has(#nd-docs-layout)) {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family: 'Roboto', system-ui, -apple-system, sans-serif;
}
```

**The problem:** Fumadocs uses its own CSS variable namespace (`--fd-*` prefix: `--color-fd-background`, `--color-fd-foreground`, etc.) but the project never imports fumadocs' CSS presets. The `globals.css` uses shadcn-style variables (`--background`, `--foreground`) without the `fd-` prefix. Fumadocs components render but inherit studio's CSS variables instead of their own design system.

### What Fumadocs Expects (Proper Setup)

Per fumadocs docs, `globals.css` should include:
```css
@import 'tailwindcss';
@import 'fumadocs-ui/css/shadcn.css';  /* ← adopts colors from shadcn theme */
@import 'fumadocs-ui/css/preset.css';  /* ← adds fd-* utilities, animations, typography */
```

The `shadcn.css` preset is specifically designed for projects already using shadcn/ui — it maps shadcn's CSS variables to fumadocs' `--fd-*` namespace. This is exactly our case.

### Studio Components in Docs

The docs embed live studio components via:
- `DocsShowcase` — wraps children in `.agentflow-studio`, loads a workflow into the store
- `ComponentPreview` — renders studio components in a bordered preview box
- `DocsPlayground` — interactive playground

These use `.agentflow-studio` class and `not-prose` to escape fumadocs typography. This pattern is correct and should continue working with proper fumadocs CSS.

### What's Broken
1. **No fumadocs CSS presets imported** — `fumadocs-ui/css/shadcn.css` and `fumadocs-ui/css/preset.css` are never imported
2. **`docs.css` is disabled** — commented out in layout.tsx
3. **CSS variable conflict** — studio uses `--background`, fumadocs expects `--fd-background`
4. **Studio body styles leak into docs** — the `:not(:has(#nd-docs-layout))` selector is a hack, not a proper solution
5. **Docs route may not even load** — if fumadocs components can't find their CSS variables, layout breaks

### Packages Installed
- `fumadocs-core@^16.8.0`
- `fumadocs-mdx@^14.3.1`
- `fumadocs-ui@^16.8.0`

### The Fix (Verified via dry run + real-world research)

**Root cause:** The project uses the **legacy shadcn/ui v3 HSL channel format** where CSS variables store raw channels (`--background: 40 20% 98%`) and wrap them in `hsl()` at usage (`hsl(var(--background))`). This format is deprecated. shadcn/ui itself migrated to full color values in its Tailwind v4 update. Fumadocs' `shadcn.css` preset expects variables to contain complete color values.

**The proper fix is a one-time migration of CSS variable format:**

1. Change `:root` and `.dark` variable definitions from raw channels to full `hsl()` values:
   ```css
   /* BEFORE (legacy v3 format): */
   --background: 40 20% 98%;
   
   /* AFTER (modern v4 format): */
   --background: hsl(40 20% 98%);
   ```

2. Update `@theme inline` to pass through directly (no `hsl()` wrapper):
   ```css
   /* BEFORE: */
   --color-background: hsl(var(--background));
   
   /* AFTER: */
   --color-background: var(--background);
   ```

3. Add fumadocs CSS imports:
   ```css
   @import 'fumadocs-ui/css/shadcn.css';
   @import 'fumadocs-ui/css/preset.css';
   ```

4. Fix all inline `hsl(var(--...))` usages in components and CSS.

**Files that need changes:**

| File | Occurrences | What to change |
|------|-------------|----------------|
| `studio/app/globals.css` | 31 | Variable definitions + `@theme inline` + body styles + border reset + React Flow + scrollbar + CSV table |
| `studio/components/ElementsView.tsx` | 5 | Inline styles: `hsl(var(--primary))` → `var(--primary)`, `hsl(var(--primary) / 0.1)` → `color-mix(in srgb, var(--primary) 10%, transparent)` |
| `studio/components/Canvas.tsx` | 1 | Inline style: `hsl(var(--border) / 0.3)` → `color-mix(in srgb, var(--border) 30%, transparent)` |

**Detailed globals.css changes:**

In `:root` block — 25 variables, change format:
```
--background: 40 20% 98%          → --background: hsl(40 20% 98%)
--foreground: 240 10% 10%         → --foreground: hsl(240 10% 10%)
--card: 40 15% 96%                → --card: hsl(40 15% 96%)
--card-foreground: 240 10% 10%    → --card-foreground: hsl(240 10% 10%)
--popover: 0 0% 100%              → --popover: hsl(0 0% 100%)
--popover-foreground: 240 10% 10% → --popover-foreground: hsl(240 10% 10%)
--muted: 40 10% 93%               → --muted: hsl(40 10% 93%)
--muted-foreground: 240 5% 45%    → --muted-foreground: hsl(240 5% 45%)
--border: 40 10% 90%              → --border: hsl(40 10% 90%)
--input: 40 10% 90%               → --input: hsl(40 10% 90%)
--ring: 220 90% 56%               → --ring: hsl(220 90% 56%)
--primary: 220 90% 56%            → --primary: hsl(220 90% 56%)
--primary-foreground: 0 0% 100%   → --primary-foreground: hsl(0 0% 100%)
--secondary: 40 10% 93%           → --secondary: hsl(40 10% 93%)
--secondary-foreground: 240 5.9% 10% → --secondary-foreground: hsl(240 5.9% 10%)
--accent: 40 10% 93%              → --accent: hsl(40 10% 93%)
--accent-foreground: 240 5.9% 10% → --accent-foreground: hsl(240 5.9% 10%)
--destructive: 0 84.2% 60.2%     → --destructive: hsl(0 84.2% 60.2%)
--destructive-foreground: 0 0% 98% → --destructive-foreground: hsl(0 0% 98%)
--success: 142 76% 36%            → --success: hsl(142 76% 36%)
--warning: 38 92% 50%             → --warning: hsl(38 92% 50%)
--node-step: 217 91% 60%          → --node-step: hsl(217 91% 60%)
--node-router: 271 91% 65%        → --node-router: hsl(271 91% 65%)
--node-sub-workflow: 172 66% 50%  → --node-sub-workflow: hsl(172 66% 50%)
```

Same for `.dark` block — 25 variables, same transformation.

In `@theme inline` — 25 lines, remove `hsl()` wrapper:
```
--color-background: hsl(var(--background))  → --color-background: var(--background)
--color-foreground: hsl(var(--foreground))  → --color-foreground: var(--foreground)
... (all 25 lines)
```

In body styles:
```
background-color: hsl(var(--background))  → background-color: var(--background)
color: hsl(var(--foreground))             → color: var(--foreground)
```

In scrollbar:
```
scrollbar-color: hsl(var(--border)) transparent  → scrollbar-color: var(--border) transparent
```

In border reset:
```
border-color: hsl(var(--border))  → border-color: var(--border)
```

In React Flow:
```
background: hsl(var(--background))  → background: var(--background)
```

In CSV table:
```
border: 1px solid hsl(var(--border))  → border: 1px solid var(--border)
background: hsl(var(--muted))         → background: var(--muted)
```

In CopilotKit overrides — the `color-mix` lines already use `var(--muted)` directly, but since `--muted` will now be `hsl(40 10% 93%)` (a valid color), `color-mix(in oklch, var(--muted) 50%, transparent)` will work correctly.

**Component inline style changes:**

`ElementsView.tsx`:
```
hsl(var(--primary))           → var(--primary)
hsl(var(--primary) / 0.1)    → color-mix(in srgb, var(--primary) 10%, transparent)
```

`Canvas.tsx`:
```
hsl(var(--border) / 0.3)     → color-mix(in srgb, var(--border) 30%, transparent)
```

**Also found:** Build currently fails on a TypeScript error in `copilotkit/route.ts` (CopilotRuntime constructor mismatch) — not CSS-related but needs fixing.
