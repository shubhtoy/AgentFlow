# Requirements Document

## Introduction

Comprehensive UI overhaul for the AgentFlow v2 application. The goal is to transform the current interface into a minimal, Notion-like aesthetic with clean typography, generous whitespace, and muted colors. The overhaul spans thirteen areas: visual design system, semantic explorer panel, interactive ref rendering in the markdown editor, Notion-style slash command ref insertion (replacing the `{{` autocomplete trigger with a `/` command palette while retaining `{{}}` as the underlying markdown syntax), bidirectional graph-explorer sync, drag-and-drop connection creation, a library panel for browsing and importing reusable components, visual differentiation of built-in resource types, structured workflow export replacing the flat JSON dump with a multi-format Export_Bundle, a structured directory-based export that produces human-readable YAML, Markdown, and metadata files organized by semantic category, a resource palette with drag-and-drop attachment and IO contract compatibility checking, narrative ref composition that provides drag-and-drop narrative scaffolding with optional prefix/suffix templates on resources and visual chunking in the editor to surface the story structure of skill files, theme support providing light, dark, and system-auto modes with OS preference detection, manual toggle, persisted preference, and proper dark variants for all UI components, and a dual editor/preview toggle that lets users switch between the tiptap-based rich editing view with interactive ref chips and slash commands and a read-only rendered markdown preview showing compiled content with resolved refs and clean typography.

## Glossary

- **App**: The AgentFlow v2 single-page React/TypeScript application served at the root URL.
- **Explorer_Panel**: The left sidebar that displays workspace contents grouped by semantic category.
- **Graph_Canvas**: The central @xyflow/react canvas that renders workflow nodes and edges.
- **Detail_Panel**: The right sidebar containing the frontmatter form, reference list, and markdown editor.
- **Editor**: The tiptap-based markdown editor embedded in the Detail_Panel for editing file content.
- **Ref_Token**: An inline `{{...}}` reference token in markdown content that links to another resource or node.
- **Ref_Chip**: An interactive pill/badge UI element that visually represents a Ref_Token in the Editor.
- **Mention_Ref**: A Ref_Token of the form `{{category/name}}` that references a resource.
- **Edge_Ref**: A Ref_Token of the form `{{-> category/name}}` that declares a workflow edge.
- **Conditional_Edge_Ref**: A Ref_Token of the form `{{-> category/name | templates/condition}}` that declares a conditional workflow edge.
- **Data_Flow_Ref**: A Ref_Token of the form `{{<< output.nodeName}}` that references output data from another node.
- **Library_Panel**: A UI panel for browsing, searching, and dragging reusable library items into the workspace.
- **Library_Registry**: The JSON registry (`library/registry.json`) that indexes all available library entries.
- **Resource_Type**: One of: tool, skill, template, interaction, memory, node, workflow.
- **Node_Def**: A workflow node definition containing a primary file, context files, refs, and frontmatter.
- **Workflow_Def**: A workflow definition containing nodes, edges, and entry points.
- **Selection**: The currently selected item in the App, which can be a resource, node, or workflow.
- **Autocomplete_Popup**: A dropdown UI element triggered by typing `{{` in the Editor that suggests available refs.
- **Slash_Command_Palette**: A dropdown command menu triggered by typing `/` in the Editor, providing categorized commands for inserting refs, blocks, and other content elements.
- **Edit_Mode**: The editor state where the user can author and modify content using tiptap with interactive Ref_Chips and slash commands.
- **Preview_Mode**: The editor state where the content is rendered as resolved markdown with all Ref_Tokens replaced by their resolved values.
- **Export_Bundle**: The structured output produced by the export command, containing resolved workflow content in human-readable formats.
- **Export_Directory**: The directory structure produced by the structured export, containing YAML, Markdown, and metadata files organized by semantic category.
- **Resource_Palette**: A panel displaying all workspace resources as draggable items that can be attached to workflow nodes via drag-and-drop.
- **IO_Contract**: An optional input/output declaration on a resource or node, specified via frontmatter fields `inputs` and `outputs`, used for compatibility checking during drag-and-drop operations.
- **Compatibility_Check**: The advisory or strict validation performed when attaching a resource to a node or connecting two nodes, comparing IO_Contracts for mismatches.
- **Strict_Mode**: A per-workflow or per-node setting that promotes compatibility warnings to blocking errors, preventing incompatible attachments.
- **Narrative_Template**: Optional prefix and suffix text declared in a resource's frontmatter that suggests how the resource should be narrated when inserted into a skill file via drag-and-drop.
- **Narrative_Block**: A visual segment in the Editor that groups a Ref_Token with its surrounding natural language context, helping users see the story structure of their content.
- **Theme_Mode**: The active visual theme of the App, one of: light, dark, or system (auto-detect from OS preference).

