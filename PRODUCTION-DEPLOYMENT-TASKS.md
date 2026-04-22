# Production Deployment — Phased Task List

> Generated 2026-04-21. Each phase is independently shippable. Docs update after each phase.

---

## Phase 1: Git Panel Redesign

**Goal:** Rebuild GitPanel to match MCPPanel/ValidationPanel quality. SSH-first auth, credential visibility, proper component decomposition.

**Depends on:** Nothing
**Blocked by:** Nothing

### Tasks

- [ ] 1.1 Create `studio/app/api/git/ssh/route.ts`
  - GET: detect SSH keys by checking common paths (`~/.ssh/id_ed25519`, `id_rsa`, `id_ecdsa`)
  - Return: `{ available: boolean, keys: [{ type, path, fingerprint? }] }`
  - Only works in local mode (return `{ available: false }` in online mode)

- [ ] 1.2 Create `studio/components/git/AuthSection.tsx`
  - SSH-first priority: if SSH keys detected → show "SSH Available" with key list as primary
  - Token/OAuth as secondary options below
  - Active credential badge: shows which auth method is currently in use
  - Sign out button when authenticated
  - Match MCPPanel's auth section pattern (✓/✗ indicators)

- [ ] 1.3 Create `studio/components/git/CredentialStatus.tsx`
  - Shows: SSH keys found (type + path), OAuth session (provider + username), Token stored (masked)
  - Visual: green/amber/red status per method
  - Tooltip with details on hover

- [ ] 1.4 Create `studio/components/git/RepoCard.tsx`
  - Extract from GitPanel, clean up
  - Proper Card component with branch badge, status indicator, ahead/behind counts
  - Actions: Sync, Scan, Disconnect
  - Match MCPPanel's ServerCard expand/collapse pattern

- [ ] 1.5 Create `studio/components/git/CloneInput.tsx`
  - Extract clone URL input + button from GitPanel
  - Auto-detect provider from URL (use `detectProvider()` from `git-providers.ts`)
  - Show auth hint if clone fails with 401/403

- [ ] 1.6 Rewrite `studio/components/GitPanel.tsx`
  - Compose from: AuthSection, CredentialStatus, RepoCard, CloneInput
  - Add SectionHeader pattern (collapsible, with counts)
  - Add refresh via custom event (`agentflow:git-refresh`)
  - Target: ~80 lines (orchestration only, all logic in sub-components)

- [ ] 1.7 Update `studio/app/api/git/config/route.ts`
  - Add SSH key detection to the response (call same logic as ssh route)
  - Return: `{ providers, localMode, ssh: { available, keys } }`

### Docs Update (after Phase 1)
- [ ] 1.8 Update any docs referencing Git panel behavior or auth flows

---

## Phase 2: API Route Consolidation

**Goal:** Reduce route count from 12 to 9. Cleaner API surface.

**Depends on:** Nothing (can parallel with Phase 1)
**Blocked by:** Nothing

### Tasks

- [ ] 2.1 Merge `skills/search` + `skills/preview` + `skills/rollback` → `skills/route.ts`
  - POST with `{ action: "search" | "preview" | "rollback", ...params }`
  - GET with `?action=search&q=...` for search (backward compat)
  - Keep all server-only logic (execSync, fs) in the single route

- [ ] 2.2 Merge `copilot/keys` + `copilot/model` → `copilot/route.ts`
  - GET with `?action=keys` or `?action=models` or `?action=model-current`
  - POST with `{ action: "keys-update" | "model-set", ...params }`
  - Delete `copilot/model/discover/` empty dir

- [ ] 2.3 Update all client-side callers
  - `studio/lib/copilot/key-store.ts` or wherever keys are fetched
  - `studio/components/copilot/ModelPicker.tsx`
  - `studio/components/SkillsDiscoverView.tsx` or skill install flows
  - `studio/components/SettingsDialog.tsx`

- [ ] 2.4 Delete old route directories
  - Remove `studio/app/api/skills/search/`
  - Remove `studio/app/api/skills/rollback/`
  - Remove `studio/app/api/copilot/keys/`
  - Remove `studio/app/api/copilot/model/`

- [ ] 2.5 Verify: `npm run build` passes with no broken imports

### Docs Update (after Phase 2)
- [ ] 2.6 Update API reference if any docs describe route structure

---

## Phase 3: Fumadocs Integration Fix

**Goal:** Get the docs route working properly. This requires migrating CSS variables from legacy shadcn v3 format (raw HSL channels) to modern v4 format (full `hsl()` values), then adding fumadocs CSS presets.

**Depends on:** Nothing (can parallel with Phase 1 and 2)
**Blocked by:** Nothing

**Context for executor:** The project uses the old shadcn/ui convention where CSS variables store raw HSL channels (`--background: 40 20% 98%`) and wrap them in `hsl()` at usage time (`hsl(var(--background))`). This format is deprecated in Tailwind v4. shadcn/ui itself migrated to full color values. Fumadocs' `shadcn.css` preset does `--color-fd-background: var(--background)` — it expects `--background` to be a complete color value like `hsl(40 20% 98%)`, not raw channels. Without this migration, fumadocs colors will be broken.

### Tasks

