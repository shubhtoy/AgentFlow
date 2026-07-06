/**
 * Host Target Registry — per-host L0 bootstrap + MCP config knowledge.
 *
 * Scope is deliberately narrow: L2-L4 (node contracts, references, artifacts, memory) are
 * plain on-demand directory-walk and need ZERO per-host knowledge — every host can open a
 * file. Only two things genuinely differ per host:
 *   1. L0 (always-on bootstrap): which file, what format.
 *   2. MCP server config: which file, and whether the host needs an inline mcpServers wrapper.
 *
 * Facts below were verified by running the real `rulesync` CLI (github.com/dyoshikawa/rulesync,
 * MIT, live-tested 2026-07-06) end-to-end for each host and inspecting its output — not
 * guessed. We copy the *facts*, not the dependency: no subprocess coupling, no package
 * dependency on our critical-path export. See docs/DECISIONS.md for the adopt-vs-copy call.
 *
 * Adding a new host = one new registry entry. No branch logic elsewhere should hardcode a
 * host name — always look up this registry.
 */

export type HostId = 'kiro' | 'cursor' | 'claude-code'

export interface HostTarget {
  id: HostId
  label: string

  /** L0: the always-on bootstrap file this host auto-loads. */
  l0: {
    /** Path relative to the export root. */
    path: string
    format: 'markdown'
  }

  /** L1 (MCP server config): where this host's MCP config lives. */
  mcpConfig: {
    /** Path relative to the export root. */
    path: string
    /** All three verified hosts use the same { mcpServers: {...} } shape today. */
    schema: 'mcpServers-json'
  }

  /**
   * The eager/always-on channel this host offers for arbitrary content — L1-L4 must never
   * be placed here (see MASTER-PLAN.md "5-layer context placement"). Used by the export
   * guardrail (#13), not by L0/MCP emission.
   */
  alwaysOnChannel: {
    mechanism: string
    /** Returns true if the given frontmatter would make this file load eagerly. */
    isAlwaysOn: (frontmatter: Record<string, unknown>) => boolean
  }
}

export const HOST_TARGET_REGISTRY: Record<HostId, HostTarget> = {
  kiro: {
    id: 'kiro',
    label: 'Kiro',
    l0: { path: 'AGENTS.md', format: 'markdown' },
    mcpConfig: { path: '.kiro/settings/mcp.json', schema: 'mcpServers-json' },
    alwaysOnChannel: {
      mechanism: 'inclusion: always',
      isAlwaysOn: fm => fm.inclusion === 'always',
    },
  },
  cursor: {
    id: 'cursor',
    label: 'Cursor',
    l0: { path: '.cursor/rules/00-index.mdc', format: 'markdown' },
    mcpConfig: { path: '.cursor/mcp.json', schema: 'mcpServers-json' },
    alwaysOnChannel: {
      mechanism: 'alwaysApply: true',
      isAlwaysOn: fm => fm.alwaysApply === true,
    },
  },
  'claude-code': {
    id: 'claude-code',
    label: 'Claude Code',
    l0: { path: 'CLAUDE.md', format: 'markdown' },
    mcpConfig: { path: '.mcp.json', schema: 'mcpServers-json' },
    alwaysOnChannel: {
      // Claude Code has no per-file frontmatter equivalent to inclusion/alwaysApply; the only
      // eager channel is the root CLAUDE.md itself (or an @import chain rooted there). Content
      // placed outside CLAUDE.md/@import is on-demand by construction, so this always returns
      // false for L1-L4 files (which are never written to that path/chain by the exporter).
      mechanism: 'root CLAUDE.md / @import',
      isAlwaysOn: () => false,
    },
  },
}

export const SUPPORTED_HOST_IDS: HostId[] = Object.keys(HOST_TARGET_REGISTRY) as HostId[]

export function getHostTarget(id: string): HostTarget | null {
  return HOST_TARGET_REGISTRY[id as HostId] || null
}
