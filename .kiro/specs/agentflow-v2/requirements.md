# Requirements Document

## Introduction

AgentFlow v2 is a platform-agnostic, directory-based framework for defining AI agent workflows using markdown and YAML frontmatter. It rebuilds the existing POC with a formalized reference system where ref syntax itself encodes semantic intent (mentions, edges, data flow, conditional routing), optional frontmatter schemas with type-based resource identification, a self-contained export format with resolved references, MCP-compatible tool definitions, and an enrichable library of reusable prompts, tools, and skills. The framework targets the Definition layer of the emerging agent ecosystem, producing output consumable by any AI system. The design prioritizes contributor-friendliness, intuitive authoring, and a low barrier to entry — any `.md` file dropped into the workspace works immediately, frontmatter adds structure when you want it, and reserved directories are organizational conventions rather than hard requirements. Identity is determined by directory path and frontmatter `type` field, never by filename. The system is permissive by default and strict only when the user opts into validation.

## Glossary

- **Parser**: The core module that reads `.agentflow/` directory trees, extracts frontmatter, content, and references, and produces a structured in-memory representation (the Workflow_Graph).
- **Workflow_Graph**: The directed graph data structure produced by the Parser, containing nodes, edges, resources, and their relationships.
- **Ref**: A token embedded in markdown content that references another resource. Refs use syntax prefixes to encode semantic intent. The four forms are: `{{category/name}}` (mention), `{{-> category/name}}` (edge), `{{-> category/name | templates/condition}}` (conditional edge), and `{{<< output.nodeName}}` (data flow).
- **Edge_Ref**: A Ref using the `{{-> category/name}}` syntax that creates a structural connection (routing) between two nodes in the Workflow_Graph. Can appear anywhere in the document.
- **Conditional_Edge_Ref**: A Ref using the `{{-> category/name | templates/condition}}` syntax that creates a conditional edge, where the referenced template's `check` field determines whether the edge is traversed. Can appear anywhere in the document.
- **Mention_Ref**: A Ref using the plain `{{category/name}}` syntax (no prefix) that indicates informational usage of a resource without creating a structural connection. Can appear anywhere in the document.
- **Data_Flow_Ref**: A Ref using the `{{<< output.nodeName}}` syntax that declares a data dependency between nodes. Can appear anywhere in the document.
- **Node**: A directory containing one or more markdown files that represents a step in a workflow. Each Node has a type: `step`, `router`, or `sub-workflow`.
- **Resource**: A markdown file that defines a reusable component. A Resource's type is determined primarily by its frontmatter `type` field, with directory location as a fallback.
- **Resource_Type**: The classification of a Resource (e.g., `tool`, `skill`, `template`, `interaction`, `memory`, `node`). Determined by frontmatter `type` field first, then inferred from directory path if frontmatter is absent.
- **Reserved_Directory**: One of the conventional directories (`tools/`, `skills/`, `interactions/`, `templates/`, `memory/`) used as a fallback for inferring Resource_Type when frontmatter is absent. These are organizational conventions, not hard requirements.
- **Primary_File**: The main markdown file in a Node directory that serves as the primary instructions for that Node. Identified by frontmatter containing `primary: true`, or by convention (e.g., `main.md`), or as the sole `.md` file in the directory. Filenames are not restricted — any `.md` filename is valid.
- **Context_File**: Any additional `.md` file in a Node directory that is not the Primary_File. Context_Files are loaded alongside the Primary_File to provide supplementary instructions, documentation, or reference material for the Node.
- **Frontmatter**: The optional YAML block delimited by `---` at the top of a markdown file that contains structured metadata.
- **Frontmatter_Schema**: A set of required and optional fields, with types and constraints, defined per Resource_Type. Only validated when frontmatter is present and contains a `type` field.
- **Export_Bundle**: The self-contained output produced by the Exporter, where all Refs are resolved to inline content or absolute paths.
- **Exporter**: The module that takes a Workflow_Graph and produces an Export_Bundle with all Refs resolved.
- **Validator**: The module that checks a parsed Workflow_Graph for structural errors, broken refs, schema violations, and semantic inconsistencies.
- **Library**: The collection of reusable workflows, skills, tools, templates, and interactions stored in the `library/` directory.
- **Library_Registry**: An index file (`library/registry.json`) that catalogs all Library entries with metadata for discovery and installation.
- **MCP**: Model Context Protocol — the industry-standard JSON-RPC protocol for tool integration. Tools in AgentFlow can declare MCP server configurations.
- **Pretty_Printer**: The module that serializes a Workflow_Graph back into the `.agentflow/` directory format (markdown files with frontmatter).
- **CLI**: The command-line interface that exposes Parser, Validator, Exporter, Pretty_Printer, and Library operations.
- **Entry_Node**: A Node that serves as a starting point for workflow execution. Determined by explicit `entry: true` in frontmatter, listing in the workflow's AGENTS.md, or inference from having no incoming edges.
- **Directory_Explorer**: A VS Code-style file tree UI component that mirrors the actual `.agentflow/` directory structure, allowing users to browse and navigate the real filesystem.

