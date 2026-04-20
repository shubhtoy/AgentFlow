# Implementation Plan: Git Integration

## Overview

Add Git-backed sync for `.agentflow/` workspaces — auto-scanning repos, user-controlled config, public/private/agentic repo support, mono-repo detection. Four new modules (GitManager, RepoScanner, SyncEngine, ConfigManager) plus CLI commands, API endpoints, and UI panels. Built bottom-up: config → git ops → scanner → sync engine → CLI → API → UI.

## Tasks

- [x] 1. ConfigManager — config loading, saving, defaults
  - [x] 1.1 Create `src/git/config-manager.js`
    - Export `loadOrCreate(configPath)` — reads `.agentflow/.gitconfig.yaml` via `js-yaml`, returns `GitSyncConfig` object; creates default if missing
    - Export `save(config, configPath)` — validates and writes YAML
    - Export `getDefaults()` — returns default config: `version: "1.0.0"`, empty repos, default sync rules (`["**/*.md", "**/*.yaml"]` include, `["**/output/**", "**/node_modules/**"]` exclude), `conflictStrategy: "manual"`, `autoScan: true`, `scanDepth: 5`
    - Validate repo mapping uniqueness (no duplicate `name` fields)
    - Reject glob patterns containing `../` (path traversal prevention)
    - _Design: ConfigManager, GitSyncConfig, RepoMapping, SyncRules data models_

  - [x] 1.2 Write unit tests `tests/unit/config-manager.test.js`
    - Test load/save round-trip fidelity (Property 4)
    - Test default generation
    - Test duplicate repo name rejection (Property 5)
    - Test path traversal rejection in glob patterns
    - Test malformed YAML handling (graceful fallback)
    - _Design: Correctness Properties 4, 5; Error Scenario 5_

- [x] 2. GitManager — Git CLI wrapper
  - [x] 2.1 Create `src/git/git-manager.js`
    - Use `child_process.execFile` (not `exec`) for all git commands — shell injection prevention
    - Export `clone(repoUrl, targetDir, branch)` — `git clone -b <branch> <url> <dir>`
    - Export `attach(repoDir)` — verify `.git` exists, return bound instance
    - Export `pull(branch)` — `git pull origin <branch>`, parse output for conflicts
    - Export `push(branch)` — `git push origin <branch>`
    - Export `status()` — return `GitRepoStatus` (isRepo, isClean, branch, ahead, behind, modified, untracked, hasRemote, remoteUrl)
    - Export `stage(filePath)`, `commit(message)`, `stagedFileCount()`
    - Export `addRemote(name, url)`, `showRemote(filePath, branch)`
    - Export `checkoutOurs(path)`, `checkoutTheirs(path)`
    - Never store/cache/log credentials — delegate to user's git credential manager (Property 8)
    - _Design: GitManager component, GitRepoStatus model, Algorithm 1 steps 3-4_

  - [x] 2.2 Write unit tests `tests/unit/git-manager.test.js`
    - Test command construction (verify correct args passed to `execFile` without executing)
    - Mock `child_process.execFile` to test status parsing, pull conflict detection, push result parsing
    - Test `attach()` rejects non-git directories
    - Test no credentials appear in any constructed commands or error messages (Property 8)
    - _Design: GitManager formal specs, Error Scenarios 1, 2_

