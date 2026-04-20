/**
 * Unified Search — combines local library search with MCP registry search.
 *
 * @module mcp/unified-search
 */

const library = require('../library');
const registryClient = require('@agentflow/core/mcp/registry-client');

/**
 * Search both the local library and the MCP registry, returning
 * combined results annotated with their source.
 *
 * @param {object} registry  - LibraryRegistry object for local search
 * @param {string} query     - Search query string
 * @param {object} [opts={}] - Options
 * @param {boolean} [opts.localOnly]  - Skip MCP registry, only return local results
 * @param {boolean} [opts.mcpOnly]    - Skip local library, only return MCP results
 * @param {number}  [opts.mcpLimit]   - Limit for MCP registry results (default 10)
 * @returns {Promise<object[]>} Combined results with `source` annotation
 */
async function unifiedSearch(registry, query, opts = {}) {
  const results = [];

  // Local library results
  if (!opts.mcpOnly) {
    const local = library.search(registry, query);
    results.push(...local.map(r => ({ source: 'local', ...r })));
  }

  // MCP registry results
  if (!opts.localOnly) {
    try {
      const result = await registryClient.searchRegistry(query, { limit: opts.mcpLimit || 10 });
      results.push(...result.entries.map(r => ({
        source: 'mcp',
        type: 'server',
        name: r.name,
        description: r.description,
        packages: r.packages,
        remotes: r.remotes,
      })));
    } catch (err) {
      // When mcpOnly, re-throw — no partial results
      if (opts.mcpOnly) {
        throw err;
      }
      // Otherwise graceful degradation — return local results only
    }
  }

  return results;
}

module.exports = { unifiedSearch };
