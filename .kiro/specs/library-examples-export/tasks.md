# Tasks: Library, Examples & Export (Spec 3)

Tracks A-D can run in parallel. Track E depends on A+B. Track F depends on all.

## Track A: Export Service (backend)

- [x] 1. Create `agentflow/src/services/export-service.js`
  - [x] 1.1 `exportAsJson(rootDir, options)` — JSON bundle with files + graph summary
  - [x] 1.2 `exportAsZip(rootDir, options)` — ZIP via JSZip (already installed)
  - [x] 1.3 `exportAsDir(rootDir, options)` — copy to target path
  - [x] 1.4 `exportAsShareable(rootDir, options)` — compact JSON for URL/clipboard
  - [x] 1.5 `exportFullWorkspace(rootDir, options)` — walks .agentflow/ tree, dispatches to format
  - **Reqs**: 1.1–1.7

- [x] 2. Export routes
  - [x] 2.1 Extend `POST /api/export` in orchestrator-routes.js to support `format: json|zip|dir|share`
  - **Reqs**: 6.1

## Track B: Import Service (backend)

- [x] 3. Create `agentflow/src/services/import-service.js`
  - [x] 3.1 `importFromZip(buffer, targetRoot, options)` — extract ZIP, validate, write
  - [x] 3.2 `importFromUrl(url, targetRoot, options)` — fetch, parse, validate, write
  - [x] 3.3 `importFromClipboard(json, targetRoot, options)` — parse, validate, write
  - [x] 3.4 `importFromLibrary(type, name, targetRoot)` — copy from library/
  - [x] 3.5 `validateImportFileMap(fileMap)` — path traversal, frontmatter, structure checks
  - **Reqs**: 2.1–2.8

- [x] 4. Import routes
  - [x] 4.1 Add `POST /api/import` route
  - [x] 4.2 Add `GET /api/library` route (list all items from registry)
  - [x] 4.3 Add `POST /api/library/add` route (add item to workspace)
  - [x] 4.4 Add `GET /api/library/:type/:name` route (preview content)
  - **Reqs**: 6.2–6.5

## Track C: Library Content Enrichment

- [x] 5. Enrich library items
  - [x] 5.1 Enrich all 23 tools with JSON Schema parameters
  - [x] 5.2 Enrich all 20 skills with process steps, anti-patterns, output format
  - [x] 5.3 Enrich all 17 templates with check field and narrativeTemplate
  - [x] 5.4 Enrich all 9 interactions with prompts, options, timeout
  - [x] 5.5 Enrich all 4 memory items with format, read/write instructions
  - [x] 5.6 Update registry.json with tags, domain, complexity
  - **Reqs**: 4.1–4.6

## Track D: Example Workflows

- [x] 6. Create 3 new example workflows
  - [x] 6.1 `library/workflows/customer-support/` — router pattern (triage → route → billing|technical|general → respond)
  - [x] 6.2 `library/workflows/content-pipeline/` — pipeline pattern (research → draft → edit → review-gate → publish)
  - [x] 6.3 `library/workflows/incident-response/` — supervisor pattern (detect → triage → investigate → mitigate → review-gate → postmortem)
  - [x] 6.4 Add all 3 to registry.json
  - **Reqs**: 5.1–5.3

## Track E: Library Browser UI (after A+B for API)

- [x] 7. Library Browser panel
  - [x] 7.1 Create `ui/src/components/library/LibraryBrowser.tsx` — search, filter, item cards
  - [x] 7.2 Create `ui/src/components/library/LibraryPreview.tsx` — preview dialog
  - [x] 7.3 Wire into left panel tabs (alongside Explorer, Elements)
  - **Reqs**: 3.1–3.6

## Track F: Verification

- [x] 8. Tests + verification
  - [x] 8.1 Export service unit tests (all 4 formats)
  - [x] 8.2 Import service unit tests (ZIP, clipboard, validation)
  - [x] 8.3 Library search/filter tests
  - [x] 8.4 All existing 25 tests still pass

## Track G: Gap Fixes (post-verification)

- [x] 9. CLI commands
  - [x] 9.1 Update `export` command to support `--format json|zip|dir|share` (plus legacy raw/parsed)
  - [x] 9.2 Add `import --from <source>` command (ZIP, JSON, URL) with `--overwrite` and `--dry-run`
  - [x] 9.3 Extend `library` command with `list` and `search` subactions, `--type` and `--tags` filters

- [x] 10. Library Browser UI enhancements
  - [x] 10.1 Drag-and-drop: library items draggable onto canvas nodes (uses existing `application/agentflow-library` protocol)
  - [x] 10.2 Installed indicator: green checkmark on items already in workspace
  - [x] 10.3 LibraryPreview shows "Installed" state with disabled button
