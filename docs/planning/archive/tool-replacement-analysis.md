# AgentFlow v2 — Tool Replacement Analysis

An inventory of every custom module in the codebase, what it does, how large it is, and which existing npm packages could replace or drastically shrink it. The goal: identify where you're reinventing wheels and where the custom code is genuinely necessary.

**Current dependencies:** commander, fastify, @fastify/cors, @fastify/static, glob, gray-matter, js-yaml, jszip, serve-handler, minimatch (via sync-engine)

---

## Module Inventory

| Module | Lines | Purpose |
|--------|-------|---------|
| `src/parser.js` | ~1020 | Markdown parsing, ref extraction, frontmatter classification, workflow graph construction |
| `src/validator.js` | ~450 | Schema validation, cycle detection, ref validation, unreachable node detection |
| `src/exporter.js` | ~350 | Export bundle generation with ref resolution |
| `src/server.js` | ~500 | Fastify HTTP API (18+ routes) |
| `src/cli.js` | ~400 | Commander-based CLI with 9+ commands |
| `src/pretty-printer.js` | ~170 | Round-trip markdown serialization |
| `src/library.js` | ~200 | Library search, add, index |
| `src/structured-exporter.js` | ~120 | Raw/parsed directory export |
| `src/token-calculator.js` | ~300 | Heuristic token estimation per scope |
| `src/dry-runner.js` | ~250 | Workflow simulation/trace |
| `src/git/git-manager.js` | ~300 | Git CLI wrapper (clone, pull, push, status, conflict resolution) |
| `src/git/config-manager.js` | ~200 | YAML config loading/saving/validation |
| `src/git/sync-engine.js` | ~200 | Sync orchestration with lockfile and glob matching |
| `src/git/repo-scanner.js` | ~250 | Repo structure detection and .agentflow/ discovery |
| **Total** | **~4710** | |

---

## Module-by-Module Replacement Analysis

### 1. `src/parser.js` (~1020 lines)

**What it does:**
- Parses `{{ref}}` tokens with 4 regex patterns (mention, edge, conditional edge, data flow)
- Reads `.md` files, extracts frontmatter via `gray-matter`, extracts title from first `#` heading
- Classifies resources by frontmatter type or directory inference
- Identifies primary files in node directories
- Recursively parses workflow directories, builds edges from refs
- Resolves refs (path-first, name-second)
- Builds the full WorkflowGraph from a `.agentflow/` root

**What can be replaced:**

| Custom code | Replacement | Savings |
|-------------|-------------|---------|
| Frontmatter parsing | Already uses `gray-matter` | None — already done right |
| Markdown heading extraction | `unified` + `remark-parse` — parse to AST, walk for first heading | ~10 lines saved, but adds a dependency for minimal gain |
| Ref extraction (4 regex patterns) | **No good replacement.** This is custom DSL syntax. No existing tool parses `{{-> target \| condition}}` | Keep as-is |
| File globbing | Already uses `glob` | None |
| Directory walking / classification | Could use `fast-glob` (faster) but `glob` is fine | Marginal |
| Graph construction from refs | Could use `graphlib` for the graph data structure, but the construction logic is domain-specific | Marginal |

**Verdict: ~90% must stay custom.** The parser is the core of the DSL. The ref syntax is bespoke, the classification logic is domain-specific, and the graph construction is tightly coupled to the directory structure. The only thing `unified`/`remark` would buy you is AST-based heading extraction, which isn't worth the dependency.

**One real opportunity:** The `parseRoot` function (lines 600-1020) does a lot of manual directory walking, file grouping, and categorization. This could be restructured using a pipeline pattern, but no off-the-shelf tool replaces it.

---

### 2. `src/validator.js` (~450 lines)

**What it does:**
- Schema validation for 7 resource types (tool, skill, template, interaction, memory, node, agents)
- Cycle detection (DFS-based)
- Unreachable node detection (BFS from entry points)
- Variable token validation (`${env:VAR}` format)
- Ref resolution checking (broken refs, ambiguous refs)
- Context budget validation
- Output declaration validation

**What can be replaced:**

