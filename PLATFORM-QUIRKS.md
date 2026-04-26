# Platform Quirks & Small Fixes Backlog

> Running list of small UI/UX issues, polish items, and minor features noticed during development. Not blockers — just things to circle back to.

---

## Canvas

- [ ] Minimap could be collapsible/toggleable (Figma-style) — currently always visible
- [ ] Minimap doesn't show edges — only nodes. React Flow limitation unless we use `nodeComponent` for custom SVG
- [ ] Node hover toolbar (Focus/Duplicate/Delete) appears above the node — can clip at canvas top edge
- [ ] Edge arrow markers still use hardcoded hex (`#f59e0b` / `#fbbf24`) — React Flow marker API needs literal values, can't use CSS vars
- [ ] Canvas background dots could be slightly more subtle in light mode
- [ ] No "fit to view" button on canvas (React Flow has `fitView()` — just needs a UI trigger)
- [ ] Drag-drop new node doesn't position where user dropped — lands at random position

## Nodes

- [ ] ResourceNode compact mode (dot) is very small — hard to click on touch devices
- [ ] WorkflowNode and ResourceNode share visual shell but are separate components — extract `BaseNodeCard` later
- [ ] No visual indicator for nodes with validation errors (could add red border or icon)

## Edges

- [ ] Edge labels (condition chips) can overlap each other on dense graphs
- [ ] No edge selection highlight — clicking an edge doesn't visually indicate it's selected
- [ ] Unconditional edges are low opacity (0.5) — might be too faint on light backgrounds

## Git Panel

- [ ] SSH shows as tiny green label, not a button — needs full redesign (Phase 1)
- [ ] No credential visibility — user can't see what auth method is active
- [ ] `gitApi` in api.ts has 10 dead methods calling nonexistent routes — cleanup needed
- [ ] Clone error messages are generic — should detect auth vs network vs not-found

## Export

- [ ] Platform export works client-side but raw/parsed export was just migrated — needs real-world testing
- [ ] No progress indicator during export (just a spinner)
- [ ] Export dialog doesn't remember last-used format/platform

## Skills Discover

- [ ] Hardcoded colors (`hsl(200, 80%, 55%)`) — should use CSS vars
- [ ] Search-only UI — no categories, featured, or popular sections
- [ ] Installed skills don't show well in Assets tab
- [ ] No uninstall flow from the discover view
- [ ] Preview panel is basic — should show skill content, refs, dependencies

## Copilot / Flow

- [ ] `agent="none"` was removed but no real backend agent exists yet — chat works via frontend tools only
- [ ] Model picker selection may not persist across page reloads
- [ ] No "API keys not configured" helpful message — just silent failure
- [ ] Tool renderers exist but aren't tested with real agent responses

## Docs (Fumadocs)

- [ ] CSS migration done but needs visual verification on actual `/docs` route
- [ ] Studio components embedded in docs (DocsShowcase) need testing post-CSS migration
- [ ] `body:not(:has(#nd-docs-layout))` scoping hack still in globals.css — may be removable now
- [ ] Some guide pages in `docs/guide/` reference old CLI paths (`node src/cli.js`)

## General UI

- [ ] Light theme needs polish (noted in RELEASE-KANBAN #31)
- [ ] No skeleton loading UI for panels (noted in RELEASE-KANBAN #35)
- [ ] Error boundary missing in Studio UI (noted in RELEASE-KANBAN #14)
- [ ] Monaco editor context menu can escape panel bounds (CSS fix exists but may not cover all cases)
- [ ] Scrollbar styling is global `*` selector — could affect third-party components

## API Routes

- [ ] `skills/rollback` uses `fs.rmSync` — only works in local mode, silently fails online
- [ ] `skills/preview` uses `execSync('npx skills add')` — slow, blocks event loop
- [ ] `copilot/keys` writes to `.env.local` — only works in local mode
- [ ] `config/mode` is 6 lines — could be inlined into a client-side check

---

*Last updated: 2026-04-22*
