# Requirements: Library, Examples & Export (Spec 3)

## 1. Export Service
- 1.1 JSON bundle export (single self-contained file)
- 1.2 ZIP archive export (.agentflow/ as ZIP)
- 1.3 Standalone directory export (copy to target path)
- 1.4 Shareable compact format (URL/clipboard safe)
- 1.5 Full workspace export (all workflows + resources)
- 1.6 Preserve frontmatter, {{ref}} tokens, ${env:VAR} tokens
- 1.7 MCP config conversion on export (protocols.json → mcp.json)

## 2. Import Service
- 2.1 Import from ZIP
- 2.2 Import from URL (fetch shareable JSON)
- 2.3 Import from clipboard (paste shareable JSON)
- 2.4 Import from library (one-click add)
- 2.5 Validation before writing (frontmatter, refs, structure)
- 2.6 Path traversal prevention
- 2.7 Dry-run mode (preview only)
- 2.8 Merge mode (skip existing files unless overwrite)

## 3. Library Browser UI
- 3.1 Search bar with debounced filtering
- 3.2 Category filter chips
- 3.3 Item cards with type badge, description, installed indicator
- 3.4 Preview dialog with full markdown content
- 3.5 One-click "Add" button
- 3.6 Empty state

## 4. Library Content Enrichment
- 4.1 Tools: JSON Schema parameters in frontmatter
- 4.2 Skills: process steps, anti-patterns, output format
- 4.3 Templates: unambiguous check field, narrativeTemplate
- 4.4 Interactions: real prompts, user options, timeout behavior
- 4.5 Memory: structured format, read/write instructions
- 4.6 Registry: tags, domain, complexity fields

## 5. Example Workflows
- 5.1 customer-support (router pattern)
- 5.2 content-pipeline (pipeline pattern)
- 5.3 incident-response (supervisor pattern)

## 6. API Endpoints
- 6.1 POST /api/export — multi-format export
- 6.2 POST /api/import — multi-source import
- 6.3 GET /api/library — list all library items
- 6.4 POST /api/library/add — add item to workspace
- 6.5 GET /api/library/:type/:name — preview item content
