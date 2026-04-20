const {
  searchRegistry,
  getServer,
  parseEntry,
  REGISTRY_BASE_URL,
} = require('../../packages/core/src/mcp/registry-client');

/* ------------------------------------------------------------------ */
/*  Mock fetch                                                         */
/* ------------------------------------------------------------------ */

const originalFetch = globalThis.fetch;

function mockFetch(handler) {
  globalThis.fetch = handler;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeRegistryResponse(servers) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ servers, metadata: { count: servers.length, nextCursor: null } }),
  };
}

function makeServerEntry(overrides = {}) {
  return {
    server: {
      name: 'io.github.modelcontextprotocol/github',
      description: 'GitHub API integration',
      version: '2025.11.28',
      packages: [{
        registryType: 'npm',
        identifier: '@modelcontextprotocol/server-github',
        transport: { type: 'stdio' },
      }],
      remotes: [{
        type: 'streamable-http',
        url: 'https://github.example.com/mcp',
        headers: [],
      }],
      ...overrides,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  parseEntry                                                         */
/* ------------------------------------------------------------------ */

describe('parseEntry', () => {
  it('extracts name, description, version, packages, and remotes from a server entry', () => {
    const raw = makeServerEntry();
    const entry = parseEntry(raw);

    expect(entry.name).toBe('io.github.modelcontextprotocol/github');
    expect(entry.description).toBe('GitHub API integration');
    expect(entry.version).toBe('2025.11.28');
    expect(entry.packages).toHaveLength(1);
    expect(entry.packages[0].registryType).toBe('npm');
    expect(entry.remotes).toHaveLength(1);
    expect(entry.remotes[0].type).toBe('streamable-http');
  });

  it('defaults missing fields gracefully', () => {
    const entry = parseEntry({ server: {} });

    expect(entry.name).toBe('');
    expect(entry.description).toBe('');
    expect(entry.version).toBeUndefined();
    expect(entry.packages).toEqual([]);
    expect(entry.remotes).toEqual([]);
  });

  it('handles entry without server wrapper', () => {
    const entry = parseEntry({
      name: 'direct-server',
      description: 'Direct entry',
      packages: [],
      remotes: [],
    });

    expect(entry.name).toBe('direct-server');
    expect(entry.description).toBe('Direct entry');
  });
});

/* ------------------------------------------------------------------ */
/*  searchRegistry                                                     */
/* ------------------------------------------------------------------ */

describe('searchRegistry', () => {
  it('sends HTTP GET with search parameter', async () => {
    let capturedUrl;
    mockFetch(async (url) => {
      capturedUrl = url;
      return makeRegistryResponse([]);
    });

    await searchRegistry('github');

    expect(capturedUrl).toContain(REGISTRY_BASE_URL);
    expect(capturedUrl).toContain('search=github');
  });

  it('returns parsed McpRegistryEntry objects', async () => {
    mockFetch(async () => makeRegistryResponse([
      makeServerEntry(),
      makeServerEntry({
        name: 'io.example/analytics',
        description: 'Analytics server',
        packages: [],
        remotes: [{ type: 'sse', url: 'https://analytics.example.com' }],
      }),
    ]));

    const result = await searchRegistry('test');

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].name).toBe('io.github.modelcontextprotocol/github');
    expect(result.entries[0].description).toBe('GitHub API integration');
    expect(result.entries[0].packages).toHaveLength(1);
    expect(result.entries[0].remotes).toHaveLength(1);
    expect(result.entries[1].name).toBe('io.example/analytics');
  });

  it('passes limit as query parameter', async () => {
    let capturedUrl;
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeServerEntry({ name: `server-${i}`, description: `Server ${i}` })
    );
    mockFetch(async (url) => { capturedUrl = url; return makeRegistryResponse(entries); });

    const result = await searchRegistry('test', { limit: 3 });

    expect(capturedUrl).toContain('limit=3');
    expect(result.entries).toHaveLength(10);
  });

  it('returns all results when limit is not set', async () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeServerEntry({ name: `server-${i}` })
    );
    mockFetch(async () => makeRegistryResponse(entries));

    const result = await searchRegistry('test');

    expect(result.entries).toHaveLength(5);
  });

  it('throws descriptive error when registry is unreachable', async () => {
    mockFetch(async () => { throw new Error('ECONNREFUSED'); });

    await expect(searchRegistry('test')).rejects.toThrow(
      /MCP registry is unreachable.*ECONNREFUSED/
    );
  });

  it('throws error on non-OK HTTP status', async () => {
    mockFetch(async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }));

    await expect(searchRegistry('test')).rejects.toThrow(
      /MCP registry returned HTTP 500/
    );
  });

  it('throws error when response is not valid JSON', async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token'); },
    }));

    await expect(searchRegistry('test')).rejects.toThrow(
      /Failed to parse MCP registry response/
    );
  });

  it('handles empty servers array', async () => {
    mockFetch(async () => makeRegistryResponse([]));

    const result = await searchRegistry('nonexistent');

    expect(result.entries).toEqual([]);
  });

  it('handles response with missing servers key', async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));

    const result = await searchRegistry('test');

    expect(result.entries).toEqual([]);
  });

  it('sends request without search param when query is empty', async () => {
    let capturedUrl;
    mockFetch(async (url) => {
      capturedUrl = url;
      return makeRegistryResponse([]);
    });

    await searchRegistry('');

    expect(capturedUrl).toBe(REGISTRY_BASE_URL);
  });
});