## Requirements

### Requirement 1: Syntax-Based Semantic Reference Parsing

**User Story:** As a workflow author, I want the ref syntax itself to encode semantic intent, so that I have full freedom to place refs anywhere in my document and the meaning is always self-evident from the syntax alone.

#### Acceptance Criteria

1. WHEN the Parser encounters a `{{category/name}}` token (no prefix), THE Parser SHALL classify the Ref as a Mention_Ref with semantic type `mention`, regardless of where the token appears in the document.
2. WHEN the Parser encounters a `{{-> category/name}}` token, THE Parser SHALL classify the Ref as an Edge_Ref with semantic type `edge`, regardless of where the token appears in the document.
3. WHEN the Parser encounters a `{{-> category/name | templates/condition}}` token, THE Parser SHALL classify the Ref as a Conditional_Edge_Ref with semantic type `edge`, associate the `templates/condition` portion as the gate condition, and treat the entire token as a single Ref.
4. WHEN the Parser encounters a `{{<< output.nodeName}}` token, THE Parser SHALL classify the Ref as a Data_Flow_Ref with semantic type `data_flow`, regardless of where the token appears in the document.
5. THE Parser SHALL determine semantic type exclusively from the Ref syntax prefix (`->`, `<<`, or no prefix) and SHALL NOT use document position, section headings, or surrounding context to infer semantic type.
6. THE Parser SHALL include the semantic type (`edge`, `mention`, `data_flow`) and, for Conditional_Edge_Refs, the associated condition template on every parsed Ref object.
7. THE Workflow_Graph SHALL construct edges only from Edge_Refs and Conditional_Edge_Refs, each edge containing a `from` node, a `to` node, and an optional `condition` from the Conditional_Edge_Ref's template reference.

### Requirement 2: Frontmatter-Based Resource Identification

**User Story:** As a workflow author, I want frontmatter to be optional and the `type` field in frontmatter to be the primary way to identify what a resource is, so that I can organize files however I want and still have them correctly classified.

#### Acceptance Criteria