## Requirements

### Requirement 1: Visual Design System

**User Story:** As a developer, I want the AgentFlow UI to have a clean, minimal, Notion-like aesthetic, so that the interface feels modern and reduces visual clutter.

#### Acceptance Criteria

1. THE App SHALL use the Inter font family as the primary typeface, falling back to the system sans-serif font stack.
2. THE App SHALL apply a muted color palette using zinc, slate, and neutral tones for backgrounds, borders, and text in both light and dark modes.
3. THE App SHALL use subtle 1px borders with low-opacity colors (e.g., `border-zinc-200/60`) instead of heavy borders for panel separators.
4. THE App SHALL apply a minimum of 12px padding on all panel content areas and 8px padding on list items to ensure generous whitespace.
5. THE App SHALL use a consistent border-radius of 8px for cards, panels, and interactive elements.
6. THE App SHALL limit the use of gradients to accent indicators only (e.g., node type badges) and use flat solid colors for all other surfaces.
7. THE App SHALL use font sizes in the range of 12px to 14px for body text and 10px to 11px for labels and metadata.

### Requirement 2: Semantic Explorer Panel

**User Story:** As a developer, I want the explorer panel to show a compiled semantic view of my workspace grouped by resource type, so that I can quickly find and navigate to any resource without parsing raw file paths.

#### Acceptance Criteria

1. THE Explorer_Panel SHALL display workspace contents grouped into collapsible sections: Workflows, Nodes, Tools, Skills, Templates, Interactions, and Memory.
2. WHEN the App loads workspace data, THE Explorer_Panel SHALL derive the semantic grouping from the WorkflowGraph data structure rather than the raw filesystem tree.
3. THE Explorer_Panel SHALL display each item with its human-readable name (from frontmatter or parsed title) rather than its file path.
4. THE Explorer_Panel SHALL display a distinct icon and accent color for each Resource_Type section, consistent with the CATEGORY_CONFIG mapping.
5. WHEN a section contains zero items, THE Explorer_Panel SHALL hide that section from the display.
6. THE Explorer_Panel SHALL display a count badge next to each section header showing the number of items in that section.
7. THE Explorer_Panel SHALL NOT display raw frontmatter fields (such as "toolType") as visible metadata on explorer items.

### Requirement 3: Interactive Ref Token Rendering

**User Story:** As a developer, I want `{{ref}}` tokens in the markdown editor to render as interactive chips instead of raw text, so that I can visually identify and interact with references inline.

#### Acceptance Criteria

1. WHEN the Editor renders markdown content containing a Ref_Token, THE Editor SHALL display the Ref_Token as a Ref_Chip inline element instead of raw text.
2. THE Ref_Chip SHALL display the resource icon and name extracted from the Ref_Token, styled with the accent color matching the resource's category.
3. WHEN a Ref_Chip represents an Edge_Ref, THE Ref_Chip SHALL display a directional arrow indicator (→) before the target name.
4. WHEN a Ref_Chip represents a Conditional_Edge_Ref, THE Ref_Chip SHALL display both the target name and the condition name separated by a pipe indicator.
5. WHEN a Ref_Chip represents a Data_Flow_Ref, THE Ref_Chip SHALL display a data flow indicator (⇠) before the output source name.
6. WHEN the user clicks a Ref_Chip, THE Editor SHALL select the referenced resource or node in the App Selection state.
7. THE Editor SHALL support all four Ref_Token types: Mention_Ref, Edge_Ref, Conditional_Edge_Ref, and Data_Flow_Ref.

### Requirement 4: Slash Command Ref Insertion

**User Story:** As a developer, I want to type `/` in the editor to trigger a command palette for inserting refs and blocks, so that I can quickly compose workflow content using a familiar Notion-like interaction pattern.