| Custom code | Replacement | Savings |
|-------------|-------------|---------|
| Schema validation (~150 lines) | **`zod` or `ajv`** — define schemas declaratively, get validation for free | **~120 lines eliminated.** The hand-rolled type checking, enum validation, conditional required fields, and literal checks are exactly what schema libraries do |
| Cycle detection (~50 lines) | **`graphlib`** — `graphlib.alg.findCycles()` is a one-liner | **~40 lines eliminated** |
| Unreachable node detection (~40 lines) | **`graphlib`** — BFS/DFS traversal built in | **~30 lines eliminated** |
| Variable validation (~30 lines) | Keep as-is — two regexes, simple and correct | None |
| Ref validation (~180 lines) | Keep as-is — domain-specific logic | None |

**Recommended replacements:**

```
npm install zod graphlib
```

- **`zod`** (~$0, 57KB): Replace the entire `SCHEMAS` object and `validateSchema` function with Zod schemas. You get type inference for free, better error messages, and conditional validation (`requiredWhen`) via `.refine()`. Estimated reduction: **120 lines → 40 lines of schema definitions.**

- **`graphlib`** (~$0, 30KB): Replace `detectCycles` and `findUnreachable` with `graphlib.alg.findCycles()` and BFS from `graphlib.alg.dijkstra()` or manual BFS on the graphlib Graph. Estimated reduction: **90 lines → 15 lines.**

**Verdict: ~190 lines eliminable (~42% of the file).**

---

### 3. `src/token-calculator.js` (~300 lines)

**What it does:**
- Heuristic token estimation: splits on whitespace, counts sub-word tokens for long words, adds punctuation overhead
- File-level, node-level, shared-resource, path-to-node, workflow, and full-graph token counting
- Human-readable summary formatting

**What can be replaced:**

| Custom code | Replacement | Savings |
|-------------|-------------|---------|
| `estimateTokens()` heuristic (~25 lines) | **`gpt-tokenizer`** or **`tiktoken`** — actual BPE tokenization matching GPT-family models | Accuracy improvement, ~same lines but correct results |
| Scope-based counting logic (~200 lines) | Keep as-is — domain-specific aggregation | None |
| Summary formatter (~75 lines) | Keep as-is | None |

**Recommended replacement:**

```
npm install gpt-tokenizer
```

- **`gpt-tokenizer`** (~$0, 2MB, pure JS, no WASM): Drop-in replacement for `estimateTokens()`. Actual cl100k_base tokenization instead of the `~4 chars per token` heuristic. The heuristic can be off by 20-40% on code and structured text.

  ```js
  const { encode } = require('gpt-tokenizer');
  function estimateTokens(text) {
    if (!text) return 0;
    return encode(text).length;
  }
  ```

- Alternative: **`js-tiktoken`** (~$0, lighter) if you want smaller bundle size.

**Verdict: 1 function replaced for accuracy. The rest stays — it's domain-specific aggregation logic.**

---

### 4. `src/git/git-manager.js` (~300 lines)

**What it does:**
- Wraps `child_process.execFile('git', ...)` for clone, pull, push, status, stage, commit, addRemote, showRemote, checkoutOurs, checkoutTheirs
- Parses `git status --porcelain`, `git rev-list --left-right --count`, pull conflict output
- Credential sanitization
- "Bound instance" pattern (methods pre-bound to a repoDir)

**What can be replaced:**

| Custom code | Replacement | Savings |
|-------------|-------------|---------|
| Entire file | **`simple-git`** | **~280 lines eliminated** |

**Recommended replacement:**

```
npm install simple-git
```

- **`simple-git`** (~$0, 150KB, 4M+ weekly downloads): Production-grade Git wrapper for Node.js. Provides every operation in git-manager.js and more:

  ```js
  const simpleGit = require('simple-git');
  const git = simpleGit('/path/to/repo');

  await git.clone(url, dir, ['--branch', branch]);
  await git.pull('origin', 'main');
  await git.push('origin', 'main');
  const status = await git.status();  // .modified, .not_added, .ahead, .behind, etc.
  await git.add(filePath);
  await git.commit('message');
  await git.checkout(['--ours', filePath]);
  await git.checkout(['--theirs', filePath]);
  await git.show([`origin/main:${filePath}`]);
  ```

  Built-in credential sanitization. Built-in error handling. Typed responses. No manual output parsing needed.

  The entire `parseStatusOutput`, `parseRevListCount`, `parsePullConflicts`, `sanitiseOutput`, and `createBoundInstance` functions become unnecessary.

