/**
 * Unified Search.
 */

import { search } from '../library'
import registryClient from '@agentflow/core/mcp/registry-client'

interface LibraryRegistry {
  version: string
  entries: { name: string, type: string, path: string, description: string, tags: string[] }[]
  _libraryDir?: string
}

interface SearchResult {
  source: string
  type?: string
  name: string
  description?: string
  path?: string
  tags?: string[]
  packages?: unknown[]
  remotes?: unknown[]
}

interface SearchOptions {
  localOnly?: boolean
  mcpOnly?: boolean
  mcpLimit?: number
}

export async function unifiedSearch(
  registry: LibraryRegistry,
  query: string,
  opts: SearchOptions = {},
): Promise<SearchResult[]> {
  const results: SearchResult[] = []

  if (!opts.mcpOnly) {
    const local = search(registry, query)
    results.push(...local.map(r => ({ source: 'local' as const, ...r })))
  }

  if (!opts.localOnly) {
    try {
      const result = await registryClient.searchRegistry(query, { limit: opts.mcpLimit || 10 })
      results.push(...result.entries.map((r: { name: string, description?: string, packages?: unknown[], remotes?: unknown[] }) => ({
        source: 'mcp' as const,
        type: 'server',
        name: r.name,
        description: r.description,
        packages: r.packages,
        remotes: r.remotes,
      })))
    } catch (err) {
      if (opts.mcpOnly) throw err
    }
  }

  return results
}
