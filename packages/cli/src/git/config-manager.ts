/**
 * Git ConfigManager.
 */

import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

export const DEFAULT_CONFIG_FILENAME = '.gitconfig.yaml'
export const DEFAULT_AGENTFLOW_DIR = '.agentflow'

export const VALID_CONFLICT_STRATEGIES = ['local_wins', 'remote_wins', 'manual', 'timestamp'] as const
export const VALID_SYNC_DIRECTIONS = ['bidirectional', 'push_only', 'pull_only'] as const
export const VALID_REPO_TYPES = ['public', 'private', 'custom'] as const
export const VALID_ROLES = ['primary', 'agentic', 'shared'] as const

interface SyncRules {
  include: string[]
  exclude: string[]
  resourceTypes: string[]
  syncDirection: string
}

interface RepoMapping {
  name: string
  url: string
  branch: string
  localPath: string
  repoType?: string
  role?: string
  agentflowPath?: string
}

export interface GitSyncConfig {
  version: string
  repos: RepoMapping[]
  syncRules: SyncRules
  conflictStrategy: string
  autoScan: boolean
  scanDepth: number
}

export function getDefaults(): GitSyncConfig {
  return {
    version: '1.0.0',
    repos: [],
    syncRules: {
      include: ['**/*.md', '**/*.yaml'],
      exclude: ['**/output/**', '**/node_modules/**'],
      resourceTypes: [],
      syncDirection: 'bidirectional',
    },
    conflictStrategy: 'manual',
    autoScan: true,
    scanDepth: 5,
  }
}

export function hasPathTraversal(pattern: string): boolean {
  return pattern.includes('../')
}

export function validateGlobPatterns(syncRules: SyncRules): void {
  if (!syncRules) return
  const allPatterns = [...(syncRules.include || []), ...(syncRules.exclude || [])]
  for (const pattern of allPatterns) {
    if (hasPathTraversal(pattern)) {
      throw new Error(`Invalid glob pattern "${pattern}": path traversal ("../") is not allowed`)
    }
  }
}

export function validateRepoUniqueness(repos: RepoMapping[]): void {
  if (!repos?.length) return
  const seen = new Set<string>()
  for (const repo of repos) {
    if (!repo.name) continue
    if (seen.has(repo.name)) throw new Error(`Duplicate repo mapping name "${repo.name}"`)
    seen.add(repo.name)
  }
}

export function validate(config: GitSyncConfig): void {
  if (!config || typeof config !== 'object') throw new Error('Config must be a non-null object')

  if (config.conflictStrategy && !(VALID_CONFLICT_STRATEGIES as readonly string[]).includes(config.conflictStrategy)) {
    throw new Error(
      `Invalid conflictStrategy "${config.conflictStrategy}". Must be one of: ${VALID_CONFLICT_STRATEGIES.join(', ')}`,
    )
  }

  if (config.syncRules) {
    if (
      config.syncRules.syncDirection &&
      !(VALID_SYNC_DIRECTIONS as readonly string[]).includes(config.syncRules.syncDirection)
    ) {
      throw new Error(
        `Invalid syncDirection "${config.syncRules.syncDirection}". Must be one of: ${VALID_SYNC_DIRECTIONS.join(', ')}`,
      )
    }
    validateGlobPatterns(config.syncRules)
  }

  if (config.repos) {
    validateRepoUniqueness(config.repos)
    for (const repo of config.repos) {
      if (repo.repoType && !(VALID_REPO_TYPES as readonly string[]).includes(repo.repoType)) {
        throw new Error(`Invalid repoType "${repo.repoType}" for repo "${repo.name}"`)
      }
      if (repo.role && !(VALID_ROLES as readonly string[]).includes(repo.role)) {
        throw new Error(`Invalid role "${repo.role}" for repo "${repo.name}"`)
      }
    }
  }
}

function resolveConfigPath(configPath?: string): string {
  return configPath || path.join(DEFAULT_AGENTFLOW_DIR, DEFAULT_CONFIG_FILENAME)
}

export function loadOrCreate(configPath?: string): GitSyncConfig {
  const resolved = resolveConfigPath(configPath)
  if (!fs.existsSync(resolved)) return getDefaults()

  const raw = fs.readFileSync(resolved, 'utf-8')
  let parsed: Record<string, unknown>
  try {
    parsed = yaml.load(raw) as Record<string, unknown>
  } catch (err: unknown) {
    throw new Error(`Failed to parse config at "${resolved}": ${(err as Error).message}`)
  }

  if (!parsed || typeof parsed !== 'object') return getDefaults()

  const defaults = getDefaults()
  const config: GitSyncConfig = {
    version: (parsed.version as string) || defaults.version,
    repos: Array.isArray(parsed.repos) ? parsed.repos : defaults.repos,
    syncRules: { ...defaults.syncRules, ...((parsed.syncRules as Partial<SyncRules>) || {}) },
    conflictStrategy: (parsed.conflictStrategy as string) || defaults.conflictStrategy,
    autoScan: parsed.autoScan !== undefined ? (parsed.autoScan as boolean) : defaults.autoScan,
    scanDepth: parsed.scanDepth !== undefined ? (parsed.scanDepth as number) : defaults.scanDepth,
  }

  validate(config)
  return config
}

export function save(config: GitSyncConfig, configPath?: string): void {
  validate(config)
  const resolved = resolveConfigPath(configPath)
  const dir = path.dirname(resolved)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(resolved, yaml.dump(config, { indent: 2, lineWidth: -1, noRefs: true, sortKeys: false }), 'utf-8')
}
