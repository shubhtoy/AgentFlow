# Requirements Document

## Introduction

Comprehensive UI redesign of the AgentFlow v2 application, replacing the current Notion-like aesthetic (Inter font, zinc tones, floating panels) with a Material Design 3 language featuring card-based layouts, Roboto typography, elevation-based depth, and a visual style inspired by workflow builder tools like n8n and Zapier. This redesign also addresses structural shortcomings identified through a critical review of the current tool.

### Critical Review of Current Tool

The current AgentFlow v2 UI has several structural and UX issues that this redesign addresses:

1. **Floating panel chaos**: All panels (Explorer, Detail, ResourcePalette) are absolutely positioned floating overlays that can overlap each other and the canvas. There is no stable layout grid — panels drift over the graph, obscuring nodes and edges. n8n and Zapier use docked, predictable panel positions.

2. **No visual node editor**: The graph canvas shows nodes but all editing happens in a separate Detail Panel on the right. Workflow builders like n8n let you click a node and edit it in-place or in a slide-out drawer that doesn't obscure the graph. The current approach disconnects the visual graph from the editing experience.

3. **Monolithic Editor component**: The Editor.tsx component handles source mode, visual mode, slash commands, ref insertion, save logic, and preview — all in one 450+ line component. This needs decomposition.

4. **No minimap or navigation aids**: For large workflows, there's no way to orient yourself. n8n provides a minimap, zoom controls, and a node search. The current app has basic React Flow controls but no search-to-node or overview map.

5. **Weak onboarding / empty states**: When no workspace is loaded or no selection exists, the UI shows minimal feedback. Zapier and n8n show helpful empty states with action prompts.

6. **No undo/redo**: Editing operations (drag-drop connections, resource attachment, content edits) have no undo support. This is a significant gap for a visual editor.

7. **Toolbar is sparse**: The current toolbar has breadcrumbs, validation, export, and view filter — but lacks quick actions like add-node, search, undo/redo, and zoom controls that workflow builders prominently feature.

8. **No node search or command palette**: There's no way to quickly find and navigate to a node by name across the entire workspace. n8n has Ctrl+K search, Zapier has a global search bar.

9. **Detail Panel is overloaded**: The right panel stacks frontmatter form, validation errors, ref list, and the full markdown editor vertically. On smaller screens this becomes unusable. It needs tabs or collapsible sections.

10. **No execution/test preview**: Unlike n8n which shows test run results inline on nodes, AgentFlow has no way to preview what a workflow would produce. While full execution is out of scope, a "dry run" or "resolve preview" per node would be valuable.

## Glossary

- **App**: The AgentFlow v2 single-page React/TypeScript application.
- **Material_Design_System**: The visual design language based on Google's Material Design 3, using elevation, cards, rounded corners, and the Roboto font family.
- **Card**: A Material Design surface component with elevation, rounded corners, and contained content used as the primary UI container pattern.
- **Elevation**: The Material Design depth system using shadow layers to indicate hierarchy (0dp–24dp).
- **Surface**: A background layer in the Material Design color system (surface, surface-container, surface-variant).
- **Explorer_Panel**: The left sidebar displaying workspace contents grouped by semantic category, rendered as a docked panel (not floating).
- **Graph_Canvas**: The central node-based visual editor canvas rendering workflow nodes and edges, inspired by n8n's node editor.
- **Node_Drawer**: A slide-out drawer panel that opens from the right when a node is selected on the Graph_Canvas, replacing the current floating Detail Panel.
- **Node_Card**: A Material Design card rendered on the Graph_Canvas representing a workflow node, with icon, title, status indicators, and connection handles.
- **Editor**: The tiptap-based markdown editor embedded in the Node_Drawer for editing file content.
- **Ref_Token**: An inline `{{...}}` reference token in markdown content.
- **Ref_Chip**: A Material Design chip component that visually represents a Ref_Token inline in the Editor.
- **Command_Palette**: A global search and command interface triggered by Ctrl/Cmd+K, providing node search, resource search, and quick actions.
- **Action_Bar**: The top toolbar containing workflow controls, navigation, search trigger, zoom controls, undo/redo, and quick actions.
- **Node_Toolbar**: A contextual floating toolbar that appears when a node is selected on the canvas, offering quick actions (edit, delete, duplicate, connect).
- **Minimap**: A small overview map of the entire workflow graph displayed in a corner of the Graph_Canvas for orientation.
- **Empty_State**: A placeholder UI shown when no content exists, providing guidance and action prompts following Material Design empty state patterns.
- **Snackbar**: A Material Design notification component for transient messages (success, error, info) displayed at the bottom of the screen.
- **FAB**: Floating Action Button — a Material Design primary action button for adding new nodes to the canvas.
- **Bottom_Sheet**: A Material Design panel that slides up from the bottom on smaller viewports, used as an alternative to the Node_Drawer.
- **Tab_Bar**: A Material Design tab component used within the Node_Drawer to organize content into sections (Content, Properties, References, Preview).
- **Breadcrumb_Bar**: A navigation component showing the current workflow path, supporting sub-workflow drill-down.
- **Resource_Chip_Group**: A horizontal scrollable group of Material Design chips displayed on a Node_Card showing attached resources.
- **Selection**: The currently selected item in the App.
- **Theme_Mode**: The active visual theme (light, dark, or system-auto).
- **Workflow_Selector**: A dropdown in the Action_Bar for switching between workflows.
- **Zustand_Store**: The centralized client-side state management store built with Zustand, replacing the custom Context API store, providing selective subscriptions and middleware support.
- **Undo_Stack**: The ordered list of reversible state snapshots maintained by the Zustand temporal middleware, enabling undo/redo of all state-changing operations.
- **Redo_Stack**: The ordered list of undone state snapshots available for re-application via the Zustand temporal middleware.
- **API_Server**: The backend HTTP server providing workspace file operations, validation, and export endpoints, built with Fastify or Hono replacing the raw Node.js http module.
- **Framer_Motion**: The animation library used to implement Material Design 3 motion patterns (container transforms, shared axis transitions, drawer slides, FAB scaling).
- **Frontmatter_Schema**: A type-specific definition of which frontmatter fields are available, their input types, validation rules, and conditional visibility based on other field values.
- **Narrative_Scaffolding_Editor**: An inline dialog that appears when attaching a resource to a node, allowing the user to customize the prefix and suffix text around the `{{ref}}` token before it is inserted into the markdown.
- **Usage_Instance**: A single occurrence of a resource reference within a node's markdown, consisting of the ref token plus its surrounding narrative text (prefix + ref + suffix). The same resource can have multiple Usage_Instances in one node with different narrative contexts.