#### Acceptance Criteria

1. WHEN the user types `/` at the start of a line or after a space in the Editor, THE App SHALL display a Slash_Command_Palette with categorized commands.
2. THE Slash_Command_Palette SHALL include a "Reference" category listing all resource types: tools, skills, templates, interactions, memory, and nodes.
3. THE Slash_Command_Palette SHALL include an "Edge" category for inserting Edge_Ref and Conditional_Edge_Ref tokens.
4. THE Slash_Command_Palette SHALL include a "Data Flow" category for inserting Data_Flow_Ref tokens.
5. WHEN the user types additional characters after `/`, THE Slash_Command_Palette SHALL filter commands by name, category, and description using fuzzy matching.
6. WHEN the user selects a resource command from the Slash_Command_Palette, THE App SHALL display a secondary picker listing all available items of that resource type.
7. WHEN the user selects an item from the secondary picker, THE Editor SHALL insert the complete Ref_Token syntax (e.g., `{{tools/my-tool}}`) at the cursor position, rendered as a Ref_Chip.
8. THE Slash_Command_Palette SHALL support keyboard navigation using Arrow Up, Arrow Down, Enter to select, and Escape to dismiss.
9. THE Slash_Command_Palette SHALL display each command with its Resource_Type icon, name, and a brief description, using the same color coding as the Explorer_Panel.
10. WHEN the user types `{{` directly in the Editor, THE Editor SHALL still accept raw ref syntax and render it as a Ref_Chip, supporting power users who prefer typing refs directly.
11. THE Slash_Command_Palette SHALL be implemented using tiptap's suggestion API for consistent behavior with the editor's content model.


### Requirement 5: Bidirectional Graph-Explorer Sync

**User Story:** As a developer, I want clicking an item in the explorer to focus the corresponding node on the graph canvas, and selecting a node on the graph to highlight it in the explorer, so that I can navigate seamlessly between the two views.

#### Acceptance Criteria

1. WHEN the user clicks an item in the Explorer_Panel, THE Graph_Canvas SHALL pan and zoom to center the corresponding node in the viewport.
2. WHEN the user clicks an item in the Explorer_Panel, THE Graph_Canvas SHALL apply a highlight effect (e.g., ring, glow, or border change) to the corresponding node.
3. WHEN the user selects a node on the Graph_Canvas, THE Explorer_Panel SHALL scroll to and visually highlight the corresponding item in the explorer list.
4. WHEN the user selects a resource on the Graph_Canvas that appears as a resource node, THE Explorer_Panel SHALL highlight the matching item in the appropriate semantic section.
5. WHEN the user clicks an item in the Explorer_Panel that has no corresponding node on the Graph_Canvas (e.g., a standalone resource), THE Graph_Canvas SHALL maintain its current viewport without panning.
6. THE App SHALL use the shared Selection state in the store to synchronize selection between the Explorer_Panel and Graph_Canvas.

### Requirement 6: Drag-and-Drop Edge Creation

**User Story:** As a developer, I want to drag from one node to another on the graph canvas to create a connection, so that I can visually build workflow edges that are persisted as refs in the markdown content.

#### Acceptance Criteria

1. WHEN the user drags from a source node handle to a target node handle on the Graph_Canvas, THE App SHALL create a new Edge_Ref in the source node's primary markdown file.
2. WHEN a new Edge_Ref is created via drag-and-drop, THE App SHALL insert the ref syntax `{{-> targetCategory/targetName}}` into the source node's markdown content.
3. WHEN a new Edge_Ref is created via drag-and-drop, THE Graph_Canvas SHALL immediately render the new edge visually without requiring a page reload.
4. THE Graph_Canvas SHALL always derive its displayed edges from the actual Ref_Tokens present in the markdown content, ensuring visual connections reflect the source of truth.
5. IF the user attempts to create a duplicate edge (same source and target), THEN THE App SHALL prevent the duplicate and display a brief notification.
6. WHEN an Edge_Ref is deleted from the markdown content, THE Graph_Canvas SHALL remove the corresponding visual edge on the next data refresh.

### Requirement 7: Library Panel

**User Story:** As a developer, I want a library panel where I can browse, search, and drag reusable components into my workspace, so that I can quickly add pre-built tools, skills, templates, interactions, and workflows.