1. WHEN a markdown file contains a frontmatter block with a `type` field, THE Parser SHALL use the frontmatter `type` value as the Resource_Type, regardless of which directory the file resides in.
2. WHEN a markdown file contains no frontmatter or contains frontmatter without a `type` field, THE Parser SHALL infer the Resource_Type from the file's directory path using the Reserved_Directory conventions (`tools/` → tool, `skills/` → skill, `templates/` → template, `interactions/` → interaction, `memory/` → memory).
3. WHEN a markdown file's frontmatter `type` field conflicts with the Reserved_Directory the file resides in, THE Parser SHALL use the frontmatter `type` value and SHALL NOT treat the directory location as authoritative.
4. WHEN a markdown file resides outside any Reserved_Directory and contains no frontmatter `type` field, THE Parser SHALL treat the file as untyped context (plain markdown with no Resource_Type metadata).
5. THE Parser SHALL accept markdown files with no frontmatter block at all, parsing the entire file content as the markdown body with an empty metadata object.
6. WHEN frontmatter is present and contains a `type` field, THE Frontmatter_Schema for that Resource_Type SHALL be used for validation. WHEN frontmatter is absent or contains no `type` field, THE Validator SHALL skip schema validation for that file.
7. THE Frontmatter_Schema for tool resources SHALL require `name` (string) and accept optional fields: `type` (enum: `builtin`, `script`, `mcp`, `package`), `command` (string, required when type is `script`), `mcp` (string, required when type is `mcp`), `package` (string, required when type is `package`), `parameters` (object), `description` (string), and `builtin_mapping` (string).
8. THE Frontmatter_Schema for skill resources SHALL accept optional fields: `name` (string), `description` (string), `domain` (string), `max_tokens` (integer), and `tags` (array of strings).
9. THE Frontmatter_Schema for template resources SHALL require `name` (string) and `check` (string) fields when frontmatter is present, and SHALL accept an optional `type` field (string, default `condition`).
10. THE Frontmatter_Schema for interaction resources SHALL require `name` (string) and `type` (enum: `approval`, `freeform`, `choice`, `confirm`) fields when frontmatter is present, and SHALL accept an optional `timeout` (integer) field.
11. THE Frontmatter_Schema for memory resources SHALL accept optional fields: `name` (string), `description` (string), and `editable` (boolean, default `true`).
12. THE Frontmatter_Schema for node resources SHALL accept optional fields: `name` (string), `description` (string), `type` (enum: `step`, `router`, `sub-workflow`, default `step`), `agent` (string), `model` (string), `entry` (boolean, default `false`), and `primary` (boolean, default `false`).
13. WHEN the Validator encounters a markdown file with frontmatter that violates the applicable Frontmatter_Schema, THE Validator SHALL return an error message specifying the file path, the field name, and the nature of the violation (missing required field, wrong type, or invalid enum value).
14. WHEN the Validator encounters a tool resource where frontmatter `type` is `script` and `command` is absent, THE Validator SHALL return an error indicating that `command` is required for script-type tools.
15. WHEN the Validator encounters a tool resource where frontmatter `type` is `mcp` and `mcp` is absent, THE Validator SHALL return an error indicating that `mcp` is required for mcp-type tools.

### Requirement 3: Custom Files and Flexible Identity

**User Story:** As a workflow author, I want file identity to come from directory path and frontmatter rather than filename, and I want to drop any markdown file into a node directory to extend its context, so that I am never constrained by naming conventions or rigid directory structures.

#### Acceptance Criteria

1. THE Parser SHALL read all `.md` files in every directory within the `.agentflow/` workspace, including files in Node directories, Reserved_Directories, and any custom directories.
2. THE Parser SHALL NOT require any specific filename (such as `SKILL.md`, `AGENTS.md`, or `INSTRUCTIONS.md`) for a file to be recognized. Any `.md` filename is valid.
3. WHEN a Node directory contains a single `.md` file, THE Parser SHALL treat that file as the Primary_File for the Node.
4. WHEN a Node directory contains multiple `.md` files, THE Parser SHALL identify the Primary_File by checking for a frontmatter field `primary: true`. WHEN no file has `primary: true`, THE Parser SHALL use the file named `main.md` as a convention fallback. WHEN neither condition is met, THE Parser SHALL use the first `.md` file in alphabetical order.
5. WHEN a Node directory contains multiple `.md` files, THE Parser SHALL treat all non-Primary `.md` files as Context_Files and SHALL include their content in the Node's parsed representation alongside the Primary_File content.
6. WHEN a Context_File in a Node directory contains frontmatter with a `type` field, THE Parser SHALL classify that file according to its frontmatter `type` (e.g., a file with `type: tool` in a Node directory is parsed as a tool Resource) and SHALL still include the file in the Node's context.
7. WHEN a Context_File in a Node directory contains no frontmatter or no `type` field, THE Parser SHALL treat the file as plain additional context for the Node with no Resource_Type classification.
8. THE Parser SHALL accept markdown files located in any arbitrary directory within the `.agentflow/` workspace, including directories that are not Reserved_Directories and not Node directories.
9. THE Reserved_Directories (`tools/`, `skills/`, `interactions/`, `templates/`, `memory/`) SHALL serve as organizational conventions for type inference only, and THE Parser SHALL NOT require that resources of a given type reside in the corresponding Reserved_Directory.
10. WHEN the Exporter processes a Node, THE Exporter SHALL include the content of all Context_Files for that Node in the Export_Bundle alongside the Primary_File content.
11. WHEN a file resides in a Reserved_Directory (e.g., `tools/`) and has no frontmatter `type` field, THE Parser SHALL infer the Resource_Type from the directory name. WHEN the file has a frontmatter `type` field, THE Parser SHALL use the frontmatter value regardless of directory.

