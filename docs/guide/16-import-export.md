---
name: import-export
scope: workflow
description: "Part 16: Import, export & sharing — formats, import sources, validation, dry run"
tags:
  - guide
  - import
  - export
  - sharing
  - zip
  - json
---

# Part 16 — Import, Export & Sharing

AgentFlow supports multiple formats for sharing workspaces.

## Export Formats

| Format | Output | Use case |
|--------|--------|----------|
| `json` | JSON bundle with all files + graph metadata | Programmatic consumption |
| `zip` | ZIP archive of all workspace files | File sharing |
| `dir` | Copy files to a target directory | Local duplication |
| `share` | Compact JSON for URL sharing | Quick sharing |

### JSON Export Bundle Structure

```json
{
  "version": "1.0.0",
  "exportedAt": "2026-03-25T12:00:00.000Z",
  "source": {
    "name": "my-workspace",
    "agentflowVersion": "2.0.0"
  },
  "files": {
    "AGENTS.md": "---\ntype: agents\n...",
    "capabilities/read-code.md": "---\nname: read-code\n...",
    "build-feature/AGENTS.md": "..."
  },
  "graph": {
    "workflows": { },
    "resources": { }
  }
}
```

Exports automatically exclude `node_modules/`, `.git/`, and `output/` directories.

You can export a single workflow by specifying `workflowId` — this includes the workflow's files plus all shared resources (capabilities, instructions, etc.).

## Import Sources

| Source | Input |
|--------|-------|
| ZIP file | ZIP buffer |
| URL | URL to a shareable JSON |
| Clipboard | JSON string |
| Library | Library item type and name |

### Import Validation

Before writing files, imports are validated:
- No path traversal (`..` in paths)
- No absolute paths
- Warns if no `AGENTS.md` found
- Warns on invalid frontmatter
- Warns on large files (>10KB)

### Dry Run

All import methods support `dryRun: true` — returns what would be written without actually writing.

## Library Imports

Copy pre-built resources from the library into your workspace:

```bash
agentflow add skill systematic-debugging
agentflow add tool run-tests
agentflow add template is-approved
```

Library items are templates — customize them after copying.

---

Next: [Complete Worked Example](17-worked-example.md)