/* ------------------------------------------------------------------ */
/*  getServer                                                          */
/* ------------------------------------------------------------------ */

describe('getServer', () => {
  it('fetches a specific server by name', async () => {
    let capturedUrl;
    mockFetch(async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => makeServerEntry(),
      };
    });

    const result = await getServer('io.github.modelcontextprotocol/github');

    expect(capturedUrl).toContain(REGISTRY_BASE_URL);
    expect(capturedUrl).toContain(encodeURIComponent('io.github.modelcontextprotocol/github'));
    expect(result).not.toBeNull();
    expect(result.name).toBe('io.github.modelcontextprotocol/github');
  });

  it('returns null when server is not found (404)', async () => {
    mockFetch(async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }));

    const result = await getServer('nonexistent/server');

    expect(result).toBeNull();
  });

  it('throws error when registry is unreachable', async () => {
    mockFetch(async () => { throw new Error('ENOTFOUND'); });

    await expect(getServer('some/server')).rejects.toThrow(
      /MCP registry is unreachable.*ENOTFOUND/
    );
  });

  it('throws error on non-404 error status', async () => {
    mockFetch(async () => ({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    }));

    await expect(getServer('some/server')).rejects.toThrow(
      /MCP registry returned HTTP 503/
    );
  });

  it('parses response with server wrapper', async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => makeServerEntry({
        name: 'io.example/test',
        description: 'Test server',
      }),
    }));

    const result = await getServer('io.example/test');

    expect(result.name).toBe('io.example/test');
    expect(result.description).toBe('Test server');
  });

  it('parses response with servers array wrapper', async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        servers: [makeServerEntry({ name: 'io.example/wrapped' })],
      }),
    }));

    const result = await getServer('io.example/wrapped');

    expect(result.name).toBe('io.example/wrapped');
  });

  it('returns null when response has no recognizable server data', async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ something: 'else' }),
    }));

    const result = await getServer('some/server');

    expect(result).toBeNull();
  });

  it('returns entry with full metadata (packages and remotes)', async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => makeServerEntry(),
    }));

    const result = await getServer('io.github.modelcontextprotocol/github');

    expect(result.packages).toHaveLength(1);
    expect(result.packages[0].registryType).toBe('npm');
    expect(result.packages[0].identifier).toBe('@modelcontextprotocol/server-github');
    expect(result.remotes).toHaveLength(1);
    expect(result.remotes[0].type).toBe('streamable-http');
  });
});
