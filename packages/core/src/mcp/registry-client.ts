/**
 * MCP Registry Client — HTTP client for the official MCP registry.
 *
 * Queries `registry.modelcontextprotocol.io/v0.1/servers` for server metadata.
 * Used at authoring time to search for and retrieve MCP server information.
 */

export const REGISTRY_BASE_URL = 'https://registry.modelcontextprotocol.io/v0.1/servers';

interface EnvironmentVariable {
  name: string;
  description: string;
  isRequired: boolean;
  isSecret: boolean;
  format: string;
  defaultValue?: string;
}

interface PackageEntry {
  registryType: string;
  identifier: string;
  transport: unknown;
  environmentVariables?: Array<{
    name?: string;
    description?: string;
    isRequired?: boolean;
    isSecret?: boolean;
    format?: string;
  }>;
}

interface RemoteEntry {
  type: string;
  url: string;
  headers?: Array<{
    name?: string;
    description?: string;
    isRequired?: boolean;
    isSecret?: boolean;
    value?: string;
  }>;
}

export interface McpRegistryEntry {
  name: string;
  description: string;
  version: string | undefined;
  packages: PackageEntry[];
  remotes: RemoteEntry[];
  repository: string | null;
  websiteUrl: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  isLatest: boolean;
  environmentVariables: EnvironmentVariable[];
}

interface SearchOptions {
  limit?: number;
  cursor?: string;
  updatedSince?: string;
}

interface SearchResult {
  entries: McpRegistryEntry[];
  nextCursor: string | null;
  count: number;
}

/**
 * Parses a raw registry API response entry into a McpRegistryEntry.
 */
export function parseEntry(entry: Record<string, unknown>): McpRegistryEntry {
  const s = (entry.server || entry) as Record<string, unknown>;
  const meta = (entry._meta || {}) as Record<string, Record<string, unknown>>;
  const officialMeta = meta['io.modelcontextprotocol.registry/official'] || {};

  // Extract environment variables from packages
  const envVars: EnvironmentVariable[] = [];
  for (const pkg of ((s.packages || []) as PackageEntry[])) {
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
  for (const remote of ((s.remotes || []) as RemoteEntry[])) {
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
    name: (s.name as string) || '',
    description: (s.description as string) || '',
    version: (s.version as string) || undefined,
    packages: Array.isArray(s.packages) ? s.packages : [],
    remotes: Array.isArray(s.remotes) ? s.remotes : [],
    repository: (s.repository as string) || null,
    websiteUrl: (s.websiteUrl as string) || null,
    publishedAt: (officialMeta.publishedAt as string) || null,
    updatedAt: (officialMeta.updatedAt as string) || null,
    isLatest: (officialMeta.isLatest as boolean) || false,
    environmentVariables: envVars,
  };
}

/**
 * Searches the official MCP registry for servers matching a query.
 */
export async function searchRegistry(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
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

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (err: unknown) {
    throw new Error(`MCP registry is unreachable: ${(err as Error).message}`);
  }

  if (!response.ok) {
    throw new Error(
      `MCP registry returned HTTP ${response.status}: ${response.statusText}`
    );
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json() as Record<string, unknown>;
  } catch (err: unknown) {
    throw new Error(`Failed to parse MCP registry response: ${(err as Error).message}`);
  }

  const servers = Array.isArray(data.servers) ? data.servers : [];
  const entries = servers.map(parseEntry);
  const metadata = (data.metadata || {}) as Record<string, unknown>;

  return {
    entries,
    nextCursor: (metadata.nextCursor as string) || null,
    count: (metadata.count as number) || entries.length,
  };
}

/**
 * Retrieves a specific server from the MCP registry by name.
 */
export async function getServer(serverName: string): Promise<McpRegistryEntry | null> {
  const url = `${REGISTRY_BASE_URL}/${encodeURIComponent(serverName)}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err: unknown) {
    throw new Error(`MCP registry is unreachable: ${(err as Error).message}`);
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `MCP registry returned HTTP ${response.status}: ${response.statusText}`
    );
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json() as Record<string, unknown>;
  } catch (err: unknown) {
    throw new Error(`Failed to parse MCP registry response: ${(err as Error).message}`);
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