### Requirement 4: Reference Resolution with Path and Name Matching

**User Story:** As a workflow author, I want refs to resolve by path first and by frontmatter name second, so that I can reference resources flexibly regardless of where they live in the directory structure.

#### Acceptance Criteria

1. WHEN the Parser resolves a Ref token `{{category/name}}`, THE Parser SHALL first attempt to match the Ref to a file at the exact path `category/name.md` relative to the `.agentflow/` root.
2. WHEN a Ref token does not match any file by exact path, THE Parser SHALL search all parsed files for a resource whose frontmatter `name` field matches the `name` portion of the Ref token.
3. WHEN a Ref token matches both an exact path file and a frontmatter `name` on a different file, THE Parser SHALL use the exact path match and SHALL NOT fall through to the name-based match.
4. WHEN a Ref token matches multiple files by frontmatter `name` (and no exact path match exists), THE Validator SHALL return an error indicating an ambiguous reference and SHALL list all matching files.
5. THE Parser SHALL apply the same path-first, name-second resolution order to all Ref types: Mention_Refs, Edge_Refs, Conditional_Edge_Refs, and the template portion of Conditional_Edge_Refs.

### Requirement 5: Export with Resolved References

**User Story:** As a workflow consumer, I want to export a workflow as a self-contained bundle where all refs are resolved, so that the output can be consumed by any AI system without access to the original directory.

#### Acceptance Criteria

1. WHEN the Exporter processes an Edge_Ref (`{{-> nodes/name}}`), THE Exporter SHALL replace the token with the resolved node identifier and SHALL include the full edge definition in the Export_Bundle's graph section.
2. WHEN the Exporter processes a Conditional_Edge_Ref (`{{-> nodes/name | templates/condition}}`), THE Exporter SHALL replace the token with the resolved node identifier, SHALL resolve the `templates/condition` reference to the template's `check` field value, and SHALL include the edge with its condition in the Export_Bundle's graph section.
3. WHEN the Exporter processes a Mention_Ref (`{{category/name}}`), THE Exporter SHALL replace the token with the inline content of the referenced resource's markdown body.
4. WHEN the Exporter processes a Data_Flow_Ref (`{{<< output.nodeName}}`), THE Exporter SHALL replace the token with a structured placeholder indicating the data dependency (e.g., `[output from: nodeName]`).
5. IF the Exporter encounters a Ref that cannot be resolved (target resource does not exist), THEN THE Exporter SHALL include an `[UNRESOLVED: {{original_ref}}]` marker in the output and SHALL add the unresolved Ref to an errors list in the Export_Bundle.
6. THE Export_Bundle SHALL contain: a `graph` object with all nodes and edges (including conditions from Conditional_Edge_Refs), a `resources` object with all resolved tool/skill/interaction/template/memory content, a `metadata` object with workflow name and export timestamp, and an `errors` array listing any unresolved refs.
7. THE CLI SHALL expose an `export` command that accepts a directory path and an optional `--output` flag, and SHALL write the Export_Bundle as a JSON file.
8. WHEN the Exporter resolves Refs, THE Exporter SHALL use the same path-first, name-second resolution order defined in Requirement 4.

### Requirement 6: Node Type System

**User Story:** As a workflow author, I want to distinguish between step nodes, router nodes, and sub-workflow nodes, so that the graph structure accurately represents different execution patterns.

#### Acceptance Criteria

