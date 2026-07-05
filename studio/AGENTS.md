# studio — Visual workflow editor (Next.js + ReactFlow)

Browser app. Imports parsing/validation logic from `packages/core` (never re-implements it —
see root `AGENTS.md`'s DRY rule). API routes under `app/api/` wrap `packages/cli` services for
server-side fs/git/MCP operations the browser can't do directly.

## Files

| Path | What |
|---|---|
| `components/Canvas.tsx` | ReactFlow graph canvas — node/edge rendering, drag/connect |
| `components/NodeCard.tsx`, `NodeDetail.tsx`, `NodeFocusModal.tsx` | Node display + editing surfaces |
| `components/Editor.tsx`, `MarkdownPreview.tsx` | Markdown editing (Tiptap-based) |
| `components/ExportDialog.tsx` | UI for `exportForPlatform` (packages/cli) |
| `components/ValidationPanel.tsx` | Renders `validate()` (packages/core) results |
| `components/MCPPanel.tsx`, `McpConnectionBadge.tsx` | MCP server config UI |
| `components/copilot/`, `lib/copilot/` | AI chat/copilot integration |
| `app/api/` | Server routes wrapping `packages/cli` services (fs, git, MCP, export) |
| `lib/types.ts` | Studio-local UI types — do not redefine `ParsedGraph`/`Ref`/etc., import from core |
| `lib/api.ts` | Client-side fetch wrappers for `app/api/` routes |
| `store.ts`, `store/` | App state |

## Rules specific to this directory

- `lib/types.ts` currently has a stale `nodeType: 'router'` path that the parser never emits
  (parser only emits `step`/`sub-workflow` + an `isRouter` flag) — treat any `'router'` branch
  in `Canvas.tsx`/`NodeCard.tsx`/`NodeFocusModal.tsx` as dead code, not a spec to follow
  (tracked: Epic 7, #34).
- New UI state derived from the graph should read from `packages/core` types, not invent a
  parallel shape.