#### Acceptance Criteria

1. THE Library_Panel SHALL display all entries from the Library_Registry grouped by Resource_Type: workflows, tools, skills, templates, and interactions.
2. THE Library_Panel SHALL provide a search input that filters library entries by name, description, and tags using case-insensitive substring matching.
3. WHEN the user drags a library item from the Library_Panel and drops it onto the workspace area, THE App SHALL invoke the library add operation to copy the resource into the user's `.agentflow/` workspace.
4. WHEN a library item is successfully added to the workspace, THE App SHALL reload the workspace data to reflect the new resource.
5. THE Library_Panel SHALL display each entry with its name, Resource_Type icon, and a truncated description.
6. THE Library_Panel SHALL be accessible via a toggle button in the Toolbar or as a collapsible sidebar section.
7. WHEN the Library_Panel search input is empty, THE Library_Panel SHALL display all available library entries.
8. THE Library_Panel SHALL visually distinguish between different Resource_Types using the same icon and color scheme as the Explorer_Panel.

### Requirement 8: Built-in Type Visual Differentiation

**User Story:** As a developer, I want the explorer and graph to visually distinguish between different resource types with distinct icons, colors, and badges, so that I can quickly identify what kind of resource I am looking at.

#### Acceptance Criteria

1. THE Explorer_Panel SHALL display a unique icon for each Resource_Type: wrench for tools, brain for skills, zap/lightning for templates, message-square for interactions, database for memory, box for nodes, and git-branch for workflows.
2. THE Explorer_Panel SHALL apply a distinct accent color to each Resource_Type section header and item icon, consistent with the CATEGORY_CONFIG color mapping.
3. THE Graph_Canvas SHALL render workflow nodes with a type-specific color accent on the node border or header bar (blue for step nodes, amber for router nodes, purple for sub-workflow nodes).
4. THE Graph_Canvas SHALL render resource nodes (tools, skills, interactions, memory) with a colored left-border accent strip matching the resource's category color.
5. WHEN a resource node is rendered on the Graph_Canvas, THE Graph_Canvas SHALL display the Resource_Type icon inside the node alongside the resource name.
6. THE Ref_Chip SHALL use the category-specific icon and color when rendering inline in the Editor, matching the same visual language used in the Explorer_Panel and Graph_Canvas.
7. THE App SHALL maintain a single source of truth for Resource_Type icon and color mappings (CATEGORY_CONFIG) used consistently across the Explorer_Panel, Graph_Canvas, Ref_Chip, and Library_Panel.

### Requirement 9: Structured Workflow Export

**User Story:** As a developer, I want the export to produce a structured directory of human-readable files instead of a single flat JSON blob, so that I can inspect, version-control, and consume workflow definitions with standard tools.

#### Acceptance Criteria

1. WHEN the user invokes the CLI export command with the default format, THE App SHALL produce an Export_Directory at `export/{workflow-name}/` containing separate files for graph topology, node content, resource definitions, and metadata.
2. THE Export_Directory SHALL follow the structure: `graph.yaml` at the root, a `nodes/` subdirectory with one Markdown file per node (`{node-name}.md`), a `resources/` subdirectory with category subfolders each containing YAML files (`{category}/{name}.yaml`), and a `metadata.yaml` at the root.
3. WHEN a node Markdown file is exported, THE App SHALL contain the fully resolved content with all Ref_Tokens replaced by their resolved values.
4. THE `graph.yaml` file SHALL contain the workflow topology including the nodes list, edges with conditions, and entry points.
5. THE resource YAML files SHALL contain the full resource definition including frontmatter fields, description, and parameters for tools.
6. WHEN the user invokes the CLI export command with a `--format json` flag, THE App SHALL produce the existing flat JSON export for programmatic consumption.
7. WHEN the user clicks the export button in the UI, THE App SHALL offer two format options: download as a structured ZIP containing the Export_Directory, or view as JSON in a modal.
8. THE Export_Directory SHALL include a `README.md` file at the root that explains the workflow structure, file organization, and how to read the export.
9. WHEN the export encounters environment variable references (`${env:VAR}`), THE App SHALL preserve the environment variable syntax as-is in the exported files without resolving the variable values.

### Requirement 10: Resource Palette with Drag-and-Drop Attachment and Compatibility Checking