## Requirements

### Requirement 1: Material Design 3 Visual Design System

**User Story:** As a developer, I want the AgentFlow UI to follow Material Design 3 principles with card-based layouts, elevation hierarchy, and Roboto typography, so that the interface feels modern, consistent, and familiar to users of Google-style productivity tools.

#### Acceptance Criteria

1. THE App SHALL use the Roboto font family as the primary typeface (via `@fontsource/roboto`), with Roboto Mono for code and monospace contexts, falling back to the system sans-serif font stack.
2. THE App SHALL implement the Material Design 3 color system using CSS custom properties for surface, on-surface, primary, secondary, tertiary, and error color roles in both light and dark modes.
3. THE App SHALL use Material Design 3 elevation levels (0dp, 1dp, 3dp, 6dp, 8dp, 12dp) implemented as CSS box-shadow tokens, where higher elevation indicates greater visual prominence.
4. THE App SHALL use a consistent border-radius of 12px for cards and containers, 8px for buttons and inputs, and 28px for FABs and chips, following Material Design 3 shape scale.
5. THE App SHALL use the Material Design 3 type scale: display (57px), headline (32px), title (22px/16px), body (16px/14px), and label (14px/12px/11px) with appropriate line heights and letter spacing.
6. THE App SHALL apply surface-container color variants (surface-container-lowest, surface-container-low, surface-container, surface-container-high, surface-container-highest) to create visual depth without relying solely on borders.
7. THE App SHALL use Material Design 3 state layers (hover: 8% opacity, focus: 12%, pressed: 12%, dragged: 16%) applied as semi-transparent overlays on interactive elements.
8. THE App SHALL replace all current zinc/slate color tokens with Material Design 3 neutral and neutral-variant tones derived from a seed color palette.

### Requirement 2: Docked Panel Layout (Replacing Floating Panels)

**User Story:** As a developer, I want stable, docked panels instead of floating overlays, so that the UI has a predictable layout where panels don't overlap the graph canvas or each other.

#### Acceptance Criteria

1. THE App SHALL use a CSS Grid or Flexbox-based layout with three zones: a collapsible left Explorer_Panel (280px default width), a center Graph_Canvas (flex-grow), and a slide-out right Node_Drawer (400px default width).
2. THE Explorer_Panel SHALL be docked to the left edge of the viewport with a resize handle, and SHALL collapse to a 48px icon rail when minimized.
3. THE Node_Drawer SHALL slide in from the right edge when a node or resource is selected, pushing or overlaying the Graph_Canvas without obscuring other panels.
4. WHEN the Node_Drawer opens, THE Graph_Canvas SHALL resize to accommodate the drawer, maintaining all visible nodes within the viewport.
5. THE Action_Bar SHALL be docked to the top of the viewport as a fixed-height (56px) horizontal bar spanning the full width.
6. THE App SHALL NOT use absolutely positioned floating panels for primary UI regions (Explorer, Detail/Drawer, Toolbar).
7. WHEN the viewport width is below 1024px, THE App SHALL collapse the Explorer_Panel to the icon rail by default and THE Node_Drawer SHALL overlay the canvas as a Bottom_Sheet instead of a side panel.

### Requirement 3: n8n-Inspired Node Cards on Canvas

**User Story:** As a developer, I want workflow nodes rendered as rich Material Design cards on the canvas with icons, status indicators, and inline resource chips, so that I can understand node purpose and connections at a glance without opening a detail panel — similar to how n8n renders its nodes.

#### Acceptance Criteria

1. THE Graph_Canvas SHALL render each workflow node as a Node_Card — a Material Design card with elevation level 1 (resting) and elevation level 3 (hovered/selected).
2. EACH Node_Card SHALL display: a colored header bar indicating node type (step: blue-600, router: amber-600, sub-workflow: purple-600), the node name as title text, and a node type icon.
3. EACH Node_Card SHALL display a Resource_Chip_Group below the title showing up to 4 attached resources as Material Design chips (icon + truncated name), with a "+N more" overflow indicator when more than 4 resources are attached.
4. WHEN a Node_Card represents a router node, THE Node_Card SHALL display the number of outgoing conditional edges as a badge on the card.
5. WHEN a Node_Card represents a sub-workflow node, THE Node_Card SHALL display a "drill down" icon button that navigates into the sub-workflow.
6. THE Node_Card SHALL display connection handles (source on right, target on left) styled as Material Design filled circles (8px diameter) with the node type accent color.
7. WHEN a Node_Card is selected, THE Node_Card SHALL display a 2px outline ring using the primary color and increase elevation to level 3.
8. WHEN the user hovers over a Node_Card, THE Node_Card SHALL display a Node_Toolbar above the card with quick action icon buttons: edit (opens Node_Drawer), delete, duplicate, and add-connection.
9. THE Graph_Canvas SHALL render edges as smooth bezier curves with animated flow indicators (dashed line animation) to show data direction, similar to n8n's edge rendering.
10. WHEN an edge represents a conditional connection, THE Graph_Canvas SHALL display the condition name as a Material Design label chip on the edge midpoint.