**Verdict: Replace entirely. ~300 lines → ~20 lines of thin wrapper around `simple-git`.**

---

### 5. `src/git/config-manager.js` (~200 lines)

**What it does:**
- Loads/saves `.agentflow/.gitconfig.yaml` using `js-yaml`
- Merges with defaults
- Validates config (conflict strategy, sync direction, repo types, roles, glob patterns, repo name uniqueness)

**What can be replaced:**

| Custom code | Replacement | Savings |
|-------------|-------------|---------|
| Config loading with defaults + file discovery | **`cosmiconfig`** — searches for config files in standard locations, supports YAML/JSON/JS | ~30 lines saved on loading logic |
| Config validation (~80 lines) | **`zod`** (same as validator.js) — define the config schema once, validate on load and save | **~70 lines eliminated** |
| YAML serialization | Already uses `js-yaml` | None |

**Recommended replacements:**

- **`cosmiconfig`** (~$0, 25KB): Handles config file discovery, loading, and caching. Supports `.yaml`, `.json`, `.js`, `.ts` config files. Searches up the directory tree. Would replace `resolveConfigPath`, `loadOrCreate`, and the file existence checks.

- **`zod`** (already recommended for validator.js): Define the GitSyncConfig schema as a Zod schema. The `validate`, `validateRepoUniqueness`, `validateGlobPatterns`, and `hasPathTraversal` functions become `.refine()` calls on the schema.

  ```js
  const GitSyncConfig = z.object({
    version: z.string().default('1.0.0'),
    repos: z.array(RepoMapping).refine(
      repos => new Set(repos.map(r => r.name)).size === repos.length,
      'Duplicate repo names'
    ),
    syncRules: SyncRules,
    conflictStrategy: z.enum(['local_wins', 'remote_wins', 'manual', 'timestamp']),
    autoScan: z.boolean().default(true),
    scanDepth: z.number().int().default(5),
  });
  ```

**Verdict: ~100 lines eliminable (~50% of the file).**

---

### 6. `src/git/sync-engine.js` (~200 lines)

**What it does:**
- Glob-based sync rule matching (`matchesSyncRules`) using `minimatch`
- Lockfile management (acquire/release with stale lock detection)
- Pull/push orchestration with conflict resolution
- Resource type inference from file paths

**What can be replaced:**

| Custom code | Replacement | Savings |
|-------------|-------------|---------|
| Lockfile management (~30 lines) | **`proper-lockfile`** — battle-tested lockfile with stale detection, retries, and cross-platform support | **~25 lines eliminated**, plus better reliability |
| Glob matching | Already uses `minimatch` | None |
| Sync orchestration (~100 lines) | Keep as-is — domain-specific | None |
| Resource type inference (~15 lines) | Keep as-is — trivial | None |

**Recommended replacement:**

```
npm install proper-lockfile
```

- **`proper-lockfile`** (~$0, 15KB): Handles stale lock detection, retries, and cross-platform file locking. Replaces the manual `acquireLock`/`releaseLock` with:

  ```js
  const lockfile = require('proper-lockfile');
  const release = await lockfile.lock(agentflowDir, { stale: 300000 });
  try { /* sync */ } finally { release(); }
  ```

**Verdict: ~25 lines saved. The rest is domain logic.**

---

### 7. `src/git/repo-scanner.js` (~250 lines)

**What it does:**
- Recursively finds `.agentflow/` directories up to a max depth
- Scans reserved directories for markdown resources (using `glob` + `parseMarkdownFile`)
- Detects workflow directories (looks for `AGENTS.md` or `type: agents` frontmatter)
- Incremental scan with caching

**What can be replaced:**

