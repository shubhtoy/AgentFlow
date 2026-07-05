# packages/cli — fs-walking parser, export engine, MCP bridge

Node.js. Everything here that isn't fs/process-specific should probably be a thin wrapper
around `packages/core`. See root `AGENTS.md` for repo-wide rules; `docs/FEATURE-MAP.md` for
what's already built here.

## Files

| File | What |
|---|---|
| `src/parser.ts` | Reads `.agentflow/` from disk, delegates parsing to core (`parseRoot`, `parseWorkflow`, `parseNode`, `parseMarkdownFile`); re-exports all core parser/ref-paths functions |
| `src/export/engine.ts` | `exportForPlatform` — maps a `ParsedGraph` to per-platform output files via `configs/platforms.json` transform rules |
| `src/export/transforms/` | One file per reusable transform (concatenate, flatten-skill, split-identity, merge-mcp-config, to-mdc, to-skill-dir, copy, rename) |
| `src/export/agent-spec-transform.ts` | Oracle Agent Spec serializer — only needed for runtime-framework interop, not the IDE export path |
| `src/git/repo-scanner.ts` | `findAgentflowDirs` — discovers workspaces/resources across a repo tree |
| `src/git/` | `git-manager.ts`, `sync-engine.ts`, `config-manager.ts` |
| `src/mcp/` | `tool-provider.ts`, `tool-scaffolder.ts`, `config-manager.ts`, `server-lifecycle.ts`, `unified-search.ts` |
| `src/services/` | Workflow/instruction/import/hook services — consumed by the studio's API routes |

## Rules specific to this directory

- Before writing fs/parse glue, check `parser.ts` doesn't already export it — don't grow a
  second private copy in a service file (this happened once with `parseMarkdownFile`; fixed).
- Platform export behaviour is data-driven from `configs/platforms.json` + `configs/platforms/`
  — prefer adding/adjusting a transform rule over branching in `engine.ts`.