### Requirement 4: Node Drawer (Replacing Floating Detail Panel)

**User Story:** As a developer, I want a slide-out drawer for editing node details with tabbed sections, so that I can edit content, view properties, manage references, and preview output without a cluttered single-scroll panel.

#### Acceptance Criteria

1. WHEN the user selects a node or resource (via canvas click, explorer click, or search), THE App SHALL open the Node_Drawer sliding in from the right edge.
2. THE Node_Drawer SHALL contain a Tab_Bar with four tabs: Content (markdown editor), Properties (frontmatter form), References (ref list with navigation), and Preview (resolved markdown output).
3. WHEN the Content tab is active, THE Node_Drawer SHALL display the tiptap Editor with interactive Ref_Chips, slash command support, and narrative block decorations.
4. WHEN the Properties tab is active, THE Node_Drawer SHALL display the frontmatter form with Material Design text fields, dropdowns, and switches for each frontmatter property.
5. WHEN the References tab is active, THE Node_Drawer SHALL display all Ref_Tokens in the selected file grouped by semantic type (edges, mentions, data flows), each clickable to navigate to the referenced resource.
6. WHEN the Preview tab is active, THE Node_Drawer SHALL render the fully resolved markdown content with all Ref_Tokens replaced by their resolved values.
7. THE Node_Drawer SHALL display a header with the node/resource name, type badge, file path, and a close button.
8. THE Node_Drawer SHALL display validation errors and warnings for the selected file as Material Design alert banners below the header, collapsible to save space.
9. WHEN the user presses Escape, THE Node_Drawer SHALL close and deselect the current selection.
10. THE Node_Drawer SHALL support keyboard shortcut Ctrl/Cmd+1 through Ctrl/Cmd+4 to switch between tabs.
11. WHEN the Properties tab is active AND the selected file has no frontmatter, THE Node_Drawer SHALL display an empty form with a prompt to "Add Properties" and a button that inserts a `---\n---` frontmatter block into the file.
12. THE Properties tab SHALL render type-aware form fields based on the resource's `type` frontmatter value, showing only fields relevant to that type (see Requirement 20 for field schemas).
13. WHEN the user changes the `type` field value, THE Properties tab SHALL dynamically update the visible fields to match the new type's schema.

### Requirement 5: Global Command Palette

**User Story:** As a developer, I want a Ctrl+K command palette for searching nodes, resources, and executing quick actions, so that I can navigate large workflows efficiently without manually scanning the explorer or canvas — similar to n8n's node search and VS Code's command palette.

#### Acceptance Criteria

1. WHEN the user presses Ctrl/Cmd+K, THE App SHALL display the Command_Palette as a centered modal overlay with a search input and results list.
2. THE Command_Palette SHALL search across all nodes, resources (tools, skills, templates, interactions, memory), and workflows in the current workspace using fuzzy matching on name and description.
3. WHEN the user selects a node result from the Command_Palette, THE App SHALL pan the Graph_Canvas to center on that node, select it, and open the Node_Drawer.
4. WHEN the user selects a resource result from the Command_Palette, THE App SHALL select the resource and open the Node_Drawer showing its content.
5. THE Command_Palette SHALL display each result with its Resource_Type icon, name, type badge, and a truncated description, styled as Material Design list items.
6. THE Command_Palette SHALL support keyboard navigation: Arrow Up/Down to move selection, Enter to confirm, Escape to dismiss.
7. THE Command_Palette SHALL display results grouped by category (Nodes, Tools, Skills, etc.) with section headers.
8. WHEN the search input is empty, THE Command_Palette SHALL display recent selections and frequently accessed items.
9. THE Command_Palette SHALL support action commands prefixed with `>` (e.g., `>export`, `>validate`, `>add node`) for executing quick actions without navigating menus.

### Requirement 6: Enhanced Action Bar (Replacing Sparse Toolbar)

**User Story:** As a developer, I want a comprehensive top toolbar with workflow controls, zoom, undo/redo, search trigger, and quick actions, so that all primary operations are accessible from a single consistent location — similar to n8n's top bar.

#### Acceptance Criteria

1. THE Action_Bar SHALL be a 56px-height docked horizontal bar at the top of the viewport with Material Design surface-container-low background and elevation level 2.
2. THE Action_Bar SHALL contain (left to right): a hamburger menu button to toggle the Explorer_Panel, a Breadcrumb_Bar showing the current workflow path, a Workflow_Selector dropdown, a divider, undo/redo icon buttons, a divider, zoom controls (zoom in, zoom out, fit view, zoom percentage display), a divider, a search trigger button (showing Ctrl+K hint), a validate button with status indicator, an export button, a theme toggle, and a user/settings menu.
3. WHEN the user clicks the undo button, THE App SHALL reverse the last editing operation (content edit, connection creation, resource attachment).
4. WHEN the user clicks the redo button, THE App SHALL re-apply the last undone operation.
5. THE Action_Bar SHALL display the current zoom level as a percentage next to the zoom controls.
6. WHEN the user clicks the fit-view button, THE Graph_Canvas SHALL zoom and pan to fit all nodes within the visible viewport with padding.
7. THE Action_Bar SHALL display a validation status indicator: a green checkmark when no errors exist, a red badge with error count when validation errors are present, and a yellow badge when only warnings exist.
8. WHEN the Breadcrumb_Bar shows a sub-workflow path, THE Breadcrumb_Bar SHALL allow clicking any ancestor segment to navigate back up the workflow hierarchy.

