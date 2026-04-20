---
name: hooks-and-events
scope: workflow
description: "Part 10: Hooks & event automation — events, conditions, actions, pre-shipped hooks"
tags:
  - guide
  - hooks
  - events
  - automation
---

# Part 10 — Hooks & Event Automation

Hooks are event-driven automation rules defined as JSON files in `hooks/`. They trigger actions when workspace events occur — no manual intervention needed.

## Hook Structure

```json
{
  "name": "lint-on-save",
  "version": "1.0.0",
  "description": "Run linter automatically when source files are saved",
  "event": "fileEdited",
  "condition": {
    "field": "path",
    "operator": "matches",
    "value": "\\.(ts|tsx|js|jsx)$"
  },
  "action": {
    "type": "run-script",
    "target": "npm run lint -- --fix",
    "params": {}
  },
  "enabled": true,
  "priority": 100
}
```

## Hook Fields

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `name` | string | Yes | Hook identifier (1–100 chars) |
| `version` | string | No | Semver version (default: `"1.0.0"`) |
| `description` | string | No | Human-readable description |
| `event` | string | Yes | What triggers this hook |
| `condition` | object | No | Optional filter — only fire if condition matches |
| `condition.field` | string | Yes (in condition) | Event field to check |
| `condition.operator` | enum | Yes (in condition) | How to compare |
| `condition.value` | string/number/boolean | Yes (in condition) | Value to compare against |
| `action.type` | enum | Yes | What to do when triggered |
| `action.target` | string | Yes | The workflow name, script command, or notification target |
| `action.params` | object | No | Additional parameters for the action |
| `enabled` | boolean | No | Toggle without deleting (default: `true`) |
| `priority` | integer | No | Lower numbers run first, 0–1000 (default: `100`) |

## Event Types

| Event | Trigger | Available fields |
|-------|---------|-----------------|
| `fileEdited` | A file is saved | `path`, `content`, `oldContent` |
| `fileCreated` | A new file is created | `path`, `content` |
| `fileDeleted` | A file is deleted | `path` |
| `preToolUse` | Before a tool executes | `toolName`, `args`, `source` |
| `postToolUse` | After a tool executes | `toolName`, `args`, `result`, `source` |
| `workflowStarted` | A workflow begins | `workflowId`, `trigger` |
| `workflowCompleted` | A workflow finishes | `workflowId`, `result`, `duration` |
| `workflowFailed` | A workflow errors | `workflowId`, `error` |
| `nodeEntered` | A node activates | `workflowId`, `nodeId`, `nodeType` |
| `nodeCompleted` | A node finishes | `workflowId`, `nodeId`, `result` |
| `memoryUpdated` | A memory file changes | `category`, `key`, `value` |
| `protocolToggled` | A protocol is toggled | `protocolName`, `enabled` |
| `pre-commit` | Before a git commit | *(git context)* |
| `session-end` | Session is ending | *(session context)* |

## Condition Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `equals` | Exact string match | `"field": "path", "value": "src/index.ts"` |
| `contains` | Substring match | `"field": "path", "value": "src/"` |
| `startsWith` | Prefix match | `"field": "path", "value": "tests/"` |
| `endsWith` | Suffix match | `"field": "path", "value": ".test.ts"` |
| `matches` | Regex match | `"field": "path", "value": "\\.(ts|js)$"` |

**Regex safety:** Patterns longer than 512 characters or containing ReDoS-prone constructs are rejected.

## Action Types

| Action | Purpose | `target` field |
|--------|---------|---------------|
| `trigger-workflow` | Start a workflow | Workflow name |
| `run-script` | Execute a shell command | Shell command string |
| `notify` | Send a notification | Notification target (e.g., `"agent"`) |
| `log` | Write to log | Log message or target |

## Pre-Shipped Hooks

| Hook | Event | Action | Enabled |
|------|-------|--------|---------|
| `diagnostics-after-write` | `fileEdited` (code files) | `trigger-workflow` → get-diagnostics | Yes |
| `lint-on-save` | `fileEdited` (ts/js files) | `run-script` → npm run lint --fix | Yes |
| `test-on-change` | `fileEdited` (source files) | `run-script` → npm test --related | No |
| `security-scan-on-commit` | `pre-commit` | `run-script` → npm audit --production | No |
| `memory-on-session-end` | `session-end` | `notify` → remind agent to persist learnings | Yes |

---

Next: [MCP Integration](11-mcp-integration.md)
