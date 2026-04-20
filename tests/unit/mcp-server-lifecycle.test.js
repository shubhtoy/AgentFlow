/**
 * Tests for MCP Server Lifecycle — discoverTools()
 *
 * Uses dependency injection via opts._deps to mock SDK classes,
 * avoiding module-level mocking issues with the MCP SDK.
 */

const { discoverTools, DEFAULT_TIMEOUT } = require('../../src/mcp/server-lifecycle');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeMockClient(overrides = {}) {
  return {
    connect: overrides.connect || vi.fn().mockResolvedValue(undefined),
    listTools: overrides.listTools || vi.fn().mockResolvedValue({ tools: [] }),
    close: overrides.close || vi.fn().mockResolvedValue(undefined),
  };
}

function makeMockDeps(overrides = {}) {
  const client = overrides.client || makeMockClient(overrides);
  return {
    createClient: overrides.createClient || vi.fn().mockReturnValue(client),
    createStdioTransport: overrides.createStdioTransport || vi.fn().mockReturnValue({ type: 'stdio-mock' }),
    createHTTPTransport: overrides.createHTTPTransport || vi.fn().mockReturnValue({ type: 'http-mock' }),
    resolveEnv: overrides.resolveEnv || vi.fn((env) => {
      if (!env || typeof env !== 'object') return {};
      const resolved = {};
      for (const [key, value] of Object.entries(env)) {
        const match = typeof value === 'string' && value.match(/^\$\{env:([^}]+)\}$/);
        resolved[key] = match ? (process.env[match[1]] ?? '') : value;
      }
      return resolved;
    }),
    _client: client,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests: stdio transport                                             */
/* ------------------------------------------------------------------ */

describe('discoverTools — stdio transport', () => {
  it('creates stdio transport when command is present', async () => {
    const deps = makeMockDeps();
    const entry = { command: 'npx', args: ['-y', '@mcp/server-test'], env: {} };

    await discoverTools(entry, { _deps: deps });

    expect(deps.createStdioTransport).toHaveBeenCalledTimes(1);
    const callArgs = deps.createStdioTransport.mock.calls[0][0];
    expect(callArgs.command).toBe('npx');
    expect(callArgs.args).toEqual(['-y', '@mcp/server-test']);
  });

  it('passes resolved env merged with process.env to stdio transport', async () => {
    const deps = makeMockDeps();
    const entry = { command: 'node', args: ['server.js'], env: { API_KEY: 'literal-key' } };

    await discoverTools(entry, { _deps: deps });

    const callArgs = deps.createStdioTransport.mock.calls[0][0];
    expect(callArgs.env).toEqual(expect.objectContaining({ API_KEY: 'literal-key' }));
    expect(callArgs.env.PATH).toBeDefined();
  });

  it('defaults args to empty array when not provided', async () => {
    const deps = makeMockDeps();

    await discoverTools({ command: 'my-server' }, { _deps: deps });

    const callArgs = deps.createStdioTransport.mock.calls[0][0];
    expect(callArgs.args).toEqual([]);
  });

  it('returns tools from tools/list response', async () => {
    const tools = [
      { name: 'create_issue', description: 'Create an issue', inputSchema: { type: 'object' } },
      { name: 'list_issues', description: 'List issues', inputSchema: { type: 'object' } },
    ];
    const deps = makeMockDeps({ listTools: vi.fn().mockResolvedValue({ tools }) });

    const result = await discoverTools({ command: 'npx', args: ['server'] }, { _deps: deps });

    expect(result).toEqual(tools);
    expect(result).toHaveLength(2);
  });

  it('returns empty array when tools/list returns no tools key', async () => {
    const deps = makeMockDeps({ listTools: vi.fn().mockResolvedValue({}) });

    const result = await discoverTools({ command: 'npx', args: ['server'] }, { _deps: deps });

    expect(result).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: HTTP/SSE transport                                          */
/* ------------------------------------------------------------------ */

describe('discoverTools — HTTP/SSE transport', () => {
  it('creates HTTP transport when url is present', async () => {
    const deps = makeMockDeps();
    const entry = { url: 'https://example.com/mcp' };

    await discoverTools(entry, { _deps: deps });

    expect(deps.createHTTPTransport).toHaveBeenCalledTimes(1);
    const urlArg = deps.createHTTPTransport.mock.calls[0][0];
    expect(urlArg.toString()).toBe('https://example.com/mcp');
  });

  it('prefers stdio over HTTP when both command and url are present', async () => {
    const deps = makeMockDeps();
    const entry = { command: 'npx', args: ['server'], url: 'https://example.com/mcp' };

    await discoverTools(entry, { _deps: deps });

    expect(deps.createStdioTransport).toHaveBeenCalledTimes(1);
    expect(deps.createHTTPTransport).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: error handling                                              */
/* ------------------------------------------------------------------ */

describe('discoverTools — error handling', () => {
  it('throws when server entry has neither command nor url', async () => {
    const deps = makeMockDeps();

    await expect(discoverTools({ env: {} }, { _deps: deps })).rejects.toThrow(
      /must have either "command".*or "url"/
    );
  });

  it('always calls client.close even when tools/list fails', async () => {
    const closeFn = vi.fn().mockResolvedValue(undefined);
    const deps = makeMockDeps({
      listTools: vi.fn().mockRejectedValue(new Error('tools/list failed')),
      close: closeFn,
    });

    await expect(
      discoverTools({ command: 'npx', args: ['server'] }, { _deps: deps })
    ).rejects.toThrow('tools/list failed');

    expect(closeFn).toHaveBeenCalledTimes(1);
  });

  it('always calls client.close even when connect fails', async () => {
    const closeFn = vi.fn().mockResolvedValue(undefined);
    const deps = makeMockDeps({
      connect: vi.fn().mockRejectedValue(new Error('connection refused')),
      close: closeFn,
    });

    await expect(
      discoverTools({ command: 'npx', args: ['server'] }, { _deps: deps })
    ).rejects.toThrow('connection refused');

    expect(closeFn).toHaveBeenCalledTimes(1);
  });

  it('does not throw cleanup error if client.close itself fails', async () => {
    const deps = makeMockDeps({
      listTools: vi.fn().mockRejectedValue(new Error('original error')),
      close: vi.fn().mockRejectedValue(new Error('close failed')),
    });

    await expect(
      discoverTools({ command: 'npx', args: ['server'] }, { _deps: deps })
    ).rejects.toThrow('original error');
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: timeout                                                     */
/* ------------------------------------------------------------------ */

describe('discoverTools — timeout', () => {
  it('exports default timeout of 30000ms', () => {
    expect(DEFAULT_TIMEOUT).toBe(30000);
  });

  it('rejects with timeout error when connection takes too long', async () => {
    const closeFn = vi.fn().mockResolvedValue(undefined);
    const deps = makeMockDeps({
      connect: vi.fn().mockImplementation(() => new Promise(() => {})), // never resolves
      close: closeFn,
    });

    await expect(
      discoverTools({ command: 'npx', args: ['server'] }, { timeout: 50, _deps: deps })
    ).rejects.toThrow(/timed out after 50ms/i);

    expect(closeFn).toHaveBeenCalledTimes(1);
  });

  it('succeeds when connection completes before timeout', async () => {
    const deps = makeMockDeps({
      listTools: vi.fn().mockResolvedValue({ tools: [{ name: 'test-tool' }] }),
    });

    const result = await discoverTools(
      { command: 'npx', args: ['server'] },
      { timeout: 5000, _deps: deps }
    );

    expect(result).toEqual([{ name: 'test-tool' }]);
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: env token resolution                                        */
/* ------------------------------------------------------------------ */

describe('discoverTools — env token resolution', () => {
  it('calls resolveEnv with the server entry env', async () => {
    const deps = makeMockDeps();
    const env = { TOKEN: '${env:MY_TOKEN}', PLAIN: 'value' };

    await discoverTools({ command: 'npx', args: ['server'], env }, { _deps: deps });

    expect(deps.resolveEnv).toHaveBeenCalledWith(env);
  });

  it('handles undefined env gracefully', async () => {
    const deps = makeMockDeps();

    await discoverTools({ command: 'npx', args: ['server'] }, { _deps: deps });

    expect(deps.resolveEnv).toHaveBeenCalledWith(undefined);
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: Client initialization                                       */
/* ------------------------------------------------------------------ */

describe('discoverTools — Client setup', () => {
  it('creates Client with agentflow-discovery identity', async () => {
    const deps = makeMockDeps();

    await discoverTools({ command: 'npx', args: ['server'] }, { _deps: deps });

    expect(deps.createClient).toHaveBeenCalledWith({
      name: 'agentflow-discovery',
      version: '1.0.0',
    });
  });

  it('connects client with the created transport', async () => {
    const transportInstance = { type: 'mock-transport' };
    const connectFn = vi.fn().mockResolvedValue(undefined);
    const deps = makeMockDeps({
      connect: connectFn,
    });
    deps.createStdioTransport.mockReturnValue(transportInstance);

    await discoverTools({ command: 'npx', args: ['server'] }, { _deps: deps });

    expect(connectFn).toHaveBeenCalledWith(transportInstance);
  });
});