### Requirement 7: Canvas Minimap and Navigation

**User Story:** As a developer, I want a minimap overlay and enhanced navigation controls on the canvas, so that I can orient myself in large workflows and quickly navigate to distant parts of the graph.

#### Acceptance Criteria

1. THE Graph_Canvas SHALL display a Minimap in the bottom-right corner as a Material Design card with elevation level 1, showing a simplified overview of all nodes and the current viewport rectangle.
2. THE Minimap SHALL be interactive: clicking or dragging within the Minimap SHALL pan the Graph_Canvas to the corresponding position.
3. THE Minimap SHALL be collapsible via a toggle button, and THE App SHALL persist the collapsed/expanded state in localStorage.
4. THE Graph_Canvas SHALL support keyboard shortcuts for navigation: Ctrl/Cmd+= to zoom in, Ctrl/Cmd+- to zoom out, Ctrl/Cmd+0 to fit view, and arrow keys to pan when no node is selected.
5. WHEN the user double-clicks on empty canvas space, THE App SHALL display a quick-add node menu at the click position, allowing the user to create a new node (step, router, or sub-workflow) directly on the canvas.
6. THE Graph_Canvas SHALL display a subtle dot grid pattern on the background, using Material Design surface-container-lowest color for dots in light mode and surface-container color for dots in dark mode.

### Requirement 8: Undo/Redo System

**User Story:** As a developer, I want undo and redo support for all editing operations, so that I can safely experiment with changes and revert mistakes without losing work.

#### Acceptance Criteria

1. THE App SHALL maintain an undo stack that records all state-changing operations: content edits, connection creation/deletion, resource attachment/detachment, node creation/deletion, and frontmatter changes.
2. WHEN the user presses Ctrl/Cmd+Z, THE App SHALL undo the most recent operation by restoring the previous state.
3. WHEN the user presses Ctrl/Cmd+Shift+Z (or Ctrl+Y), THE App SHALL redo the most recently undone operation.
4. THE undo stack SHALL store a maximum of 50 operations to limit memory usage.
5. WHEN a new operation is performed after an undo, THE App SHALL clear the redo stack (standard undo/redo behavior).
6. THE undo/redo buttons in the Action_Bar SHALL be visually disabled (reduced opacity, no pointer events) when their respective stacks are empty.
7. WHEN an undo or redo operation completes, THE App SHALL display a Snackbar briefly describing the operation that was undone or redone (e.g., "Undone: deleted connection to analyze-results").

### Requirement 9: Material Design Theme System

**User Story:** As a developer, I want the app to support light, dark, and system-auto themes using Material Design 3 color tokens, so that the interface adapts to my preference with proper contrast and visual hierarchy in both modes.

#### Acceptance Criteria