- [ ] 3.1 Migrate `:root` CSS variables in `studio/app/globals.css`
  - Change all 25 color variables from raw HSL channels to full `hsl()` values
  - Example: `--background: 40 20% 98%` → `--background: hsl(40 20% 98%)`
  - Full list of variables to change:
    ```
    --background, --foreground, --card, --card-foreground,
    --popover, --popover-foreground, --muted, --muted-foreground,
    --border, --input, --ring, --primary, --primary-foreground,
    --secondary, --secondary-foreground, --accent, --accent-foreground,
    --destructive, --destructive-foreground, --success, --warning,
    --node-step, --node-router, --node-sub-workflow
    ```
  - Do NOT change `--radius` (it's not a color)

- [ ] 3.2 Migrate `.dark` CSS variables in `studio/app/globals.css`
  - Same transformation as 3.1 but for the `.dark` block
  - Same 25 variables, same `hsl()` wrapping

- [ ] 3.3 Update `@theme inline` block in `studio/app/globals.css`
  - Remove `hsl()` wrapper from all 25 lines
  - Example: `--color-background: hsl(var(--background))` → `--color-background: var(--background)`
  - Since variables now contain full `hsl()` values, the wrapper is redundant

- [ ] 3.4 Update all `hsl(var(--...))` usages in `studio/app/globals.css`
  - Body styles: `background-color: hsl(var(--background))` → `background-color: var(--background)`
  - Body styles: `color: hsl(var(--foreground))` → `color: var(--foreground)`
  - Scrollbar: `scrollbar-color: hsl(var(--border)) transparent` → `scrollbar-color: var(--border) transparent`
  - Border reset: `border-color: hsl(var(--border))` → `border-color: var(--border)`
  - React Flow: `background: hsl(var(--background))` → `background: var(--background)`
  - CSV table borders: `border: 1px solid hsl(var(--border))` → `border: 1px solid var(--border)`
  - CSV table header: `background: hsl(var(--muted))` → `background: var(--muted)`
  - Total: 7 occurrences outside `@theme inline` and variable definitions

- [ ] 3.5 Update inline styles in `studio/components/ElementsView.tsx`
  - 5 occurrences of `hsl(var(--primary))` pattern
  - Change `hsl(var(--primary))` → `var(--primary)` (3 occurrences — color props)
  - Change `hsl(var(--primary) / 0.1)` → `color-mix(in srgb, var(--primary) 10%, transparent)` (1 occurrence — backgroundColor with opacity)
  - Change `hsl(var(--primary))` → `var(--primary)` (1 occurrence — inline color style)

- [ ] 3.6 Update inline style in `studio/components/Canvas.tsx`
  - 1 occurrence: `hsl(var(--border) / 0.3)` → `color-mix(in srgb, var(--border) 30%, transparent)`
  - This is in the minimap container style (line ~707)

- [ ] 3.7 Add fumadocs CSS imports to `studio/app/globals.css`
  - Add AFTER `@import "tailwindcss";` and BEFORE `@custom-variant dark`:
    ```css
    @import 'fumadocs-ui/css/shadcn.css';
    @import 'fumadocs-ui/css/preset.css';
    ```
  - `shadcn.css` maps `--color-fd-*` → `var(--background)` etc. (now valid since vars contain full hsl values)
  - `preset.css` adds fumadocs utilities, animations, typography plugin, base styles

- [ ] 3.8 Clean up `studio/app/(docs)/docs.css` and layout
  - Delete `studio/app/(docs)/docs.css` (contains only a comment)
  - In `studio/app/(docs)/layout.tsx`: remove the commented-out `// import './docs.css'` line

- [ ] 3.9 Fix build error in `studio/app/api/copilotkit/[[...path]]/route.ts`
  - CopilotRuntime constructor type mismatch — fix before testing
  - This is unrelated to CSS but blocks `npm run build`

- [ ] 3.10 Verify docs route
  - Navigate to `/docs` — fumadocs sidebar, navigation, TOC should render with correct colors
  - Check dark mode toggle works on docs pages
  - Check code blocks render with syntax highlighting (shiki)
  - Check search works (fumadocs static search)
  - Colors should match studio theme (warm light / dark, not fumadocs neutral defaults)

- [ ] 3.11 Verify studio components embedded in docs
  - Pages using `<DocsShowcase>` should render canvas, node cards, etc.
  - The `.agentflow-studio` class scopes studio styles
  - The `not-prose` class on DocsShowcase prevents fumadocs typography from affecting studio components
  - React Flow canvas inside docs pages should render correctly

- [ ] 3.12 Verify studio route is unaffected
  - Navigate to `/` — studio should look identical to before
  - Check: canvas background, node cards, panel borders, scrollbars, dark mode
  - Check: CopilotKit chat panel styling (the `color-mix` overrides now work correctly since vars are valid colors)
  - Check: Monaco editor, ProseMirror editor, CSV table viewer

---

## Phase Summary

| Phase | Tasks | Depends On | Parallelizable |
|-------|-------|-----------|----------------|
| 1. Git Panel Redesign | 8 | — | Yes |
| 2. API Route Consolidation | 6 | — | Yes (with Phase 1) |
| 3. Fumadocs Integration Fix | 12 | — | Yes (with Phase 1 & 2) |

**Total: 26 tasks across 3 phases.**

All 3 phases can run in parallel. Phase 3 is the most impactful — it's a CSS variable format migration that affects `globals.css` (50 variable definitions + 25 theme mappings + 7 usage sites), 2 component files, and enables the entire fumadocs docs route.
