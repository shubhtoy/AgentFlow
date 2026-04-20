---
name: pre-shipped-library
scope: workflow
description: "Part 12: The pre-shipped library — all capabilities, instructions, runbooks, hooks, memory, and workflows"
tags:
  - guide
  - library
  - pre-shipped
  - resources
---

# Part 12 — The Pre-Shipped Library

AgentFlow ships with a curated library of ready-to-use resources across all categories. Copy what you need into your workspace and customize.

## Capabilities (12)

| Name | Type | Purpose |
|------|------|---------|
| `read-code` | builtin | Read and analyze source code, search for symbols |
| `write-file` | builtin | Create or modify files |
| `run-tests` | script | Execute the project test suite |
| `get-diagnostics` | builtin | Check for compile/lint/type errors |
| `web-search` | builtin | Search the internet for information |
| `git-history` | script | Query git log and blame |
| `source-agent` | mcp | Semantic code search via MCP server |
| `analyze-image` | builtin | Analyze images and screenshots |
| `file-search` | builtin | Fuzzy file path search |
| `list-directory` | builtin | List directory contents |
| `grep-search` | builtin | Regex text search across files |
| `shell-exec` | script | Execute arbitrary shell commands |

## Instructions (12)

| Name | Scope | Purpose |
|------|-------|---------|
| `requirements-elicitation` | workflow | Transform requests into testable requirements |
| `technical-design` | workflow | Create architecture and API contracts |
| `task-decomposition` | workflow | Break designs into atomic implementation tasks |
| `implementation-discipline` | workflow | Write quality code with verification |
| `code-search` | workflow | Efficient codebase exploration strategies |
| `security-review` | workflow | Security audit checklist |
| `api-design` | workflow | API design best practices |
| `test-analysis` | workflow | Analyze and interpret test results |
| `coding-standards` | global | Project-wide coding conventions (auto-loaded) |
| `debugging` | workflow | Systematic debugging methodology |
| `refactoring` | workflow | Safe refactoring techniques |
| `prompt-engineering` | workflow | Effective prompt construction |

## Runbooks (29)

**Conditions (17):**
`design-approved`, `design-rejected`, `requirements-approved`, `requirements-rejected`, `tasks-approved`, `tasks-rejected`, `tests-pass`, `tests-fail`, `all-tasks-done`, `more-tasks-remain`, `task-complete`, `task-failed`, `implementation-ready`, `retry-with-feedback`, `code-needed`, `debug-needed`, `explore-needed`

**Interactions (12):**
`review-design`, `review-requirements`, `review-tasks`, `checkpoint`, `collect-feedback`, `show-diff`, `escalate-to-human`, `confirm-destructive`, `explain-needed`, `refactor-needed`, `new-request`, `session-ending`

## Hooks (5)

| Hook | Event | Action | Enabled by default |
|------|-------|--------|-------------------|
| `diagnostics-after-write` | `fileEdited` (code files) | `trigger-workflow` → get-diagnostics | Yes |
| `lint-on-save` | `fileEdited` (ts/js files) | `run-script` → npm run lint --fix | Yes |
| `test-on-change` | `fileEdited` (source files) | `run-script` → npm test --related | No |
| `security-scan-on-commit` | `pre-commit` | `run-script` → npm audit --production | No |
| `memory-on-session-end` | `session-end` | `notify` → remind agent to persist learnings | Yes |

## Memory (5)

`MEMORY` (instructions), `user`, `decisions`, `facts`, `lessons`

## Example Workflows

| Workflow | Nodes | Pattern |
|----------|-------|---------|
| `build-feature` | 9 | Linear + review gates + rejection loops + iteration |
| `code-review` | 3 | Linear (scan → analyze → report) |
| `interactive-assistant` | Multi | Triage → explore/code/debug/refactor → review → wrap up |
| `agent-builder` | Multi | Build new agent workspaces through conversation |

---

Next: [Graph Design Patterns](13-graph-patterns.md)