**User Story:** As a developer, I want a resource palette panel where I can drag workspace resources onto graph nodes to attach them, with optional IO contract compatibility checking, so that I can quickly wire up resources to nodes and catch mismatches before they cause runtime errors.

#### Acceptance Criteria

1. THE Resource_Palette SHALL display all workspace resources (tools, skills, templates, interactions, and memory items) as draggable items grouped by Resource_Type.
2. WHEN the user drags a resource from the Resource_Palette and drops it onto a node on the Graph_Canvas, THE App SHALL insert a Mention_Ref (`{{category/name}}`) into the target node's primary markdown file.
3. WHEN the user drags a resource from the Library_Panel and drops it onto a node on the Graph_Canvas, THE App SHALL insert a Mention_Ref into the target node's primary markdown file using the same attachment behavior as the Resource_Palette.
4. WHEN the user moves a resource attachment from one node to another node via drag-and-drop, THE App SHALL remove the Mention_Ref from the source node's markdown and insert the Mention_Ref into the target node's markdown.
5. WHERE a resource declares an IO_Contract in its frontmatter, THE App SHALL parse the `inputs` and `outputs` fields into a structured contract representation.
6. WHEN a resource with an IO_Contract is dropped onto a node, THE App SHALL perform a Compatibility_Check comparing the resource's declared inputs against the outputs available from the target node and its upstream connections.
7. WHEN two nodes are connected via edge drag, THE App SHALL perform a Compatibility_Check comparing the source node's declared outputs against the target node's declared inputs.
8. WHEN a Compatibility_Check detects a mismatch in advisory mode, THE App SHALL allow the operation to complete and display a warning badge on the resulting connection or attachment.
9. WHEN the user hovers over a warning badge produced by a Compatibility_Check, THE App SHALL display a tooltip describing the specific mismatch (e.g., "Node X outputs [result] but Tool Y expects [raw_data]").
10. WHILE Strict_Mode is enabled for a workflow or node, WHEN a Compatibility_Check detects a mismatch, THE App SHALL reject the drop or connection operation and display an explanation of the incompatibility.
11. THE App SHALL default to advisory mode for all Compatibility_Checks unless the user explicitly enables Strict_Mode on a per-workflow or per-node basis.
12. WHEN a resource does not declare an IO_Contract, THE App SHALL skip the Compatibility_Check and allow the attachment without warnings.
13. THE Resource_Palette SHALL display each resource item with its Resource_Type icon, name, and accent color consistent with the CATEGORY_CONFIG mapping used in the Explorer_Panel.

### Requirement 11: Narrative Ref Composition

**User Story:** As a developer, I want resources to have optional narrative hints and the editor to scaffold natural language context around refs when I drag-and-drop them, so that skill files read as coherent instructional stories rather than bare lists of references.

#### Acceptance Criteria

1. WHEN the user drags a resource from the Resource_Palette onto a node's Editor, THE Editor SHALL insert the Ref_Token with a default narrative prefix and suffix based on the resource's Resource_Type (e.g., "Use {{tools/my-tool}}" for tools, "Then proceed to {{-> nodes/target}}" for edge targets).
2. WHERE a resource declares a Narrative_Template in its frontmatter with `prefix` and `suffix` fields, THE Editor SHALL use the declared prefix and suffix text when inserting the Ref_Token via drag-and-drop instead of the Resource_Type default.
3. WHERE a resource does not declare a Narrative_Template, THE Editor SHALL fall back to a sensible default narrative prefix and suffix determined by the resource's Resource_Type.
4. THE Editor SHALL allow the user to freely edit, replace, or remove the narrative text surrounding any inserted Ref_Token without restriction or validation.
5. THE Editor SHALL visually chunk the node's markdown content into Narrative_Blocks, where each block groups one or more Ref_Tokens with their surrounding natural language context as a distinct visual segment.
6. WHEN the Editor displays Narrative_Blocks, THE Editor SHALL render each block with subtle visual separation (e.g., light background, spacing, or border) so the user can see the story structure of the content.
7. THE App SHALL support Narrative_Template frontmatter fields on all resource types: tools, skills, templates, interactions, and memory items.
8. WHEN a resource with a Narrative_Template is inserted via the Autocomplete_Popup, THE Editor SHALL insert only the bare Ref_Token syntax without narrative scaffolding, reserving narrative insertion for drag-and-drop operations.
9. THE Editor SHALL treat all narrative text as regular markdown content, applying no structural validation or enforcement to the text surrounding Ref_Tokens.
10. WHEN the user drags multiple resources onto the Editor in sequence, THE Editor SHALL insert each with its own narrative scaffolding, producing a flowing multi-ref narrative that the user can then edit into a cohesive story.