| Custom code | Replacement | Savings |
|-------------|-------------|---------|
| `findAgentflowDirs` recursive walk (~25 lines) | **`fast-glob`** with depth option: `fast-glob('.agentflow', { onlyDirectories: true, deep: maxDepth })` | ~20 lines saved |
| Resource scanning | Reuses `parseMarkdownFile` + `glob` — already lean | None |
| Workflow detection | Domain-specific | None |
| Incremental scan cache | Keep as-is | None |

**Verdict: Marginal savings. This module is already fairly lean and domain-specific.**

---

### 8. `src/pretty-printer.js` (~170 lines)

**What it does:**
- `serialize(file)` → reconstructs markdown with YAML frontmatter using `gray-matter.stringify()`
- `serializeNode(node, dir)` → writes primary + context files to a directory
- `serializeGraph(graph, rootDir)` → writes entire `.agentflow/` structure

**What can be replaced:**

| Custom code | Replacement | Savings |
|-------------|-------------|---------|
| `serialize()` | Already delegates to `gray-matter.stringify()` — this is a 10-line wrapper | None |
| `serializeNode()` / `serializeGraph()` | Domain-specific directory writing | None |

**Verdict: Already minimal. No replacement needed.** The module is essentially a thin layer over `gray-matter.stringify()` plus recursive directory writing. Well done.

---

### 9. `src/exporter.js` (~350 lines)

**What it does:**
- Resolves refs for export (mention → inline content, edge → node id, data flow → placeholder)
- Replaces ref tokens in content with resolved forms
- Builds ExportNode, ExportEdge, ExportTool, ExportResource objects
- Assembles the full ExportBundle (graph + resources + metadata + errors)

**What can be replaced:**

Nothing. This is entirely domain-specific transformation logic. There's no generic "resolve custom DSL refs and build export bundles" library. The code is clean and well-structured.

**Verdict: Keep as-is. 0 lines replaceable.**

---

### 10. `src/structured-exporter.js` (~120 lines)

**What it does:**
- `exportRaw()` — collects all source files preserving directory structure
- `exportParsed()` — same but with `{{ref}}` tokens replaced by `[[resolved-path]]`

**What can be replaced:**

Nothing. Domain-specific. Already concise.

**Verdict: Keep as-is.**

---

### 11. `src/dry-runner.js` (~250 lines)

**What it does:**
- DFS traversal of workflow graph from entry points
- Cycle detection with configurable max visits
- Collects referenced resources and data flow inputs per step
- Token accumulation per step
- Router branch exploration (all branches or specific)
- Sub-workflow expansion
- Human-readable trace formatting

**What can be replaced:**

| Custom code | Replacement | Savings |
|-------------|-------------|---------|
| Graph traversal | **`graphlib`** for the data structure, but the visit logic is domain-specific | Marginal |
| Everything else | Domain-specific simulation | None |

**Verdict: Keep as-is. The traversal logic is tightly coupled to the domain model (router branching, sub-workflow expansion, token accumulation). A generic graph library wouldn't simplify it.**

---

### 12. `src/library.js` (~200 lines)

**What it does:**
- `search()` — substring match on name/description/tags
- `add()` — copies files/directories from library to workspace
- `index()` — scans library directory, reads frontmatter, builds registry

**What can be replaced:**

| Custom code | Replacement | Savings |
|-------------|-------------|---------|
| `search()` (~15 lines) | **`fuse.js`** — fuzzy search with ranking, typo tolerance | Better UX, ~same lines |
| `add()` file copying (~40 lines) | **`fs-extra`** `.copySync()` — already does recursive copy with options | ~10 lines saved (replaces `fs.cpSync` which requires Node 16.7+) |
| `index()` directory scanning (~80 lines) | Keep as-is — domain-specific | None |

**Recommended replacement:**

- **`fuse.js`** (~$0, 25KB): Fuzzy search with configurable keys and thresholds. Replaces the naive `includes()` matching with ranked results and typo tolerance:

  ```js
  const Fuse = require('fuse.js');
  const fuse = new Fuse(registry.entries, {
    keys: ['name', 'description', 'tags'],
    threshold: 0.4,
  });
  return fuse.search(query).map(r => r.item);
  ```

**Verdict: Minor improvements. The module is already lean.**

---