1. WHEN a Node's frontmatter contains `type: step`, THE Parser SHALL treat the Node as a sequential execution step with zero or more outgoing edges.
2. WHEN a Node's frontmatter contains `type: router`, THE Parser SHALL treat the Node as a decision point where every outgoing Edge_Ref MUST use the Conditional_Edge_Ref syntax (`{{-> nodes/name | templates/condition}}`).
3. WHEN a Node's frontmatter contains `type: sub-workflow` and the Node directory contains a workflow descriptor file (any `.md` file with `type: agents` in frontmatter, or conventionally named `AGENTS.md`) and subdirectories with their own Node files, THE Parser SHALL recursively parse the sub-workflow and represent the sub-workflow as a nested Workflow_Graph within the parent Node.
4. WHEN a Node's frontmatter does not contain a `type` field or the Node has no frontmatter, THE Parser SHALL default the Node type to `step`.
5. WHEN the Validator encounters a `router` Node where any outgoing edge was created from a plain Edge_Ref (`{{-> nodes/name}}`) instead of a Conditional_Edge_Ref, THE Validator SHALL return an error indicating that all edges from a router Node require conditions using the `{{-> nodes/name | templates/condition}}` syntax.

### Requirement 7: Tool Definition and Builtin Mapping

**User Story:** As a workflow author, I want to define custom tools that can map to pre-existing builtin tools on the consuming platform, so that my workflows are portable across AI systems.

#### Acceptance Criteria

1. WHEN a tool Resource's frontmatter contains `type: builtin`, THE Parser SHALL parse the tool as a platform-native capability that the consuming agent is expected to provide.
2. WHEN a tool Resource's frontmatter contains `type: script` and a `command` field, THE Parser SHALL parse the tool as a shell command invocation with the specified command string.
3. WHEN a tool Resource's frontmatter contains `type: mcp` and an `mcp` field, THE Parser SHALL parse the tool as an MCP-compatible tool, storing the MCP server identifier for the consuming agent to resolve.
4. WHEN a tool Resource's frontmatter contains a `builtin_mapping` field, THE Parser SHALL store the mapping value as a hint for consuming agents to match the custom tool to a platform-specific builtin tool.
5. WHEN a tool Resource's frontmatter contains a `parameters` object, THE Parser SHALL parse each parameter with its name, type, description, and required status, and SHALL include the parameter definitions in the Workflow_Graph's tool entry.
6. THE Export_Bundle SHALL include the full tool definition (type, command/mcp/package, parameters, builtin_mapping) for each tool referenced in the workflow.
7. WHEN a tool Resource has no frontmatter, THE Parser SHALL parse the file as a tool with only its markdown body content and no structured metadata.

### Requirement 8: Workflow Validation

**User Story:** As a workflow author, I want comprehensive validation at authoring time, so that I catch broken refs, schema violations, and structural issues before running the workflow.

#### Acceptance Criteria

