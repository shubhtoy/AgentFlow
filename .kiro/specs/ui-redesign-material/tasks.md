# Implementation Plan: Material Design 3 UI Redesign

## Overview

Comprehensive migration of the AgentFlow v2 UI from the current Notion-like aesthetic to Material Design 3, replacing floating panels with a docked CSS Grid layout, migrating state to Zustand with undo/redo, adopting MUI v6 components, and adding new features (CommandPalette, FAB, Minimap, NarrativeScaffoldingEditor, type-aware FrontmatterForm). Each task builds incrementally on the previous, wiring components together as they are created.

## Tasks

- [x] 1. Install dependencies and configure project foundation
  - [x] 1.1 Install new dependencies and remove deprecated ones
    - Install: `zustand`, `zundo`, `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `@fontsource/roboto` (weights 300,400,500,700), `@fontsource/roboto-mono` (weights 400,500), `framer-motion`
    - Remove: `react-arborist`, `@fontsource/inter`
    - Update `package.json` and run install
    - _Requirements: 18.4, 18.7, 18.8, 18.9_

  - [x] 1.2 Create MUI v6 theme configuration (`ui/src/theme.ts`)
    - Define `lightTheme` and `darkTheme` using `createTheme` with MD3 seed color `#1565C0`
    - Configure palette (surface, surface-container variants, primary, secondary, tertiary, error, neutral tones)
    - Set typography to Roboto with MD3 type scale (display, headline, title, body, label sizes)
    - Set shape scale: 12px cards/containers, 8px buttons/inputs, 28px FABs/chips
    - Configure component overrides for MuiButton, MuiChip, MuiFab, MuiTextField, MuiSwitch, MuiCheckbox (48px touch targets)
    - Define MD3 elevation tokens as box-shadow values (0dp, 1dp, 3dp, 6dp, 8dp, 12dp)
    - Define MD3 state layer opacities (hover 8%, focus 12%, pressed 12%, dragged 16%)
    - Export `lightTokens` and `darkTokens` objects with all MD3 color roles
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 9.1, 9.5_

  - [x] 1.3 Create CATEGORY_CONFIG and NODE_TYPE_COLORS constants (`ui/src/constants.ts`)
    - Define `CATEGORY_CONFIG` mapping each resource type to Lucide icon, MD3 tonal colors (primaryColor, containerColor, onColor), and label
    - Define `NODE_TYPE_COLORS`: step→blue-600, router→amber-600, sub-workflow→purple-600
    - _Requirements: 17.1, 17.2, 17.7_