1. THE App SHALL implement Material Design 3 dynamic color theming using a seed color (default: blue-600 / #1565C0) to generate the full tonal palette for primary, secondary, tertiary, error, and neutral color roles.
2. WHEN the App loads and no persisted Theme_Mode preference exists, THE App SHALL detect the OS color scheme preference via `prefers-color-scheme` and apply the matching theme.
3. THE App SHALL provide a theme toggle in the Action_Bar that cycles through light, dark, and system modes, displaying the current mode icon (sun, moon, or auto).
4. WHEN the user selects a Theme_Mode, THE App SHALL persist the selection in localStorage and apply it immediately without page reload.
5. WHILE the dark theme is active, THE App SHALL use Material Design 3 dark scheme colors: surface (#121212), surface-container (#1E1E1E), on-surface (#E6E1E5), primary (#D0BCFF), and corresponding tonal variants.
6. WHILE the dark theme is active, THE App SHALL ensure all text, icons, and interactive elements maintain a minimum contrast ratio of 4.5:1 against their background surfaces per WCAG AA.
7. THE App SHALL apply the theme class to the root HTML element via a blocking inline script before first paint to prevent flash of incorrect theme (FOUC prevention).
8. WHILE the Theme_Mode is set to system, WHEN the OS color scheme preference changes, THE App SHALL update the active theme to match without requiring a page reload.

### Requirement 10: Material Design Component Library

**User Story:** As a developer, I want all UI components (buttons, inputs, chips, cards, dialogs) to follow Material Design 3 specifications, so that the interface is visually consistent and interactions feel familiar.

#### Acceptance Criteria

1. THE App SHALL render all buttons using the MUI v6 Button component with variant prop (contained for primary actions, outlined for secondary actions, text for tertiary actions) and color prop for tonal emphasis, with MUI's built-in state layers for hover, focus, and pressed states.
2. THE App SHALL render all text inputs using the MUI v6 TextField component with the outlined variant and floating labels, supporting helperText, error prop, and InputProps for leading/trailing icons.
3. THE App SHALL render all selection controls using MUI v6 Select, Switch, and Checkbox components with proper touch targets (minimum 48px) configured via MUI theme spacing.
4. THE App SHALL render transient notifications using the MUI v6 Snackbar component combined with the Alert component, positioned at the bottom-center of the viewport, auto-dismissing after 4 seconds via the autoHideDuration prop, with an optional action button.
5. THE App SHALL render confirmation dialogs using the MUI v6 Dialog component with DialogTitle, DialogContent, and DialogActions sub-components for title, content, and action buttons (cancel/confirm), using MUI's built-in Backdrop as the scrim overlay.
6. THE App SHALL render all chips (Ref_Chips, resource chips, filter chips) using the MUI v6 Chip component: 32px height, 8px border-radius, with icon prop for leading icons and onDelete for close button where applicable.
7. THE App SHALL render loading states using the MUI v6 CircularProgress component for indeterminate loading and LinearProgress component with variant="determinate" for determinate operations (e.g., export progress).

### Requirement 11: Improved Empty States and Onboarding

**User Story:** As a developer, I want helpful empty states with action prompts when no workspace is loaded, no nodes exist, or no selection is active, so that I always know what to do next — similar to how Zapier guides new users through workflow creation.

#### Acceptance Criteria

1. WHEN no workspace is loaded, THE App SHALL display a full-screen Empty_State with an illustration, a headline ("No workspace loaded"), a description explaining how to open a workspace, and a primary action button to open a directory.
2. WHEN a workspace is loaded but the active workflow has no nodes, THE Graph_Canvas SHALL display an Empty_State in the center with an illustration, a headline ("Start building your workflow"), a description, and a FAB or primary button to add the first node.
3. WHEN no node or resource is selected and the Node_Drawer is closed, THE App SHALL NOT display any empty detail panel — the Graph_Canvas SHALL occupy the full available width.
4. WHEN the Explorer_Panel has a section with zero items, THE Explorer_Panel SHALL hide that section entirely rather than showing an empty list.
5. WHEN the Command_Palette search returns no results, THE Command_Palette SHALL display a helpful message ("No results found") with a suggestion to try different search terms.
6. THE App SHALL display contextual tooltips on first use for key features: the FAB for adding nodes, the Command_Palette shortcut, and the Explorer_Panel toggle.

### Requirement 12: FAB for Node Creation

**User Story:** As a developer, I want a Floating Action Button on the canvas for quickly adding new nodes, so that the most common action (creating a workflow step) is always one click away — similar to n8n's "+" button.

#### Acceptance Criteria

1. THE Graph_Canvas SHALL display a FAB in the bottom-right corner (above the Minimap) using Material Design 3 FAB styling: 56px diameter, primary color, elevation level 3, with a "+" icon.
2. WHEN the user clicks the FAB, THE App SHALL display a Material Design 3 menu listing node type options: Step, Router, and Sub-Workflow, each with its type icon and description.
3. WHEN the user selects a node type from the FAB menu, THE App SHALL create a new node of that type at the center of the current viewport on the Graph_Canvas.
4. WHEN a new node is created via the FAB, THE App SHALL immediately select the new node and open the Node_Drawer to the Content tab for editing.
5. THE FAB SHALL animate with a Material Design 3 container transform when opening the node type menu.
6. WHEN the Node_Drawer is open, THE FAB SHALL remain visible and accessible.

### Requirement 13: Improved Explorer Panel with Material Design

**User Story:** As a developer, I want the explorer panel to use Material Design list items, expansion panels, and search, so that navigating workspace resources feels consistent with the rest of the redesigned UI.

#### Acceptance Criteria

1. THE Explorer_Panel SHALL display workspace contents grouped into collapsible Material Design expansion panels: Workflows, Nodes, Tools, Skills, Conditions, Interactions, and Memory.
2. EACH expansion panel header SHALL display the category icon, category label, and an item count badge using Material Design 3 badge styling.
3. EACH item within an expansion panel SHALL be rendered as a Material Design 3 list item with a leading icon (category-specific), primary text (resource name), and optional secondary text (description truncated to one line).
4. THE Explorer_Panel SHALL provide a search input at the top (Material Design 3 outlined text field) that filters all items across all categories using case-insensitive substring matching.
5. WHEN the user selects an item in the Explorer_Panel, THE item SHALL display a Material Design 3 active state (primary-container background) and THE App SHALL select the corresponding node or resource.
6. THE Explorer_Panel SHALL display a tab bar at the top with two tabs: "Semantic" (grouped by type) and "Files" (directory tree), matching the current dual-view functionality but styled with Material Design 3 tabs.
7. WHEN the Explorer_Panel is collapsed to the icon rail, THE icon rail SHALL display category icons vertically, and hovering over an icon SHALL display a tooltip with the category name.

### Requirement 14: Edge Rendering and Interaction Improvements

**User Story:** As a developer, I want edges on the canvas to be visually clear with animated flow direction, interactive hover states, and easy deletion, so that I can understand and manage workflow connections efficiently.

#### Acceptance Criteria

1. THE Graph_Canvas SHALL render edges as smooth bezier curves with a 2px stroke width, using the Material Design outline color in resting state and the primary color when hovered or selected.
2. WHEN the user hovers over an edge, THE edge SHALL increase stroke width to 3px, display the edge label (target node name or condition), and show a delete button (X icon) at the edge midpoint.
3. WHEN the user clicks the delete button on an edge, THE App SHALL remove the corresponding Edge_Ref from the source node's markdown content and display a Snackbar with an undo option.
4. THE Graph_Canvas SHALL render animated dashed-line flow indicators on edges to show data direction (from source to target), using a subtle animation that doesn't distract from the overall view.
5. WHEN an edge represents a conditional connection, THE Graph_Canvas SHALL display the condition name as a Material Design label chip positioned at the edge midpoint.
6. THE Graph_Canvas SHALL support edge creation by dragging from a source node's output handle to a target node's input handle, with a visual guide line following the cursor during the drag.

### Requirement 15: Responsive Layout Adaptations

**User Story:** As a developer, I want the UI to adapt gracefully to different viewport sizes, so that I can use AgentFlow on various screen sizes from large monitors to laptops.

#### Acceptance Criteria

1. WHEN the viewport width is 1440px or wider, THE App SHALL display the Explorer_Panel (280px), Graph_Canvas (flex), and Node_Drawer (400px) simultaneously without overlap.
2. WHEN the viewport width is between 1024px and 1439px, THE App SHALL collapse the Explorer_Panel to the icon rail (48px) by default, with the Graph_Canvas and Node_Drawer sharing the remaining space.
3. WHEN the viewport width is below 1024px, THE Node_Drawer SHALL render as a Bottom_Sheet overlay (70% viewport height) instead of a side panel, and THE Explorer_Panel SHALL be accessible only via the hamburger menu as a temporary overlay.
4. THE Graph_Canvas SHALL always occupy at minimum 50% of the viewport width to ensure the workflow graph remains usable.
5. THE Action_Bar SHALL collapse less-used controls into an overflow menu (three-dot icon) when the viewport width is below 1280px, keeping only essential controls (breadcrumbs, search, validate, export) visible.

### Requirement 16: Snackbar Notification System

**User Story:** As a developer, I want transient notifications for operation feedback (save success, validation errors, export complete) displayed as Material Design snackbars, so that I receive clear feedback without modal interruptions.

#### Acceptance Criteria

1. WHEN an operation completes successfully (save, export, library add, connection create), THE App SHALL display a Snackbar at the bottom-center with a success message, auto-dismissing after 4 seconds.
2. WHEN an operation fails, THE App SHALL display a Snackbar with an error message and a "Retry" action button, auto-dismissing after 6 seconds.
3. WHEN an undo-able operation completes (delete node, delete edge, detach resource), THE Snackbar SHALL include an "Undo" action button.
4. THE App SHALL queue multiple Snackbars, displaying them one at a time with a brief transition between consecutive messages.
5. THE Snackbar SHALL be styled following Material Design 3 specifications: surface-inverse background, on-inverse text, 344px max width, 8px border-radius, elevation level 3.
6. THE user SHALL be able to dismiss any Snackbar early by clicking the close icon or swiping (on touch devices).

### Requirement 17: Node Type Visual Differentiation (Material Design)

**User Story:** As a developer, I want each node type and resource type to have a distinct Material Design color and icon treatment, so that I can instantly identify what kind of element I'm looking at across the canvas, explorer, drawer, and chips.

#### Acceptance Criteria

1. THE App SHALL maintain a single CATEGORY_CONFIG source of truth mapping each resource/node type to: a Material Design icon (from Lucide), a primary tonal color (from the Material Design 3 palette), a container color (tonal surface variant), and a label string.
2. THE Node_Card header bar color SHALL match the node type's primary tonal color: blue for step nodes, amber for router nodes, purple for sub-workflow nodes.
3. THE Ref_Chip SHALL use the category-specific tonal color as its container background and the on-tonal color for text and icon, following Material Design 3 chip color specifications.
4. THE Explorer_Panel list items SHALL display the category-specific icon in the category's primary tonal color.
5. THE Resource_Chip_Group on Node_Cards SHALL use the same category-specific colors as the Ref_Chips in the Editor, ensuring visual consistency across canvas and editor views.
6. THE Command_Palette search results SHALL display the category-specific icon and color for each result item.
7. THE App SHALL use consistent iconography from the Lucide icon set across all components: Wrench (tools), Brain (skills), Zap (conditions/templates), MessageSquare (interactions), Database (memory), Box (nodes), GitBranch (workflows).

### Requirement 18: Technology Stack Modernization

**User Story:** As a developer, I want the application's technology stack modernized with purpose-built libraries for state management, UI primitives, backend routing, typography, and animation, so that the codebase is more maintainable, performant, and aligned with the Material Design 3 redesign.

#### Acceptance Criteria

1. THE App SHALL replace the custom Context API store (`store.tsx`) with a Zustand_Store, providing selective state subscriptions to prevent unnecessary component re-renders.
2. THE Zustand_Store SHALL expose granular selector hooks (e.g., `useNodes()`, `useSelectedNode()`, `useThemeMode()`) so that components subscribe only to the state slices they consume.
3. THE Zustand_Store SHALL NOT require React Context providers or provider nesting — components SHALL access state directly via Zustand hooks.
4. THE App SHALL adopt MUI v6 (@mui/material) as the foundational UI component library for implementing Material Design 3 components (buttons, text fields, chips, dialogs, menus, tooltips, popovers, switches, tabs, snackbars, FABs, and progress indicators), using MUI's built-in theming system to configure the Material Design 3 seed color palette, typography (Roboto), shape scale, and elevation tokens.
5. THE API_Server SHALL replace the raw Node.js `http` module and `serve-handler` with Fastify or Hono, providing typed route definitions, middleware support, structured error handling, and JSON schema validation for request/response payloads.
6. THE API_Server SHALL maintain all existing API endpoints and response contracts during the migration, ensuring backward compatibility with the UI client.
7. THE App SHALL replace `@fontsource/inter` with `@fontsource/roboto` (weights 300, 400, 500, 700) and `@fontsource/roboto-mono` (weights 400, 500) for all typography rendering.
8. THE App SHALL add Framer_Motion as the animation library for implementing Material Design 3 motion patterns: drawer slide-in/out transitions, FAB scale animations, container transform transitions, and shared-axis navigation transitions.
9. THE App SHALL remove the `react-arborist` dependency and replace its tree rendering functionality with custom Material Design 3 expansion panels in the Explorer_Panel, using the adopted UI primitive library for accessible expand/collapse behavior.
10. WHEN migrating from the Context API store to the Zustand_Store, THE App SHALL preserve all existing application state shape and behavior, ensuring no regression in workspace loading, node selection, editor content, or validation state.
11. IF the Zustand_Store migration introduces a state shape change, THEN THE App SHALL include a migration adapter that maps the previous state structure to the new Zustand_Store structure for any persisted state in localStorage.

### Requirement 19: Zustand-Based Undo/Redo System

**User Story:** As a developer, I want the undo/redo system (defined in Requirement 8) implemented using Zustand temporal middleware or a custom Zustand middleware, so that undo/redo is deeply integrated with the state management layer rather than maintained as a separate ad-hoc system.

#### Acceptance Criteria

1. THE Zustand_Store SHALL integrate temporal middleware (via `zundo` or a custom implementation) to automatically track state changes in the Undo_Stack and Redo_Stack.
2. THE temporal middleware SHALL capture state snapshots for all undoable operations: content edits, node creation/deletion, edge creation/deletion, resource attachment/detachment, and frontmatter changes.
3. THE temporal middleware SHALL support configurable state diffing so that only changed state slices are stored in the Undo_Stack, limiting memory consumption.
4. THE Zustand_Store SHALL expose `undo()` and `redo()` action methods that the Action_Bar buttons and keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z) invoke directly.
5. THE Zustand_Store SHALL expose `canUndo` and `canRedo` boolean selectors that the Action_Bar uses to enable or disable the undo/redo buttons.
6. THE temporal middleware SHALL enforce a maximum of 50 entries in the Undo_Stack, discarding the oldest entry when the limit is exceeded, consistent with Requirement 8 acceptance criterion 4.
7. WHEN a new state-changing operation is performed after one or more undo operations, THE temporal middleware SHALL clear the Redo_Stack, consistent with Requirement 8 acceptance criterion 5.
8. THE temporal middleware SHALL support operation grouping so that rapid sequential edits within the tiptap Editor (keystrokes within 500ms of each other) are batched into a single undo entry rather than recorded individually.
9. THE temporal middleware SHALL exclude transient UI state (panel open/closed, scroll position, hover state, zoom level) from the Undo_Stack, tracking only domain-relevant state changes.
10. FOR ALL sequences of N undo operations followed by N redo operations (where N is less than or equal to the Undo_Stack depth), THE Zustand_Store SHALL restore the original state prior to the undo sequence (round-trip property).

### Requirement 20: Type-Aware Frontmatter Schema System

**User Story:** As a developer, I want the frontmatter form to show the right fields for each resource type with proper input controls, validation, and conditional fields, so that I don't have to remember which YAML keys are valid for each type and the form guides me toward correct metadata.

#### Acceptance Criteria

1. THE App SHALL define a Frontmatter_Schema registry mapping each resource type to its built-in fields. The built-in field sets are:

   **Nodes** (type: step | router | sub-workflow):
   - `name` (text, required) — node identifier
   - `type` (select: step/router/sub-workflow, required) — node type
   - `description` (textarea) — what this node does
   - `entry` (boolean switch) — is this a workflow entry point
   - `primary` (boolean switch) — is this the primary file in a multi-file node
   - `inputs` (tag list) — expected input data names
   - `outputs` (tag list) — produced output data names

   **Tools** (type: builtin | script | mcp | package):
   - `name` (text, required) — tool identifier
   - `type` (select: builtin/script/mcp/package, required) — tool invocation type
   - `description` (textarea) — what this tool does
   - `outputs` (tag list) — what this tool produces
   - `parameters` (key-value list) — parameters the tool accepts
   - `narrativeTemplate` (group: prefix text + suffix text) — default narrative scaffolding
   - WHEN type is `script`: `command` (text, required) — shell command to execute
   - WHEN type is `mcp`: `mcp` (text, required) — MCP server name
   - WHEN type is `package`: `package` (text, required) — npm/pip package name
   - WHEN type is `builtin`: `builtin_mapping` (text) — internal mapping identifier

   **Skills** (type: skill OR inferred from skills/ directory):
   - `name` (text, required) — skill identifier
   - `description` (textarea) — what this skill does
   - `domain` (text with suggestions: dev, security, content, ops, data) — category tag
   - `narrativeTemplate` (group: prefix text + suffix text)

   **Interactions** (type: approval | freeform | choice | confirm):
   - `name` (text, required) — interaction identifier
   - `type` (select: approval/freeform/choice/confirm, required) — interaction style
   - `description` (textarea) — what this interaction does
   - `narrativeTemplate` (group: prefix text + suffix text)

   **Templates/Conditions** (type: condition OR inferred from templates/ directory):
   - `name` (text, required) — condition identifier
   - `type` (select: condition) — always condition
   - `description` (textarea) — what this condition checks
   - `narrativeTemplate` (group: prefix text + suffix text)

   **Memory** (inferred from memory/ directory):
   - `name` (text, required) — memory identifier
   - `description` (textarea) — what this memory stores
   - `editable` (boolean switch) — can the agent write to this file
   - `narrativeTemplate` (group: prefix text + suffix text)

2. THE Properties tab SHALL always display all built-in fields for the detected resource type, pre-filled with existing values or empty/default. Fields SHALL NOT be hidden just because they don't exist in the current frontmatter.
3. WHEN a tool's `type` field is changed (e.g., from `builtin` to `script`), THE Properties tab SHALL immediately show the conditional fields for the new type (e.g., show `command` field) and hide fields from the previous type (e.g., hide `builtin_mapping`).
4. THE Properties tab SHALL render each field with the appropriate MUI v6 input component: TextField for text, TextField multiline for textarea, Select for dropdowns, Switch for booleans, and a custom TagInput (MUI Chip-based) for array fields like `inputs`, `outputs`, and `parameters`.
5. THE Properties tab SHALL display a divider labeled "Custom Fields" below the built-in fields, followed by any frontmatter keys that are NOT part of the built-in schema, rendered as editable key-value text fields.
6. THE Properties tab SHALL provide an "Add Custom Field" button below the custom fields section that adds a new empty key-value row.
7. WHEN the user saves the Properties form, THE App SHALL serialize all fields (built-in + custom) back into valid YAML frontmatter, preserving field order (built-in fields first, then custom fields alphabetically).
8. FOR files with no detected resource type (untyped markdown), THE Properties tab SHALL display only `name` and `description` as built-in fields, plus a `type` dropdown allowing the user to assign a type, which then reveals the full field set for that type.
9. THE `narrativeTemplate` field group SHALL display two text inputs (prefix and suffix) with a live preview below showing: `[prefix] {{category/name}} [suffix]` rendered as a styled sentence.

### Requirement 21: Narrative Scaffolding Attachment Flow

**User Story:** As a developer, I want to customize the narrative sentence around a resource reference when I attach it to a node, so that the generated markdown reads as natural instructions with proper context about how and why the resource is used in that specific step.

#### Acceptance Criteria

1. WHEN the user attaches a resource to a node (via drag-drop from explorer/palette, slash command, or command palette), THE App SHALL display the Narrative_Scaffolding_Editor as an inline popover near the insertion point.
2. THE Narrative_Scaffolding_Editor SHALL display three sections: an editable prefix text field (pre-filled from the resource's `narrativeTemplate.prefix` or the category default), the ref token `{{category/name}}` displayed as a non-editable styled chip, and an editable suffix text field (pre-filled from the resource's `narrativeTemplate.suffix` or the category default).
3. THE Narrative_Scaffolding_Editor SHALL display a live preview below the fields showing the full rendered sentence (e.g., "Use the {{tools/read-file}} tool to read the configuration file").
4. THE Narrative_Scaffolding_Editor SHALL provide three action buttons: "Insert" (inserts the full sentence), "Insert bare ref" (inserts only `{{category/name}}` without prefix/suffix), and "Cancel".
5. WHEN the user clicks "Insert", THE App SHALL insert the full narrative sentence (`prefix {{ref}} suffix`) at the cursor position in the node's markdown editor.
6. THE user SHALL be able to attach the same resource multiple times to the same node, each as an independent Usage_Instance with its own prefix/suffix. For example: "Use {{tools/read-code}} to analyze the module structure" and "Use {{tools/read-code}} to check for unused imports" in the same node.
7. EACH Usage_Instance SHALL be independent — editing the prefix/suffix of one instance SHALL NOT affect other instances of the same resource in the same node or other nodes.
8. WHEN the user edits existing narrative text around a ref chip in the tiptap editor, THE changes SHALL be preserved as-is — the narrative scaffolding is only a starting point, not enforced after insertion.
9. THE Narrative_Scaffolding_Editor SHALL remember the last-used prefix/suffix for each resource (per session) and offer it as the default for subsequent attachments of the same resource.

### Requirement 22: Unrestricted File Model and Inline Resource Creation

**User Story:** As a developer, I want to use any markdown file as a resource regardless of where it lives in the workspace, and I want to create new resources directly from the node editing context, so that the directory structure is a helpful convention but never a blocker.

#### Acceptance Criteria

1. THE App SHALL allow any `.md` file in the workspace to be referenced via `{{path/to/file}}` syntax, regardless of whether it resides in a reserved directory (tools/, skills/, etc.) or an arbitrary location.
2. WHEN a `.md` file has no `type` in its frontmatter and does not reside in a reserved directory, THE App SHALL treat it as an untyped resource that can still be referenced, attached to nodes, and displayed in the explorer under an "Other" or "Files" category.
3. THE Explorer_Panel SHALL include an "Untyped" or "Other Files" section that lists all `.md` files that don't fall into a recognized resource category, so users can discover and use them.
4. THE Node_Drawer SHALL provide a "Create Resource" button (in the Content tab toolbar or via slash command) that opens an inline dialog for creating a new resource file. The dialog SHALL include: a name field, a type dropdown (tool/skill/template/interaction/memory/none), and a location selector (defaulting to the appropriate reserved directory for the chosen type, or the workspace root for "none").
5. WHEN a new resource is created via the Node_Drawer, THE App SHALL immediately insert a ref to the new resource at the cursor position in the editor and open the new resource in a secondary drawer or tab for editing.
6. THE App SHALL support drag-and-drop of any `.md` file from the Files tab of the Explorer_Panel onto the canvas or into the editor, treating it as a resource attachment regardless of its classification.
7. WHEN an untyped file is attached to a node, THE Narrative_Scaffolding_Editor SHALL use empty prefix/suffix defaults (since there's no category-based default), allowing the user to write custom narrative text.
8. THE Properties tab SHALL work for ANY `.md` file, including untyped files. For files with no frontmatter at all, it SHALL offer to create a frontmatter block and show the minimal field set (name, description, type selector).

### Requirement 23: Resource Usage Visibility on Canvas

**User Story:** As a developer, I want to see which resources each node uses directly on the canvas cards, and I want to see which resources are unused across the workspace, so that I can understand dependencies at a glance without opening each node.

#### Acceptance Criteria

1. EACH Node_Card on the Graph_Canvas SHALL display a Resource_Chip_Group showing all resources referenced in that node's markdown (tools, skills, templates, interactions, memory), extracted from the node's parsed refs where semanticType is 'mention'.
2. THE Resource_Chip_Group SHALL display each resource as a compact MUI Chip with the category icon and truncated name, using the category-specific tonal color from CATEGORY_CONFIG.
3. WHEN the Resource_Chip_Group contains more than 4 resources, THE Node_Card SHALL display the first 4 chips plus a "+N more" overflow chip that expands to show all resources on click.
4. WHEN the user clicks a resource chip on a Node_Card, THE App SHALL select that resource and open the Node_Drawer showing the resource's content (not the node's content).
5. THE Explorer_Panel SHALL display a visual indicator (e.g., a usage count badge or dimmed styling) on resources that are referenced by zero nodes in the current workflow, helping users identify unused resources.
6. WHEN the user hovers over a resource in the Explorer_Panel, THE App SHALL highlight all Node_Cards on the canvas that reference that resource, using a subtle pulse or outline animation.