### Requirement 12: Theme Support (Light/Dark)

**User Story:** As a developer, I want the App to support light, dark, and system-auto themes with proper dark mode variants for all UI components, so that I can work comfortably in any lighting condition and have my preference remembered across sessions.

#### Acceptance Criteria

1. WHEN the App loads and no persisted Theme_Mode preference exists, THE App SHALL detect the user's OS color scheme preference via the `prefers-color-scheme` media query and apply the matching theme.
2. THE App SHALL provide a toggle control in the Toolbar that allows the user to switch between light, dark, and system Theme_Mode options.
3. WHEN the user selects a Theme_Mode via the Toolbar toggle, THE App SHALL persist the selected Theme_Mode value in localStorage.
4. WHEN the App loads and a persisted Theme_Mode preference exists in localStorage, THE App SHALL apply the persisted theme instead of detecting the OS preference.
5. WHILE the Theme_Mode is set to system, WHEN the OS color scheme preference changes, THE App SHALL update the active theme to match the new OS preference without requiring a page reload.
6. THE App SHALL apply the theme class to the root HTML element before the first paint to prevent a flash of the incorrect theme on page load.
7. WHILE the dark theme is active, THE App SHALL use near-black background colors (`#191919` / zinc-900) for primary surfaces and slightly lighter surface colors for cards, panels, and elevated elements.
8. WHILE the dark theme is active, THE App SHALL use muted text colors and subtle low-contrast borders across all UI surfaces.
9. WHILE the dark theme is active, THE Explorer_Panel, Graph_Canvas, Editor, Detail_Panel, Toolbar, Library_Panel, Resource_Palette, Autocomplete_Popup, Ref_Chip, and Narrative_Block components SHALL each render using dark-mode-specific color variants.
10. WHILE the dark theme is active, THE Graph_Canvas SHALL display a light-colored grid pattern on the dark background, and WHILE the light theme is active, THE Graph_Canvas SHALL display a dark-colored grid pattern on the light background.
11. WHILE the dark theme is active, THE Ref_Chip SHALL adjust its accent colors and background to maintain readable contrast ratios against dark surfaces.
12. WHILE the dark theme is active, THE App SHALL ensure all badges, status indicators, and category accent colors maintain a minimum contrast ratio of 4.5:1 against their background surfaces.

### Requirement 13: Editor/Preview Toggle

**User Story:** As a developer, I want to toggle between an edit view and a compiled preview view in the detail panel, so that I can both author content with interactive ref chips and see the fully resolved output.

#### Acceptance Criteria

1. THE Detail_Panel SHALL provide a toggle control to switch between Edit mode and Preview mode.
2. WHILE Edit mode is active, THE Detail_Panel SHALL display the tiptap Editor with interactive Ref_Chips, Narrative_Blocks, and slash command support.
3. WHILE Preview mode is active, THE Detail_Panel SHALL render the markdown content using react-markdown with all Ref_Tokens resolved to their target content (mention refs inlined, edge refs shown as links, data flow refs shown as placeholders).
4. WHEN the user switches from Edit mode to Preview mode, THE Detail_Panel SHALL render the current editor content as resolved markdown without requiring a save operation.
5. WHEN the user switches from Preview mode to Edit mode, THE Detail_Panel SHALL restore the editor state with the cursor at the previous position.
6. THE Preview mode SHALL render markdown with syntax highlighting for code blocks, proper heading hierarchy, and GFM (GitHub Flavored Markdown) support via remark-gfm.
7. THE Preview mode SHALL render Ref_Tokens as styled inline elements (not raw `{{}}` syntax) with the same color coding used in Edit mode Ref_Chips.
8. THE toggle control SHALL display the current mode and be accessible via a keyboard shortcut (Cmd/Ctrl+Shift+P for preview toggle).