- [x] 3. RepoScanner — auto-detect `.agentflow/` structure
  - [x] 3.1 Create `src/git/repo-scanner.js`
    - Export `scan(rootDir, maxDepth)` — walks directories up to `maxDepth`, finds all `.agentflow/` dirs
    - For each `.agentflow/`: scan reserved dirs (`tools/`, `skills/`, `interactions/`, `templates/`, `memory/`) using existing `Parser.parseMarkdownFile()` in `metadata-only` mode
    - Detect workflows: subdirs with `AGENTS.md` or frontmatter `type: agents`
    - Return `ScanResult` with `agentflowPaths`, `resources` (categorized), `workflows`, `stats`, `warnings`
    - Export `scanIncremental(rootDir, changedFiles)` — re-scan only changed files, merge with cached state
    - Warn (don't error) when no `.agentflow/` found
    - _Design: RepoScanner component, Algorithm 2, ScanResult/ScanResourceMap/ScannedResource/ScannedWorkflow models_

  - [x] 3.2 Write unit tests `tests/unit/repo-scanner.test.js`
    - Use `tests/generators/directory.gen.js` to create mock directory trees
    - Test scan completeness — every `.agentflow/` within depth is found (Property 1)
    - Test resource categorization by directory name
    - Test workflow detection via `AGENTS.md`
    - Test mono-repo: multiple `.agentflow/` dirs at different nesting levels
    - Test `scanDepth` limit respected
    - Test stats accuracy (Property 6)
    - Test incremental scan consistency (Property 10)
    - _Design: Correctness Properties 1, 6, 10; Error Scenario 6_

- [x] 4. SyncEngine — orchestrate pull/push/conflict resolution
  - [x] 4.1 Create `src/git/sync-engine.js`
    - Export `sync(config, repoName, direction)` — implements Algorithm 3
    - Apply `matchesSyncRules(filePath, syncRules)` — Algorithm 4: exclude-first, then include, then resource type filter
    - Conflict strategies: `local_wins`, `remote_wins`, `timestamp`, `manual` (mark as pending)
    - Lockfile `.agentflow/.synclock` — prevent concurrent syncs (Error Scenario 7)
    - Auto-scan after pull if `config.autoScan` is true
    - Return `SyncResult` with categorized file changes and conflicts
    - _Design: SyncEngine component, Algorithms 3-4, SyncResult/SyncConflict models_

  - [x] 4.2 Write unit tests `tests/unit/sync-engine.test.js`
    - Test `matchesSyncRules` with various glob/include/exclude/resourceType combos (Property 2)
    - Test each conflict strategy produces deterministic results (Property 3)
    - Test sync idempotency — no changes when already in sync (Property 7)
    - Test agentic repo isolation — only `agentflowPath` files touched (Property 9)
    - Test lockfile prevents concurrent sync
    - Test dry-run mode (no actual git operations)
    - _Design: Correctness Properties 2, 3, 7, 9; Error Scenario 7_

- [x] 5. Checkpoint — core modules compile and pass tests
  - Run all unit tests for config-manager, git-manager, repo-scanner, sync-engine. Verify no regressions in existing parser/validator tests. Ask user if questions arise.

- [x] 6. CLI commands — wire git subcommands into existing CLI
  - [x] 6.1 Add git subcommands to `src/cli.js`
    - `agentflow git init <repo-url>` — flags: `--name`, `--role` (primary|agentic|shared), `--branch`, `--repo-type` (public|private|custom). Calls `initializeRepo()` (Algorithm 1), displays scan results
    - `agentflow git scan [dir]` — flag: `--depth`. Calls `RepoScanner.scan()`, pretty-prints structure
    - `agentflow git sync [repo-name]` — flags: `--direction` (push|pull|bidirectional), `--dry-run`. Calls `SyncEngine.sync()`
    - `agentflow git status [repo-name]` — calls `GitManager.status()`, displays repo state
    - `agentflow git resolve <path>` — flag: `--strategy`. Calls `SyncEngine.resolveConflict()`
    - `agentflow git config` — flags: `--set`, `--get`, `--list`. Reads/writes via ConfigManager
    - _Design: CLI Commands table, Algorithm 1_

- [x] 7. API endpoints — expose git operations over HTTP
  - [x] 7.1 Add git routes to `src/server.js`
    - `GET /api/git/status` — return `GitRepoStatus` + last sync timestamp
    - `POST /api/git/init` — body: `{ url, name, role, branch, repoType }` → `initializeRepo()`
    - `POST /api/git/sync` — body: `{ repoName, direction, dryRun }` → `SyncEngine.sync()`
    - `GET /api/git/scan` — query: `?dir=&depth=` → `RepoScanner.scan()`
    - `GET /api/git/conflicts` — return pending conflicts from last sync
    - `POST /api/git/resolve` — body: `{ path, strategy }` → resolve conflict
    - `GET /api/git/config` — return current `GitSyncConfig`
    - `PUT /api/git/config` — validate and save updated config
    - _Design: API Endpoints table_

- [x] 8. UI — Git panel, scan results, sync status, repo config
  - [x] 8.1 Create `ui/src/components/GitPanel.tsx`
    - Docked panel (reuse existing panel pattern from ExplorerPanel)
    - Show connected repos list with status indicators (clean/dirty/conflicts)
    - "Connect Repo" button → opens RepoConfigDialog
    - Per-repo actions: Sync, Scan, Status, Disconnect
    - _Design: UI Layer — GitPanel_

  - [x] 8.2 Create `ui/src/components/ScanResultsView.tsx`
    - Display scan results: categorized resources (tools, skills, etc.) with counts
    - Show discovered workflows with node counts
    - Show warnings (e.g., no `.agentflow/` found)
    - Expandable tree view for mono-repo multi-path results
    - _Design: UI Layer — ScanResultsView, ScanResult model_

  - [x] 8.3 Create `ui/src/components/RepoConfigDialog.tsx`
    - MUI Dialog for connecting a new repo or editing existing mapping
    - Fields: URL, name, role (primary/agentic/shared), branch, repo type (public/private/custom), agentflow path
    - Sync rules editor: include/exclude patterns, resource type checkboxes, direction toggle
    - Conflict strategy selector
    - _Design: UI Layer — RepoConfigDialog, GitSyncConfig/RepoMapping models_

  - [x] 8.4 Create `ui/src/components/SyncStatusBar.tsx`
    - Compact status indicator in ActionBar area
    - Shows: last sync time, sync state (idle/syncing/error/conflicts), ahead/behind counts
    - Click → opens GitPanel
    - _Design: UI Layer — SyncStatusBar_

  - [x] 8.5 Wire git state into Zustand store (`ui/src/store.ts`)
    - Add `gitState` slice: `repos`, `syncStatus`, `lastScanResult`, `pendingConflicts`
    - Add actions: `fetchGitStatus()`, `triggerSync()`, `triggerScan()`, `connectRepo()`, `resolveConflict()`
    - All actions call API endpoints from task 7
    - _Design: UI Layer integration with API_

- [x] 9. Final checkpoint — end-to-end validation
  - Run full test suite. Manually test: `agentflow git init` with a test repo, scan, sync round-trip. Verify UI panels render and connect to API. Ask user if questions arise.