1. WHEN the Validator encounters a Ref whose target resource does not exist in the parsed Workflow_Graph (after both path-based and name-based resolution), THE Validator SHALL return an error specifying the source file, the Ref string, and the missing target.
2. WHEN the Validator encounters a Ref with an unrecognized syntax prefix (not `->`, `<<`, or empty), THE Validator SHALL return an error indicating the invalid Ref syntax.
3. WHEN the Validator encounters a Data_Flow_Ref `{{<< output.nodeName}}` where `nodeName` does not correspond to a Node in the same workflow, THE Validator SHALL return an error indicating the invalid output reference.
4. WHEN the Validator encounters a Conditional_Edge_Ref `{{-> nodes/name | templates/condition}}` where the `templates/condition` target does not exist, THE Validator SHALL return an error specifying the source file and the missing template.
5. WHEN the Validator encounters a circular dependency in the Edge_Refs of a workflow (a cycle in the directed graph), THE Validator SHALL return a warning listing the nodes involved in the cycle.
6. WHEN the Validator encounters a Node with no incoming edges and the Node is not declared as an Entry_Node (via `entry: true` in frontmatter, listing in the workflow's agents descriptor, or inference as a no-incoming-edges node), THE Validator SHALL return a warning indicating the Node may be unreachable.
7. THE CLI `validate` command SHALL return exit code 0 when no errors are found (warnings are acceptable) and exit code 1 when one or more errors are found.
8. WHEN the Validator encounters a Ref with a category prefix that does not match any known Reserved_Directory or parsed directory, THE Validator SHALL return a warning (not an error) indicating the category may be unresolvable.
9. THE Validator SHALL operate in a permissive mode by default, treating schema violations and structural issues as warnings rather than errors. WHEN the CLI `validate` command receives a `--strict` flag, THE Validator SHALL treat warnings as errors.

### Requirement 9: Library Registry and Installation

**User Story:** As a workflow author, I want to discover and install reusable components from the library, so that I can build workflows from proven building blocks without copying files manually.

#### Acceptance Criteria

1. THE Library_Registry SHALL be a JSON file at `library/registry.json` containing an array of entries, each with `name` (string), `type` (enum: `workflow`, `skill`, `tool`, `template`, `interaction`), `path` (string relative to library root), `description` (string), and `tags` (array of strings).
2. WHEN the CLI receives an `add` command with a type and name (e.g., `agentflow add skill systematic-debugging`), THE CLI SHALL copy the referenced resource from the Library to the corresponding directory in the user's `.agentflow/` workspace.
3. WHEN the CLI receives an `add` command for a `workflow` type, THE CLI SHALL copy the entire workflow directory including all Node subdirectories and the workflow descriptor file.
4. WHEN the CLI receives an `add` command for a resource that does not exist in the Library_Registry, THE CLI SHALL print an error message stating the resource was not found and SHALL list available resources of the same type.
5. WHEN the CLI receives a `search` command with a query string, THE CLI SHALL search the Library_Registry by name, description, and tags, and SHALL print matching entries with their type, name, and description.
6. WHEN a user adds a new resource file to the `library/` directory, THE CLI SHALL provide a `library index` command that regenerates `library/registry.json` by scanning all files in the Library directory tree.

### Requirement 10: Markdown Parsing and Pretty Printing (Round-Trip)

**User Story:** As a workflow author, I want to parse workflow files into a structured representation and print them back to valid markdown, so that programmatic modifications preserve the original file format.

#### Acceptance Criteria

1. WHEN the Parser reads a markdown file with YAML frontmatter, THE Parser SHALL produce a structured object containing the frontmatter fields, the markdown body content, the extracted title, and all parsed Refs with their semantic types (determined by syntax prefix) and positions.
2. WHEN the Parser reads a markdown file without frontmatter, THE Parser SHALL produce a structured object containing an empty metadata object, the full markdown body content, the extracted title, and all parsed Refs.
3. THE Pretty_Printer SHALL serialize a structured Node object back into a markdown file with valid YAML frontmatter delimited by `---` (when frontmatter fields are present), followed by the markdown body content with Ref tokens in their original syntax-prefixed form (`{{category/name}}`, `{{-> category/name}}`, `{{-> category/name | templates/condition}}`, `{{<< output.nodeName}}`).
4. WHEN a structured object has an empty metadata object (no frontmatter fields), THE Pretty_Printer SHALL serialize the file without a frontmatter block.
5. FOR ALL valid Node files (with or without frontmatter), parsing the file with the Parser then serializing with the Pretty_Printer then parsing again SHALL produce a Workflow_Graph object equivalent to the original parse (round-trip property).
6. FOR ALL valid Resource files (tools, skills, templates, interactions, memory — with or without frontmatter), parsing then pretty-printing then parsing SHALL produce an equivalent structured object (round-trip property).
7. WHEN the Pretty_Printer serializes a Node that was programmatically modified (e.g., a Ref was added or removed), THE Pretty_Printer SHALL produce a valid markdown file that the Parser can re-parse without errors.

### Requirement 11: Variable Substitution

**User Story:** As a workflow author, I want to use environment variables and configuration values in my workflow files, so that secrets and environment-specific settings are not hardcoded.

#### Acceptance Criteria

1. WHEN the Parser encounters a `${env:VARIABLE_NAME}` token in frontmatter or markdown body content, THE Parser SHALL record the variable reference without resolving it during parse time.
2. WHEN the Exporter encounters a `${env:VARIABLE_NAME}` token, THE Exporter SHALL preserve the token as-is in the Export_Bundle, allowing the consuming agent to resolve the variable at runtime.
3. WHEN the Validator encounters a `${env:VARIABLE_NAME}` token, THE Validator SHALL verify that the token follows the `${env:VARIABLE_NAME}` format (alphanumeric and underscores only in the variable name) and SHALL return an error for malformed variable tokens.

### Requirement 12: Progressive Disclosure for Token Budgets

**User Story:** As a consuming AI agent, I want to load workflow metadata first and full content on demand, so that I can operate within token budget constraints.

#### Acceptance Criteria

1. THE Parser SHALL support a `metadata-only` parsing mode that extracts only frontmatter fields and the markdown title from each file, without parsing the full markdown body or extracting Refs.
2. THE Parser SHALL support a `full` parsing mode that extracts frontmatter, title, full markdown body, and all Refs with semantic types (the current default behavior).
3. WHEN the CLI `parse` command receives a `--metadata-only` flag, THE CLI SHALL output the Workflow_Graph with only metadata-level information for each node and resource.
4. THE Export_Bundle SHALL include a `summary` field for each node containing only the node's name, description, type, and list of outgoing edge targets, enabling consuming agents to understand workflow structure without loading full content.

### Requirement 13: Flexible Graph Entry Points

**User Story:** As a workflow author, I want workflows to support multiple entry points and flexible starting conditions, so that different triggers or user intents can enter the graph at different nodes without requiring a single mandatory start point.

#### Acceptance Criteria

1. WHEN a Node's frontmatter contains `entry: true`, THE Parser SHALL mark that Node as an Entry_Node in the Workflow_Graph.
2. THE Parser SHALL allow zero, one, or multiple Nodes in a workflow to be marked as Entry_Nodes.
3. WHEN a workflow contains a workflow descriptor file (any `.md` file with `type: agents` in frontmatter, or conventionally named `AGENTS.md`), THE Parser SHALL treat the descriptor as a menu of available paths, listing the workflow's entry points and their descriptions for consuming agents to select from.
4. WHEN no Nodes in a workflow are explicitly marked with `entry: true` and no workflow descriptor file exists, THE Parser SHALL infer Entry_Nodes by identifying all Nodes with no incoming Edge_Refs in the Workflow_Graph.
5. WHEN the Parser infers Entry_Nodes from no-incoming-edges analysis, THE Parser SHALL mark each inferred Node as an Entry_Node with an `inferred: true` flag to distinguish inferred entries from explicit ones.
6. THE Export_Bundle SHALL include an `entry_points` array listing all Entry_Nodes (explicit and inferred) with their node identifiers, names, descriptions, and whether the entry was explicit or inferred.
7. THE Workflow_Graph SHALL NOT require exactly one start node. WHEN a consuming agent receives a Workflow_Graph with multiple Entry_Nodes, the consuming agent selects which entry point to use based on the workflow descriptor or its own logic.

### Requirement 14: Directory Explorer UI

**User Story:** As a workflow author, I want a VS Code-style file tree explorer in the UI that mirrors the actual `.agentflow/` directory structure, so that I can browse and navigate my workflow files the same way I navigate code.

#### Acceptance Criteria

1. THE Directory_Explorer SHALL display the `.agentflow/` directory tree as a hierarchical file tree that mirrors the actual filesystem structure, including all directories and `.md` files.
2. WHEN a file or directory is created, renamed, moved, or deleted in the `.agentflow/` directory, THE Directory_Explorer SHALL reflect the change in the file tree without requiring a manual refresh.
3. WHEN a user selects a `.md` file in the Directory_Explorer, THE Directory_Explorer SHALL open the file in the editor pane, displaying both the frontmatter (if present) and the markdown body.
4. THE Directory_Explorer SHALL display visual indicators for Resource_Type (e.g., icons or labels) based on the file's resolved type (from frontmatter `type` field or directory inference), so that users can identify tools, skills, templates, interactions, memory, and nodes at a glance.
5. THE Directory_Explorer SHALL display Node directories with a distinct visual treatment (e.g., folder icon variant) that distinguishes them from Reserved_Directories and plain directories.
6. WHEN a Node directory contains multiple `.md` files, THE Directory_Explorer SHALL visually indicate which file is the Primary_File and which files are Context_Files.
7. THE Directory_Explorer SHALL support drag-and-drop of `.md` files between directories, updating the file's location on the filesystem.
