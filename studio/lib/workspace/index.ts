export type { WorkspaceAdapter, WorkspaceFile } from './types'
export { createBrowserAdapter, pickDirectory, getDirectoryHandle, setDirectoryHandle, buildTreeFromPaths } from './browser-adapter'
export { createIDBAdapter, clearIDBWorkspace, ensureDefaultIDBWorkspace } from './idb-adapter'
export { createOPFSAdapter, clearOPFSWorkspace } from './opfs-adapter'
export { sync, diff, apply, snapshot, type SyncResult, type SyncState, type FileChange } from './sync'

import type { WorkspaceAdapter } from './types'

// ── Default scaffold for new workspaces ──────────────────────────────

export const DEFAULT_AGENTS_MD = `---
type: agents
name: my-workspace
description: My AgentFlow workspace
---

You are an AI assistant operating inside an AgentFlow workspace. When a workflow is active, you follow it step by step. When no workflow is active, you help with whatever the user needs.

## Available Workflows

{{\$workflows}}

## How to Execute

{{\$execution}}

## Directory Structure

{{\$directory}}

## Principles

- Read before you act. Understand the node and prior context first.
- Plan before multi-step work. Outline your approach, especially for code changes.
- Ask when uncertain. A clarifying question beats a wrong assumption.
- One thing at a time. Complete the current step before moving on.

## Safety

- Never skip nodes or jump ahead.
- No destructive actions (file deletion, force push, data drops) without explicit confirmation.
- Stay within the scope defined by the current node.
- If something fails twice, stop and explain what you tried.

## Bundled Resources

{{\$resources}}
`

// ── Active workspace singleton ───────────────────────────────────────

let _adapter: WorkspaceAdapter | null = null
let _initPromise: Promise<WorkspaceAdapter> | null = null

export function setWorkspace(adapter: WorkspaceAdapter) { _adapter = adapter }
export function getWorkspace(): WorkspaceAdapter | null { return _adapter }
export function hasWorkspace(): boolean { return _adapter !== null }

/** Get workspace, auto-initializing OPFS if needed. Use this in all async handlers. */
export async function requireWorkspace(): Promise<WorkspaceAdapter> {
  if (_adapter) return _adapter
  if (typeof window === 'undefined') throw new Error('No workspace')
  if (!_initPromise) {
    _initPromise = (async () => {
      const { createOPFSAdapter } = await import('./opfs-adapter')
      const adapter = createOPFSAdapter()
      await openWorkspace(adapter)
      return adapter
    })()
  }
  return _initPromise
}

// ── Setup ────────────────────────────────────────────────────────────

/** Set adapter as active, scaffold AGENTS.md if missing */
export async function openWorkspace(adapter: WorkspaceAdapter): Promise<void> {
  setWorkspace(adapter)
  if (!(await adapter.exists('AGENTS.md'))) {
    await adapter.write('AGENTS.md', DEFAULT_AGENTS_MD)
  }
}

/** Create a fresh IDB workspace (clears existing) */
export async function freshIDB(): Promise<WorkspaceAdapter> {
  const { clearIDBWorkspace, createIDBAdapter } = await import('./idb-adapter')
  await clearIDBWorkspace()
  return createIDBAdapter()
}

/** List available library workflows (for the workflow dropdown) */
export async function listLibraryWorkflows(): Promise<Array<{ id: string; name: string; description: string; builtin?: boolean }>> {
  try {
    const res = await fetch('/api/library')
    if (!res.ok) return []
    const { entries = [] } = await res.json()
    return entries
      .filter((e: any) => e.type === 'workflow')
      .map((e: any) => ({
        id: e.name,
        name: e.name.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        description: e.description || '',
        builtin: e.builtin || false,
      }))
  } catch { return [] }
}
