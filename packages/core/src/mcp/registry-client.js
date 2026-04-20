/**
 * MCP Registry Client — HTTP client for the official MCP registry.
 *
 * Queries `registry.modelcontextprotocol.io/v0.1/servers` for server metadata.
 * Used at authoring time to search for and retrieve MCP server information.
 */

const REGISTRY_BASE_URL = 'https://registry.modelcontextprotocol.io/v0.1/servers';

/**
 * @typedef {object} McpRegistryEntry
 * @property {string} name — fully qualified server name
 * @property {string} description — human-readable description
 * @property {string} [version] — server version
 * @property {Array<{registryType: string, identifier: string, transport: object}>} packages
 * @property {Array<{type: string, url: string, headers?: object[]}>} remotes
 */

/**
 * Parses a raw registry API response entry into a McpRegistryEntry.
 *
 * @param {object} entry — raw entry from the registry `servers` array
 * @returns {McpRegistryEntry}
 */
function parseEntry(entry) {
  const s = entry.server || entry;
  const meta = entry._meta || {};
  const officialMeta = meta['io.modelcontextprotocol.registry/official'] || {};

  // Extract environment variables from packages
  const envVars = [];
  for (const pkg of (s.packages || [])) {
    for (const ev of (pkg.environmentVariables || [])) {
      envVars.push({
        name: ev.name || '',
        description: ev.description || '',
        isRequired: !!ev.isRequired,
        isSecret: !!ev.isSecret,
        format: ev.format || 'string',
      });
    }
  }

  // Extract required headers from remotes
  for (const remote of (s.remotes || [])) {
    for (const hdr of (remote.headers || [])) {
      envVars.push({
        name: hdr.name || '',
        description: hdr.description || '',
        isRequired: !!hdr.isRequired,
        isSecret: !!hdr.isSecret,
        format: 'header',
        defaultValue: hdr.value || '',
      });
    }
  }

  return {
    name: s.name || '',
    description: s.description || '',
    version: s.version || undefined,
    packages: Array.isArray(s.packages) ? s.packages : [],
    remotes: Array.isArray(s.remotes) ? s.remotes : [],
    repository: s.repository || null,
    websiteUrl: s.websiteUrl || null,
    publishedAt: officialMeta.publishedAt || null,
    updatedAt: officialMeta.updatedAt || null,
    isLatest: officialMeta.isLatest || false,
    environmentVariables: envVars,
  };
}

/**
 * Searches the official MCP registry for servers matching a query.
 *
 * Sends HTTP GET to the registry API with `q=<query>` parameter.
 * Returns an array of McpRegistryEntry objects.
 *
 * @param {string} query — search query string
 * @param {object} [opts={}] — options
 * @param {number} [opts.limit] — maximum number of results to return
 * @returns {Promise<McpRegistryEntry[]>}
 * @throws {Error} when the registry API is unreachable or returns a non-OK status
 */
async function searchRegistry(query, opts = {}) {
  const url = new URL(REGISTRY_BASE_URL);
  if (query) {
    url.searchParams.set('search', query);
  }
  if (opts.limit != null && opts.limit > 0) {
    url.searchParams.set('limit', String(opts.limit));
  }
  if (opts.cursor) {
    url.searchParams.set('cursor', opts.cursor);
  }
  if (opts.updatedSince) {
    url.searchParams.set('updated_since', opts.updatedSince);
  }

  let response;
  try {
    response = await fetch(url.toString());
  } catch (err) {
    throw new Error(`MCP registry is unreachable: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(
      `MCP registry returned HTTP ${response.status}: ${response.statusText}`
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error(`Failed to parse MCP registry response: ${err.message}`);
  }

  const servers = Array.isArray(data.servers) ? data.servers : [];
  const entries = servers.map(parseEntry);
  const metadata = data.metadata || {};

  return {
    entries,
    nextCursor: metadata.nextCursor || null,
    count: metadata.count || entries.length,
  };
}

/**
 * Retrieves a specific server from the MCP registry by name.
 *
 * @param {string} serverName — fully qualified server name
 * @returns {Promise<McpRegistryEntry|null>} the server entry, or null if not found
 * @throws {Error} when the registry API is unreachable
 */
async function getServer(serverName) {
  const url = `${REGISTRY_BASE_URL}/${encodeURIComponent(serverName)}`;

  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`MCP registry is unreachable: ${err.message}`);
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `MCP registry returned HTTP ${response.status}: ${response.statusText}`
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error(`Failed to parse MCP registry response: ${err.message}`);
  }

  // The response for a single server may be wrapped in a servers array or be the entry directly
  if (data.server) {
    return parseEntry(data);
  }
  if (Array.isArray(data.servers) && data.servers.length > 0) {
    return parseEntry(data.servers[0]);
  }

  return null;
}

module.exports = {
  searchRegistry,
  getServer,
  parseEntry,
  REGISTRY_BASE_URL,
};
