# Agent Context — Read These First

You are continuing work on AgentFlow, a visual AI agent workflow orchestration platform. Before doing anything, read these documents in order to understand the current state, what's been done, and what's planned.

## Documents to Read (in order)

1. **`FEATURE-MAP.md`** — What the platform can do right now. Living feature inventory organized by area (Canvas, Panels, Git, Export, Copilot, Docs, CLI, etc.)

2. **`RELEASE-KANBAN.md`** — Original release kanban with To Do / In Progress / Completed items. Some items are stale — cross-reference with PRODUCTION-DEPLOYMENT-TASKS.md for what's actually done.

3. **`PRODUCTION-DEPLOYMENT-RESEARCH.md`** — Deep research on 5 work areas: Git Panel, API routes, Flow agent, package structure, fumadocs integration. Contains findings that drove all implementation decisions.

4. **`PRODUCTION-DEPLOYMENT-TASKS.md`** — Phased task list. All 3 phases are COMPLETE (Phase 1: Git Panel redesign, Phase 2: API route consolidation, Phase 3: Fumadocs CSS migration). Also has Future Work section (Skills redesign, safePath, dead code cleanup — all done now).

5. **`PLATFORM-QUIRKS.md`** — Running backlog of small UI/UX issues, polish items, and minor features noticed during development. Check what's still relevant.

6. **`DOCS-CHECKLIST.md`** — Per-page audit of all 94 fumadocs MDX pages. P0 items are done. P1 and P2 items remain (component upgrades, consistency passes).

7. **`V3-ENGINE-RETHINK.md`** — PARKED proposal for rethinking the core engine. Key ideas: path-based scoping (directory = scope), deprecating `skills/` category, adding `skills/` category for Agent Skills spec, conditions moving into router node directories. Needs proper design before implementation. DO NOT start coding this without discussion.

## Key Architecture Facts

- **Monorepo**: `packages/core` (browser-safe, no Node deps) + `packages/cli` (Node.js, CLI, services) + `studio` (Next.js app)
- **Studio imports**: `@agentflow/core` for parser/validator/exporter, `@agentflow/cli` for services/git/mcp
- **All workspace operations are client-side**: parser runs in browser, workspace uses IDB/OPFS/File System Access API adapters
- **API routes**: 9 routes total — `/api/skills`, `/api/copilot`, `/api/git`, `/api/mcp`, `/api/copilotkit/*`, `/api/auth/*`, `/api/auth/device`, `/api/search`, `/api/config/mode`
- **CSS**: Tailwind v4, shadcn/ui with full `hsl()` color values (migrated from raw channels), fumadocs CSS presets integrated
- **Docs**: Fumadocs v16, 94 MDX pages, 15 global components, 7 remark plugins, search (fetch in dev, static Orama in prod)
- **Build**: `npx next build` passes clean with zero TS errors

## What Was Done This Session

- Fumadocs CSS migration (50 vars, imports, component registration, 70 MDX files cleaned)
- Git Panel redesign (SSH detection, two-layer auth, 4 sub-components)
- API route consolidation (12→9 routes)
- Canvas polish (node sizing, colors standardized via CSS vars, edge types, condition nodes, minimap)
- Export fixed (moved from broken server calls to client-side)
- All pre-existing TS errors fixed
- Fumadocs maxed out (all plugins, all components, remark/rehype)
- Custom Mermaid replaced with standard ```mermaid blocks
- Docs content fixes (architecture rewrite, docs.mdx rewrite, broken links, stale paths)
- safePath security enforcement
- Dead code cleanup (gitApi, old routes)
- Skills.sh deep research (API surface, CLI source, real skill analysis)
- Taxonomy research (industry standards audit across 10+ platforms)

## What's Remaining

- **DOCS-CHECKLIST.md P1/P2** — ~30 docs pages need component upgrades
- **Skills Discover feature** — researched but not built. See V3-ENGINE-RETHINK.md for taxonomy questions that need resolving first
- **V3 Engine Rethink** — parked. Needs proper design discussion before any implementation
- **PLATFORM-QUIRKS.md** — small polish items
- **RELEASE-KANBAN.md** — remaining items not covered by this session