### 13. `src/server.js` (~500 lines)

**What it does:**
- Fastify server with CORS, static file serving, 18+ API routes
- JSON schema validation on POST bodies
- File CRUD operations (save, create, delete, move)
- Proxies to parser, validator, exporter, library, token calculator, dry runner
- Full git integration API (status, init, sync, scan, conflicts, resolve, config)
- SPA fallback for the React UI

**What can be replaced:**

| Custom code | Replacement | Savings |
|-------------|-------------|---------|
| JSON schema definitions (~100 lines) | **`zod`** + **`fastify-type-provider-zod`** — define schemas once, get validation + TypeScript types | Cleaner code, ~same lines |
| Route handlers | Domain-specific | None |
| `buildTree()` directory walker (~60 lines) | Keep as-is — annotates with domain metadata | None |

The server is already using Fastify, which is the right choice. The main opportunity is using Zod for schema definitions (which you'd already have from the validator refactor) instead of the verbose JSON Schema objects.

**Verdict: ~100 lines of JSON schema definitions could be replaced with Zod schemas shared with the validator. The route handlers stay.**

---

### 14. `src/cli.js` (~400 lines)

**What it does:**
- Commander-based CLI with commands: parse, validate, export, graph, init, add, search, library, ui, tokens, dry-run, git (init/scan/sync/status/resolve/config)

**What can be replaced:**

Already uses `commander`, which is the standard. The CLI is a thin orchestration layer over the other modules. No replacement needed.

**Verdict: Keep as-is.**

---

## Summary: Replacement Impact

| Replacement | Package | Modules affected | Lines saved | Effort |
|-------------|---------|-----------------|-------------|--------|
| `simple-git` | simple-git | git-manager.js | **~280** | Low — API is nearly 1:1 |
| `zod` | zod | validator.js, config-manager.js, server.js | **~290** | Medium — rewrite schemas as Zod objects |
| `graphlib` | graphlib | validator.js, (dry-runner.js marginal) | **~70** | Low — drop-in for cycle/reachability |
| `gpt-tokenizer` | gpt-tokenizer | token-calculator.js | **~0 lines** but **accuracy fix** | Low — 1 function swap |
| `proper-lockfile` | proper-lockfile | sync-engine.js | **~25** | Low — drop-in |
| `cosmiconfig` | cosmiconfig | config-manager.js | **~30** | Low |
| `fuse.js` | fuse.js | library.js | **~0 lines** but **better UX** | Low |

**Total lines eliminable: ~695 out of ~4710 (~15%)**

---

## What This Tells You

The honest answer: most of your code is domain-specific and can't be replaced by off-the-shelf tools. The parser, exporter, structured exporter, dry runner, pretty printer, and CLI are all custom DSL logic that no library covers.

The biggest win is **`simple-git`** replacing the entire git-manager.js — that's 280 lines of output parsing and process management that a mature library handles better. The second biggest win is **`zod`** unifying schema validation across the validator, config manager, and server — that's ~290 lines of hand-rolled type checking replaced by declarative schemas.

The rest are incremental improvements: accurate tokenization, better search, proper lockfiles.

### What you should NOT replace

- **The parser.** Your ref syntax is custom. `unified`/`remark` would add complexity without reducing code. `gray-matter` already handles the frontmatter. The regex-based ref extraction is clean and correct.
- **The exporter / structured exporter.** Pure domain logic. No library does "resolve AgentFlow refs and build export bundles."
- **The dry runner.** The traversal is tightly coupled to your domain model (routers, sub-workflows, token accumulation). `graphlib` wouldn't simplify it meaningfully.
- **The pretty printer.** Already minimal — a thin wrapper over `gray-matter.stringify()`.

### Priority order for replacements

1. **`simple-git`** — biggest line reduction, lowest risk, most mature replacement
2. **`zod`** — biggest architectural improvement, unifies validation across 3 modules
3. **`gpt-tokenizer`** — zero effort, fixes a real accuracy problem
4. **`proper-lockfile`** — small but eliminates a subtle bug surface (stale locks, race conditions)
5. **`cosmiconfig`** + **`fuse.js`** — nice-to-haves, not urgent
