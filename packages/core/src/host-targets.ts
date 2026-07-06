/**
 * Host Target Registry — per-host L0 bootstrap + MCP config knowledge.
 *
 * Scope is deliberately narrow: L2-L4 (node contracts, references, artifacts, memory) are
 * plain on-demand directory-walk and need ZERO per-host knowledge — every host can open a
 * file. Only two things genuinely differ per host:
 *   1. L0 (always-on bootstrap): which file, what format, and how "always-on" is detected.
 *   2. MCP server config: which file, and whether the host needs an inline mcpServers wrapper.
 *
 * Facts + always-on semantics below are PORTED from `rulesync` (github.com/dyoshikawa/rulesync,
 * MIT license, commit 08834fd107c270167b4970a033f2ec303b24d9b8, verified 2026-07-06) — its own
 * per-host rule/MCP generator source, not guessed or reverse-engineered from CLI output alone.
 * We copy the verified facts, not the runtime dependency: no subprocess coupling on our
 * critical-path export. See docs/DECISIONS.md for the adopt-vs-copy rationale (#18) and #59
 * for the porting task this file resolves.
 *
 * Adding a new host = one new registry entry, sourced the same way (read rulesync's
 * `src/constants/<host>-paths.ts` + `src/features/rules/<host>-rule.ts` +
 * `src/features/mcp/<host>-mcp.ts`, cite what was ported). No branch logic elsewhere should
 * hardcode a host name — always look up this registry.
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
    /**
     * Returns true if the given file (frontmatter + whether it IS the L0 root file) would
     * load eagerly on this host. `frontmatter` is the parsed YAML frontmatter of a candidate
     * L1-L4 file; `isRootFile` is true only for the file at `l0.path` itself.
     */
    isAlwaysOn: (frontmatter: Record<string, unknown>, isRootFile?: boolean) => boolean
  }
}

export const HOST_TARGET_REGISTRY: Record<HostId, HostTarget> = {
  kiro: {
    id: 'kiro',
    label: 'Kiro',
    l0: { path: 'AGENTS.md', format: 'markdown' },
    mcpConfig: { path: '.kiro/settings/mcp.json', schema: 'mcpServers-json' },
    alwaysOnChannel: {
      mechanism: 'inclusion: always (the default when no frontmatter block is present)',
      // Ported from rulesync `src/features/rules/kiro-rule.ts` (`deriveKiroInclusion`):
      // Kiro's steering docs (`.kiro/steering/*.md`) default to `always` when a file carries
      // NO `inclusion` frontmatter at all — `always` is never written explicitly, it's the
      // absence of the block. An explicit `inclusion: "always"` is equally eager if present.
      // `fileMatch` and `manual` are the two on-demand modes. Our exporter never writes
      // steering-style frontmatter to L1-L4 files (they're plain walkable-dir files), so this
      // predicate exists to guard against that ever being introduced (e.g. by future native-
      // selector emission) rather than to fire on today's output.
      isAlwaysOn: fm => {
        if (isRootExempt(fm)) return false
        const inclusion = fm.inclusion
        if (inclusion === undefined) return true // absent block = eager, Kiro's real default
        return inclusion === 'always'
      },
    },
  },
  cursor: {
    id: 'cursor',
    label: 'Cursor',
    l0: { path: '.cursor/rules/00-index.mdc', format: 'markdown' },
    mcpConfig: { path: '.cursor/mcp.json', schema: 'mcpServers-json' },
    alwaysOnChannel: {
      mechanism: 'alwaysApply: true (explicit boolean; absent/false is on-demand)',
      // Ported from rulesync `src/features/rules/cursor-rule.ts`: unlike Kiro, Cursor's
      // eagerness is an explicit boolean flag — `alwaysApply: true` written, or omitted/false
      // for on-demand. No "absence means eager" trap here.
      isAlwaysOn: fm => fm.alwaysApply === true,
    },
  },
  'claude-code': {
    id: 'claude-code',
    label: 'Claude Code',
    l0: { path: 'CLAUDE.md', format: 'markdown' },
    mcpConfig: { path: '.mcp.json', schema: 'mcpServers-json' },
    alwaysOnChannel: {
      mechanism: 'root CLAUDE.md (positional, not a frontmatter flag)',
      // Ported from rulesync `src/features/rules/claudecode-rule.ts`: eagerness is POSITIONAL,
      // not a frontmatter key. The root rule (root: true -> project-root CLAUDE.md, or an
      // alternate root) is always-loaded; every non-root modular rule under `.claude/rules/*.md`
      // is on-demand by construction, regardless of its frontmatter. So this predicate is
      // driven by `isRootFile`, not by any key inside `frontmatter` -- there is no boolean or
      // sentinel value inside a Claude Code rule file that means "always-on".
      isAlwaysOn: (_fm, isRootFile = false) => isRootFile,
    },
  },
}

/**
 * Shared escape hatch: a file can declare `inclusion`/`alwaysOn` metadata that explicitly
 * marks it as exempt from a host's eager-channel default (used by no host today, reserved
 * for #13's guardrail to attach an override if a legitimate on-demand file needs to disable
 * an inherited default). Currently always false; kept as a single seam so hosts don't each
 * need their own escape-hatch key added ad hoc later.
 */
function isRootExempt(_frontmatter: Record<string, unknown>): boolean {
  return false
}

export const SUPPORTED_HOST_IDS: HostId[] = Object.keys(HOST_TARGET_REGISTRY) as HostId[]

export function getHostTarget(id: string): HostTarget | null {
  return HOST_TARGET_REGISTRY[id as HostId] || null
}