- [x] 2. Migrate state management to Zustand with undo/redo
  - [x] 2.1 Create Zustand store (`ui/src/store.ts`) replacing Context API (`ui/src/store.tsx`)
    - Define `DomainState` interface (data, activeWf, selection, viewFilter, breadcrumbs) — tracked by undo
    - Define `UIState` interface (loading, explorerOpen, explorerTab, drawerOpen, drawerTab, themeMode, resolvedTheme, commandPaletteOpen, zoomLevel, minimapCollapsed, notifications, etc.) — excluded from undo
    - Define `Actions` interface preserving all existing store actions (reload, save, select, etc.)
    - Create store with `create<AppStore>()(temporal(...))` wrapping
    - Configure `zundo` temporal middleware: `limit: 50`, `partialize` to exclude transient UI state, `handleSet` with 500ms debounce for batching rapid edits
    - Expose `undo()` and `redo()` actions that call `useAppStore.temporal.getState().undo/redo()`
    - Expose granular selector hooks: `useNodes()`, `useSelectedNode()`, `useThemeMode()`, `useCanUndo()`, `useCanRedo()`
    - Ensure no React Context providers needed — direct hook access
    - _Requirements: 18.1, 18.2, 18.3, 18.10, 18.11, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10, 8.1, 8.4, 8.5_

  - [x] 2.2 Wire theme system into Zustand store and MUI provider
    - Add `themeMode` (light/dark/system) and `resolvedTheme` to store
    - Implement `prefers-color-scheme` media query listener for system-auto mode
    - Persist theme preference in localStorage
    - Add blocking inline script in `index.html` to set theme class before first paint (FOUC prevention)
    - Update `ui/src/App.tsx` to wrap with `MuiThemeProvider` using resolved theme from store
    - Implement theme toggle cycling: light → dark → system → light
    - Ensure dark theme colors match MD3 dark scheme (surface #121212, on-surface #E6E1E5, primary #D0BCFF)
    - Ensure WCAG AA 4.5:1 contrast ratio for all text in dark mode
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

- [x] 3. Checkpoint - Ensure store migration compiles and theme renders
  - Ensure all imports resolve, store hooks work, MUI theme applies correctly. Ask the user if questions arise.

- [x] 4. Build the docked CSS Grid layout shell
  - [x] 4.1 Create AppShell component (`ui/src/components/AppShell.tsx`)
    - Implement CSS Grid layout: `grid-template-rows: 56px 1fr`, `grid-template-columns: var(--explorer-width) 1fr var(--drawer-width)`
    - CSS custom properties: `--explorer-width: 280px` (48px collapsed), `--drawer-width: 0px` (400px when open)
    - Animate grid transitions with `transition: grid-template-columns 250ms cubic-bezier(0.4, 0, 0.2, 1)`
    - Slot ActionBar (row 1, full width), ExplorerPanel (col 1, row 2), GraphCanvas (col 2, row 2), NodeDrawer (col 3, row 2)
    - Ensure Graph_Canvas always occupies minimum 50% viewport width
    - Remove all absolutely positioned floating panel patterns from current code
    - _Requirements: 2.1, 2.5, 2.6, 15.4_

  - [x] 4.2 Implement responsive breakpoint behavior
    - ≥1440px: Explorer 280px docked, Canvas flex, Drawer 400px side panel
    - 1024–1439px: Explorer collapsed to 48px icon rail by default, Canvas + Drawer share remaining space
    - <1024px: Explorer accessible only via hamburger overlay, Drawer renders as Bottom_Sheet (70vh), Canvas min 50% width
    - Action_Bar collapses less-used controls into overflow menu below 1280px (keep breadcrumbs, search, validate, export visible)
    - _Requirements: 2.7, 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 5. Implement ActionBar component
  - [x] 5.1 Create ActionBar (`ui/src/components/ActionBar.tsx`)
    - 56px height, docked top, full width, surface-container-low background, elevation 2
    - Layout left-to-right: hamburger toggle → BreadcrumbBar → WorkflowSelector dropdown → divider → undo/redo buttons → divider → zoom controls (in, out, fit, percentage) → divider → search trigger (Ctrl+K hint) → validate button with status indicator → export button → theme toggle → settings menu
    - Undo/redo buttons: disabled state (reduced opacity, no pointer events) when stacks empty, wired to `useCanUndo()`/`useCanRedo()` selectors
    - Validation status indicator: green checkmark (no errors), red badge with count (errors), yellow badge (warnings only)
    - Breadcrumb_Bar: clickable ancestor segments for sub-workflow navigation
    - Zoom percentage display next to zoom controls
    - Fit-view button pans/zooms canvas to fit all nodes with padding
    - Responsive: collapse to overflow menu (three-dot) below 1280px
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 8.2, 8.3, 8.6_

- [x] 6. Implement ExplorerPanel component
  - [x] 6.1 Create ExplorerPanel (`ui/src/components/ExplorerPanel.tsx`)
    - Docked left, 280px default width with resize handle, collapsible to 48px icon rail
    - Search input at top (MUI TextField outlined) — case-insensitive substring filtering across all categories
    - Tab bar: "Semantic" (grouped by type) and "Files" (directory tree) tabs using MUI Tabs
    - Semantic view: MUI Accordion expansion panels per category (Workflows, Nodes, Tools, Skills, Conditions, Interactions, Memory)
    - Each accordion header: category icon (from CATEGORY_CONFIG), label, item count badge (MD3 badge styling)
    - Each item: MUI ListItem with leading category icon (tonal color), primary text (name), secondary text (truncated description)
    - Active item: primary-container background (MD3 active state)
    - Selecting item triggers node/resource selection in store and opens NodeDrawer
    - Hide sections with zero items entirely
    - Add "Untyped" / "Other Files" section listing `.md` files not in recognized categories
    - Collapsed icon rail: vertical category icons with tooltips on hover
    - Replace `react-arborist` tree with MUI expansion panels for Files tab
    - Display usage count badge or dimmed styling on resources referenced by zero nodes
    - On hover over a resource, highlight all Node_Cards on canvas that reference it (pulse/outline animation)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 2.2, 11.4, 17.4, 18.9, 22.3, 23.5, 23.6_

- [x] 7. Checkpoint - Verify layout shell, ActionBar, and ExplorerPanel render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement NodeCard and canvas components
  - [x] 8.1 Create NodeCard custom React Flow node (`ui/src/components/NodeCard.tsx`)
    - MUI Card with elevation 1 (resting), elevation 3 (hovered/selected)
    - Colored header bar matching node type (step→blue-600, router→amber-600, sub-workflow→purple-600) from NODE_TYPE_COLORS
    - Display: node name as title, node type icon
    - Resource_Chip_Group below title: up to 4 MUI Chips (category icon + truncated name, tonal colors from CATEGORY_CONFIG), "+N more" overflow chip expanding on click
    - Router nodes: badge showing outgoing conditional edge count
    - Sub-workflow nodes: "drill down" icon button for navigation
    - Connection handles: source (right), target (left), 8px filled circles in node type accent color
    - Selected state: 2px primary outline ring, elevation 3
    - Clicking a resource chip selects that resource and opens NodeDrawer for the resource
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 17.2, 17.5, 23.1, 23.2, 23.3, 23.4_

  - [x] 8.2 Create NodeToolbar contextual overlay (`ui/src/components/NodeToolbar.tsx`)
    - Appears on Node_Card hover, positioned above the card
    - Quick action icon buttons: edit (opens NodeDrawer), delete, duplicate, add-connection
    - Styled as MD3 icon buttons
    - _Requirements: 3.8_

  - [x] 8.3 Create EdgeRenderer custom React Flow edge (`ui/src/components/EdgeRenderer.tsx`)
    - Smooth bezier curves, 2px stroke (outline color resting, primary color hovered/selected)
    - Hover: 3px stroke, show edge label (target name or condition), show delete button (X icon) at midpoint
    - Delete button click: remove Edge_Ref from source markdown, show Snackbar with undo
    - Animated dashed-line flow indicators showing data direction (source→target)
    - Conditional edges: condition name as MUI Chip label at edge midpoint
    - Support edge creation by dragging from output handle to input handle with visual guide line
    - _Requirements: 3.9, 3.10, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 8.4 Update GraphCanvas (`ui/src/components/Canvas.tsx`)
    - Register NodeCard as custom node type and EdgeRenderer as custom edge type
    - Dot grid background: surface-container-lowest dots (light), surface-container dots (dark)
    - Double-click empty space: quick-add node menu (Step, Router, Sub-Workflow) at click position
    - Keyboard navigation: Ctrl+= zoom in, Ctrl+- zoom out, Ctrl+0 fit view, arrow keys pan (when no node selected)
    - Empty state: centered illustration + "Start building your workflow" headline + FAB/button to add first node
    - _Requirements: 7.4, 7.5, 7.6, 11.2_

- [x] 9. Implement Minimap and FAB
  - [x] 9.1 Create Minimap wrapper (`ui/src/components/Minimap.tsx`)
    - Wrap React Flow MiniMap in MUI Card (elevation 1), bottom-right corner
    - Interactive: click/drag pans canvas to corresponding position
    - Collapsible via toggle button, persist collapsed state in localStorage
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 9.2 Create FAB component (`ui/src/components/FAB.tsx`)
    - MUI Fab, 56px, primary color, elevation 3, "+" icon, bottom-right (above Minimap)
    - Click opens MUI Menu: Step, Router, Sub-Workflow options with type icons and descriptions
    - Selecting type creates node at viewport center, auto-selects, opens NodeDrawer to Content tab
    - Container transform animation via Framer Motion
    - Remains visible when NodeDrawer is open
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 10. Implement NodeDrawer with tabs
  - [x] 10.1 Create NodeDrawer shell (`ui/src/components/NodeDrawer.tsx`)
    - Framer Motion slide-in from right, 400px width (or 70vh Bottom_Sheet on <1024px)
    - DrawerHeader: node/resource name, type badge, file path, close button
    - ValidationBanner: MD3 alert banners for errors/warnings, collapsible
    - MUI Tabs bar: Content | Properties | References | Preview
    - Keyboard: Escape to close, Ctrl/Cmd+1–4 to switch tabs
    - Opens on node/resource selection (canvas click, explorer click, search)
    - Canvas resizes to accommodate drawer (grid column change)
    - _Requirements: 4.1, 4.2, 4.7, 4.8, 4.9, 4.10, 2.3, 2.4_

  - [x] 10.2 Implement Content tab
    - Embed existing tiptap Editor with Ref_Chips (using category tonal colors from CATEGORY_CONFIG), slash commands, narrative block decorations
    - Ref_Chips styled as MUI Chip: category icon, tonal container background, on-tonal text
    - "Create Resource" button in toolbar / slash command for inline resource creation
    - _Requirements: 4.3, 17.3, 22.4, 22.5_

  - [x] 10.3 Implement Properties tab with type-aware FrontmatterForm (`ui/src/components/FrontmatterForm.tsx`)
    - Define `FRONTMATTER_SCHEMAS` registry mapping each resource type to `FrontmatterFieldDef[]`
    - Render MUI form fields based on schema: TextField (text), TextField multiline (textarea), Select (dropdowns), Switch (booleans), custom TagInput with MUI Chips (taglist for inputs/outputs), key-value editor (keyvalue)
    - Always show all built-in fields for detected type (pre-filled or empty/default)
    - Dynamic field visibility: changing `type` field immediately shows/hides conditional fields (e.g., tool type→script shows `command`)
    - "Custom Fields" divider below built-in fields, showing non-schema frontmatter as editable key-value rows
    - "Add Custom Field" button for arbitrary key-value pairs
    - Save serializes all fields to valid YAML frontmatter (built-in first, custom alphabetically)
    - Empty frontmatter state: prompt "Add Properties" with button to insert `---\n---` block
    - Untyped files: show name, description, type dropdown; selecting type reveals full field set
    - `narrativeTemplate` group: prefix + suffix inputs with live preview `[prefix] {{category/name}} [suffix]`
    - Works for ANY `.md` file including untyped files
    - _Requirements: 4.4, 4.11, 4.12, 4.13, 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 22.8_

  - [x] 10.4 Implement References tab
    - Display all Ref_Tokens grouped by semantic type (edges, mentions, data flows)
    - Each ref clickable to navigate to referenced resource
    - _Requirements: 4.5_

  - [x] 10.5 Implement Preview tab
    - Render fully resolved markdown with all Ref_Tokens replaced by resolved values
    - _Requirements: 4.6_

- [x] 11. Checkpoint - Verify canvas nodes, drawer, and form render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement CommandPalette
  - [x] 12.1 Create CommandPalette (`ui/src/components/CommandPalette.tsx`)
    - MUI Dialog, centered modal overlay, triggered by Ctrl/Cmd+K
    - Search input with fuzzy matching across nodes, resources, workflows (name + description)
    - Results grouped by category (Nodes, Tools, Skills, etc.) with section headers
    - Each result: category icon (tonal color), name, type badge, truncated description — styled as MUI ListItems
    - Keyboard: Arrow Up/Down move selection, Enter confirm, Escape dismiss
    - Select node result: pan canvas to center on node, select it, open NodeDrawer
    - Select resource result: select resource, open NodeDrawer
    - Empty search: show recent selections and frequently accessed items
    - No results: "No results found" with suggestion to try different terms
    - Action commands: prefix `>` (e.g., `>export`, `>validate`, `>add node`)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 11.5, 17.6_

- [x] 13. Implement NarrativeScaffoldingEditor
  - [x] 13.1 Create NarrativeScaffoldingEditor (`ui/src/components/NarrativeScaffoldingEditor.tsx`)
    - Inline popover near insertion point, triggered on resource attachment (drag-drop, slash command, command palette)
    - Three sections: editable prefix field (pre-filled from resource's narrativeTemplate.prefix or category default), non-editable ref chip `{{category/name}}`, editable suffix field (pre-filled from narrativeTemplate.suffix or category default)
    - Live preview of full rendered sentence below fields
    - Three buttons: "Insert" (full sentence), "Insert bare ref" (ref only), "Cancel"
    - Insert places `prefix {{ref}} suffix` at cursor in editor
    - Same resource can be attached multiple times as independent Usage_Instances with different prefix/suffix
    - Each Usage_Instance independent — editing one doesn't affect others
    - Post-insertion edits in tiptap preserved as-is (scaffolding is starting point only)
    - Session cache: remember last-used prefix/suffix per resource, offer as default for subsequent attachments
    - Untyped files: empty prefix/suffix defaults
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9, 22.7_

- [x] 14. Implement SnackbarQueue notification system
  - [x] 14.1 Create SnackbarQueue (`ui/src/components/SnackbarQueue.tsx`)
    - MUI Snackbar + Alert, bottom-center, 344px max width, 8px border-radius, elevation 3
    - Surface-inverse background, on-inverse text (MD3 spec)
    - Queue multiple snackbars, display one at a time with transitions
    - Auto-dismiss: 4s for success, 6s for errors
    - Optional action buttons: "Undo" for undoable operations (delete node, delete edge, detach resource), "Retry" for failures
    - Dismissible via close icon or swipe (touch)
    - Undo/redo operations show brief description snackbar (e.g., "Undone: deleted connection to analyze-results")
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 8.7_

- [x] 15. Implement empty states and onboarding
  - [x] 15.1 Create empty state components
    - No workspace: full-screen Empty_State with illustration, "No workspace loaded" headline, description, primary button to open directory
    - No nodes: centered Empty_State on canvas with illustration, "Start building your workflow" headline, FAB/button to add first node
    - No selection: no empty detail panel — canvas occupies full width
    - First-use tooltips for FAB, Ctrl+K shortcut, Explorer toggle
    - _Requirements: 11.1, 11.2, 11.3, 11.6_

- [x] 16. Implement MUI v6 component standardization pass
  - [x] 16.1 Ensure all UI components use MUI v6 primitives
    - Buttons: MUI Button (contained/outlined/text variants) with built-in state layers
    - Text inputs: MUI TextField (outlined, floating labels, helperText, error, leading/trailing icons)
    - Selection controls: MUI Select, Switch, Checkbox with 48px touch targets
    - Dialogs: MUI Dialog with DialogTitle, DialogContent, DialogActions, Backdrop scrim
    - Chips: MUI Chip (32px height, 8px radius, icon prop, onDelete)
    - Loading: MUI CircularProgress (indeterminate) and LinearProgress (determinate for export)
    - Replace all remaining zinc/slate color tokens with MD3 neutral/neutral-variant tones
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 1.8_

- [x] 17. Implement unrestricted file model support
  - [x] 17.1 Update parser/store to support unrestricted file references
    - Allow any `.md` file to be referenced via `{{path/to/file}}` regardless of directory
    - Untyped files (no `type` frontmatter, not in reserved directory) treated as resources under "Other" category
    - Support drag-and-drop of any `.md` from Files tab onto canvas or editor as resource attachment
    - _Requirements: 22.1, 22.2, 22.6_

- [x] 18. Migrate backend to Fastify or Hono
  - [x] 18.1 Replace raw Node.js http module with Fastify/Hono (`src/server.ts` or equivalent)
    - Typed route definitions, middleware support, structured error handling
    - JSON schema validation for request/response payloads
    - Maintain all existing API endpoints and response contracts (backward compatibility)
    - _Requirements: 18.5, 18.6_

- [x] 19. Final wiring and integration
  - [x] 19.1 Wire all keyboard shortcuts globally
    - Ctrl/Cmd+Z → undo, Ctrl/Cmd+Shift+Z → redo
    - Ctrl/Cmd+K → CommandPalette
    - Ctrl/Cmd+1–4 → NodeDrawer tab switch (when drawer open)
    - Escape → close NodeDrawer
    - Ctrl/Cmd+=/-/0 → zoom in/out/fit
    - Arrow keys → pan canvas (when no node selected)
    - _Requirements: 8.2, 8.3, 5.1, 4.10, 4.9, 7.4_

  - [x] 19.2 Wire Framer Motion animations throughout
    - NodeDrawer slide-in/out transitions
    - FAB scale and container transform animation
    - Explorer panel collapse/expand transitions
    - Shared-axis navigation transitions
    - Snackbar enter/exit transitions
    - _Requirements: 18.8_

  - [x] 19.3 Connect all components to Zustand store
    - Ensure all components use granular selectors (no full-store subscriptions)
    - Verify undo/redo captures: content edits, node CRUD, edge CRUD, resource attach/detach, frontmatter changes
    - Verify transient state excluded: panel open/closed, scroll, hover, zoom, explorer tab, theme
    - Verify 500ms debounce batching for tiptap keystrokes
    - Verify redo stack clears on new operation after undo
    - _Requirements: 18.1, 18.2, 19.2, 19.8, 19.9_

- [x] 20. Final checkpoint - Full integration verification
  - Ensure all components render, all keyboard shortcuts work, undo/redo functions correctly, theme switching works, responsive breakpoints behave as specified. Ask the user if questions arise.

## Notes

- All tasks use TypeScript and React with MUI v6 components
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- No test tasks included per user request
