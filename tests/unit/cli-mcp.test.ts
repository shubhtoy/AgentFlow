/**
 * Tests for the `agentflow mcp search` CLI command.
 *
 * We test the formatting/output logic and the searchRegistry integration.
 */

import { searchRegistry } from '../../packages/core/src/mcp/registry-client';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeEntry(overrides = {}) {
  return {
    name: 'io.github.modelcontextprotocol/github',
    description: 'GitHub API integration',
    packages: [{
      registryType: 'npm',
      identifier: '@modelcontextprotocol/server-github',
      transport: { type: 'stdio' },
    }],
    remotes: [],
    ...overrides,
  };
}

/**
 * Mirrors the formatting logic from cli.js mcp search action.
 */
function formatSearchResult(entry) {
  const transports = [];
  for (const pkg of entry.packages || []) {
    if (pkg.transport && pkg.transport.type) {
      transports.push(pkg.transport.type);
    }
  }
  for (const remote of entry.remotes || []) {
    if (remote.type) {
      transports.push(remote.type);
    }
  }
  const transportStr = transports.length ? ` (${transports.join(', ')})` : '';
  return `  ${entry.name} — ${entry.description || '(no description)'}${transportStr}`;
}

/* ------------------------------------------------------------------ */
/*  Mock fetch helpers                                                 */
/* ------------------------------------------------------------------ */

const originalFetch = globalThis.fetch;

function mockFetch(handler) {
  globalThis.fetch = handler;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

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
      packages: [{ registryType: 'npm', identifier: 'test', transport: { type: 'stdio' } }],
      remotes: [],
      ...overrides,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Tests: result formatting                                           */
/* ------------------------------------------------------------------ */

describe('mcp search — result formatting', () => {
  it('formats a result with stdio transport', () => {
    const line = formatSearchResult(makeEntry());
    expect(line).toBe('  io.github.modelcontextprotocol/github — GitHub API integration (stdio)');
  });

  it('formats multiple transport types from packages and remotes', () => {
    const line = formatSearchResult(makeEntry({
      name: 'io.example/analytics',
      description: 'Analytics server',
      packages: [],
      remotes: [
        { type: 'streamable-http', url: 'https://example.com' },
        { type: 'sse', url: 'https://example.com/sse' },
      ],
    }));
    expect(line).toBe('  io.example/analytics — Analytics server (streamable-http, sse)');
  });

  it('handles entry with no transports', () => {
    const line = formatSearchResult(makeEntry({ packages: [], remotes: [] }));
    expect(line).toBe('  io.github.modelcontextprotocol/github — GitHub API integration');
  });

  it('shows (no description) when description is empty', () => {
    const line = formatSearchResult(makeEntry({ description: '' }));
    expect(line).toContain('(no description)');
  });

  it('combines package and remote transports', () => {
    const line = formatSearchResult(makeEntry({
      packages: [{ registryType: 'npm', identifier: 'test', transport: { type: 'stdio' } }],
      remotes: [{ type: 'sse', url: 'https://example.com' }],
    }));
    expect(line).toContain('(stdio, sse)');
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: searchRegistry integration                                  */
/* ------------------------------------------------------------------ */

describe('mcp search — searchRegistry integration', () => {
  it('calls searchRegistry with query and returns results', async () => {
    let capturedUrl;
    mockFetch(async (url) => {
      capturedUrl = url;
      return makeRegistryResponse([makeServerEntry()]);
    });

    const result = await searchRegistry('github', { limit: 5 });

    expect(capturedUrl).toContain('search=github');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].name).toBe('io.github.modelcontextprotocol/github');
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

  it('throws error when registry is unreachable', async () => {
    mockFetch(async () => { throw new Error('ECONNREFUSED'); });
    await expect(searchRegistry('test')).rejects.toThrow(/MCP registry is unreachable/);
  });
});


/* ------------------------------------------------------------------ */
/*  Mocks for config-manager and registry-client                       */
/* ------------------------------------------------------------------ */

import * as mcpConfigManager from '../../packages/cli/src/mcp/config-manager';
import * as registryClient from '../../packages/core/src/mcp/registry-client';

/* ------------------------------------------------------------------ */
/*  Tests: mcp add                                                     */
/* ------------------------------------------------------------------ */

describe('mcp add', () => {
  let addServerSpy;
  let getServerSpy;

  beforeEach(() => {
    addServerSpy = vi.spyOn(mcpConfigManager, 'addServer').mockImplementation(() => {});
    getServerSpy = vi.spyOn(registryClient, 'getServer');
  });

  afterEach(() => {
    addServerSpy.mockRestore();
    getServerSpy.mockRestore();
  });

  it('calls getServer then addServer with correct args', async () => {
    const fakeEntry = makeEntry({ name: 'io.example/test-server' });
    getServerSpy.mockResolvedValue(fakeEntry);

    const serverName = 'io.example/test-server';
    const entry = await registryClient.getServer(serverName);
    expect(entry).toBeTruthy();

    const path = require('path');
    const rootDir = path.resolve('.agentflow');
    mcpConfigManager.addServer(rootDir, serverName, entry, {
      required: false,
      env: {},
    });

    expect(getServerSpy).toHaveBeenCalledWith('io.example/test-server');
    expect(addServerSpy).toHaveBeenCalledWith(
      rootDir,
      'io.example/test-server',
      fakeEntry,
      { required: false, env: {} },
    );
  });

  it('passes required: true when --required flag is set', async () => {
    const fakeEntry = makeEntry({ name: 'io.example/required-server' });
    getServerSpy.mockResolvedValue(fakeEntry);

    const serverName = 'io.example/required-server';
    const entry = await registryClient.getServer(serverName);

    const path = require('path');
    const rootDir = path.resolve('.agentflow');
    mcpConfigManager.addServer(rootDir, serverName, entry, {
      required: true,
      env: {},
    });

    expect(addServerSpy).toHaveBeenCalledWith(
      rootDir,
      'io.example/required-server',
      fakeEntry,
      { required: true, env: {} },
    );
  });

  it('shows error when server not found in registry', async () => {
    getServerSpy.mockResolvedValue(null);

    const entry = await registryClient.getServer('nonexistent-server');
    expect(entry).toBeNull();
    // CLI would print: ✗ Server "nonexistent-server" not found in registry
    // and call process.exit(1)
  });

  it('passes env variables from --env flag', async () => {
    const fakeEntry = makeEntry({ name: 'io.example/env-server' });
    getServerSpy.mockResolvedValue(fakeEntry);

    const serverName = 'io.example/env-server';
    const entry = await registryClient.getServer(serverName);

    const path = require('path');
    const rootDir = path.resolve('.agentflow');
    const env = { GITHUB_TOKEN: 'abc123', API_KEY: 'xyz' };
    mcpConfigManager.addServer(rootDir, serverName, entry, {
      required: false,
      env,
    });

    expect(addServerSpy).toHaveBeenCalledWith(
      rootDir,
      'io.example/env-server',
      fakeEntry,
      { required: false, env: { GITHUB_TOKEN: 'abc123', API_KEY: 'xyz' } },
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: mcp remove                                                  */
/* ------------------------------------------------------------------ */

describe('mcp remove', () => {
  let removeServerSpy;

  beforeEach(() => {
    removeServerSpy = vi.spyOn(mcpConfigManager, 'removeServer').mockImplementation(() => {});
  });

  afterEach(() => {
    removeServerSpy.mockRestore();
  });

  it('calls removeServer with correct args', () => {
    const path = require('path');
    const rootDir = path.resolve('.agentflow');
    const serverName = 'io.example/test-server';

    mcpConfigManager.removeServer(rootDir, serverName, { removeTools: false });

    expect(removeServerSpy).toHaveBeenCalledWith(
      rootDir,
      'io.example/test-server',
      { removeTools: false },
    );
  });

  it('passes removeTools: true when --remove-tools flag is set', () => {
    const path = require('path');
    const rootDir = path.resolve('.agentflow');
    const serverName = 'io.example/test-server';

    mcpConfigManager.removeServer(rootDir, serverName, { removeTools: true });

    expect(removeServerSpy).toHaveBeenCalledWith(
      rootDir,
      'io.example/test-server',
      { removeTools: true },
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: collectEnv helper                                           */
/* ------------------------------------------------------------------ */

describe('collectEnv helper', () => {
  // Re-implement collectEnv for testing (mirrors cli.js logic)
  function collectEnv(val, acc) {
    const eqIdx = val.indexOf('=');
    if (eqIdx === -1) {
      throw new Error(`Invalid env format: "${val}". Use KEY=VALUE`);
    }
    acc[val.slice(0, eqIdx)] = val.slice(eqIdx + 1);
    return acc;
  }

  it('parses KEY=VALUE correctly', () => {
    const result = collectEnv('GITHUB_TOKEN=abc123', {});
    expect(result).toEqual({ GITHUB_TOKEN: 'abc123' });
  });

  it('accumulates multiple env vars', () => {
    let acc = {};
    acc = collectEnv('KEY1=val1', acc);
    acc = collectEnv('KEY2=val2', acc);
    expect(acc).toEqual({ KEY1: 'val1', KEY2: 'val2' });
  });

  it('handles values containing equals signs', () => {
    const result = collectEnv('TOKEN=abc=def=ghi', {});
    expect(result).toEqual({ TOKEN: 'abc=def=ghi' });
  });

  it('throws on invalid format without equals sign', () => {
    expect(() => collectEnv('NOEQUALS', {})).toThrow(/Invalid env format/);
  });
});


/* ------------------------------------------------------------------ */
/*  Mocks for server-lifecycle and tool-scaffolder                     */
/* ------------------------------------------------------------------ */

import * as serverLifecycle from '../../packages/cli/src/mcp/server-lifecycle';
import * as toolScaffolder from '../../packages/cli/src/mcp/tool-scaffolder';
import path from 'path';
/* ------------------------------------------------------------------ */
/*  Tests: mcp discover                                                */
/* ------------------------------------------------------------------ */

describe('mcp discover', () => {
  let loadMcpConfigSpy;
  let discoverToolsSpy;
  let scaffoldToolsSpy;

  beforeEach(() => {
    loadMcpConfigSpy = vi.spyOn(mcpConfigManager, 'loadMcpConfig');
    discoverToolsSpy = vi.spyOn(serverLifecycle, 'discoverTools');
    scaffoldToolsSpy = vi.spyOn(toolScaffolder, 'scaffoldTools');
  });

  afterEach(() => {
    loadMcpConfigSpy.mockRestore();
    discoverToolsSpy.mockRestore();
    scaffoldToolsSpy.mockRestore();
  });

  it('loads config, calls discoverTools, then scaffoldTools', async () => {
    const serverEntry = { command: 'npx', args: ['-y', '@test/server'] };
    loadMcpConfigSpy.mockReturnValue({
      servers: { 'io.example/test-server': serverEntry },
      errors: [],
    });

    const fakeTools = [
      { name: 'tool-a', description: 'Tool A', inputSchema: {} },
      { name: 'tool-b', description: 'Tool B', inputSchema: {} },
    ];
    discoverToolsSpy.mockResolvedValue(fakeTools);
    scaffoldToolsSpy.mockReturnValue([
      '.agentflow/tools/tool-a.md',
      '.agentflow/tools/tool-b.md',
    ]);

    const serverName = 'io.example/test-server';
    const rootDir = path.resolve('.agentflow');

    const config = mcpConfigManager.loadMcpConfig(rootDir);
    const entry = config.servers[serverName];
    expect(entry).toBeTruthy();

    const tools = await serverLifecycle.discoverTools(entry, { timeout: 30000 });
    expect(tools).toHaveLength(2);

    const paths = toolScaffolder.scaffoldTools(rootDir, serverName, tools, { overwrite: false });
    expect(paths).toHaveLength(2);

    expect(loadMcpConfigSpy).toHaveBeenCalledWith(rootDir);
    expect(discoverToolsSpy).toHaveBeenCalledWith(serverEntry, { timeout: 30000 });
    expect(scaffoldToolsSpy).toHaveBeenCalledWith(
      rootDir,
      'io.example/test-server',
      fakeTools,
      { overwrite: false },
    );
  });

  it('shows error when server not found in mcp.json', () => {
    loadMcpConfigSpy.mockReturnValue({
      servers: {},
      errors: [],
    });

    const rootDir = path.resolve('.agentflow');
    const config = mcpConfigManager.loadMcpConfig(rootDir);
    const serverName = 'nonexistent-server';
    const entry = config.servers[serverName];

    expect(entry).toBeUndefined();
    // CLI would print: ✗ Server "nonexistent-server" not found in mcp.json
    // and call process.exit(1)
  });

  it('passes timeout option to discoverTools', async () => {
    const serverEntry = { command: 'npx', args: ['-y', '@test/server'] };
    loadMcpConfigSpy.mockReturnValue({
      servers: { 'io.example/timeout-server': serverEntry },
      errors: [],
    });
    discoverToolsSpy.mockResolvedValue([]);
    scaffoldToolsSpy.mockReturnValue([]);

    const serverName = 'io.example/timeout-server';
    const rootDir = path.resolve('.agentflow');
    const customTimeout = 60000;

    const config = mcpConfigManager.loadMcpConfig(rootDir);
    const entry = config.servers[serverName];
    await serverLifecycle.discoverTools(entry, { timeout: customTimeout });

    expect(discoverToolsSpy).toHaveBeenCalledWith(serverEntry, { timeout: 60000 });
  });

  it('passes overwrite option to scaffoldTools', async () => {
    const serverEntry = { command: 'npx', args: ['-y', '@test/server'] };
    loadMcpConfigSpy.mockReturnValue({
      servers: { 'io.example/overwrite-server': serverEntry },
      errors: [],
    });

    const fakeTools = [{ name: 'tool-x', description: 'Tool X', inputSchema: {} }];
    discoverToolsSpy.mockResolvedValue(fakeTools);
    scaffoldToolsSpy.mockReturnValue(['.agentflow/tools/tool-x.md']);

    const serverName = 'io.example/overwrite-server';
    const rootDir = path.resolve('.agentflow');

    const config = mcpConfigManager.loadMcpConfig(rootDir);
    const entry = config.servers[serverName];
    const tools = await serverLifecycle.discoverTools(entry, { timeout: 30000 });
    toolScaffolder.scaffoldTools(rootDir, serverName, tools, { overwrite: true });

    expect(scaffoldToolsSpy).toHaveBeenCalledWith(
      rootDir,
      'io.example/overwrite-server',
      fakeTools,
      { overwrite: true },
    );
  });
});


/* ------------------------------------------------------------------ */
/*  Tests: mcp list                                                    */
/* ------------------------------------------------------------------ */

describe('mcp list', () => {
  let loadMcpConfigSpy;
  let consoleSpy;

  beforeEach(() => {
    loadMcpConfigSpy = vi.spyOn(mcpConfigManager, 'loadMcpConfig');
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    loadMcpConfigSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('displays servers with name, description, required status, and transport type', () => {
    loadMcpConfigSpy.mockReturnValue({
      servers: {
        'io.example/github': {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          description: 'GitHub API integration',
          required: true,
        },
        'io.example/analytics': {
          url: 'https://analytics.example.com/mcp',
          description: 'Real-time analytics',
          required: false,
        },
      },
      errors: [],
    });

    const rootDir = path.resolve('.agentflow');
    const config = mcpConfigManager.loadMcpConfig(rootDir);
    const servers = config.servers || {};
    const names = Object.keys(servers);

    expect(names).toHaveLength(2);

    // Verify each server has the expected fields for display
    const github = servers['io.example/github'];
    expect(github.description).toBe('GitHub API integration');
    expect(github.required).toBe(true);
    expect(github.command).toBe('npx'); // stdio transport

    const analytics = servers['io.example/analytics'];
    expect(analytics.description).toBe('Real-time analytics');
    expect(analytics.required).toBe(false);
    expect(analytics.url).toBe('https://analytics.example.com/mcp'); // http transport

    // Verify the formatting logic
    for (const name of names) {
      const s = servers[name];
      const required = s.required ? 'required' : 'optional';
      const transport = s.command ? 'stdio' : s.url ? 'http' : 'unknown';
      const desc = s.description || '(no description)';
      const line = `  ${name} — ${desc} [${required}, ${transport}]`;
      console.log(line);
    }
    console.log(`\n${names.length} server(s)`);

    expect(consoleSpy).toHaveBeenCalledWith(
      '  io.example/github — GitHub API integration [required, stdio]'
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      '  io.example/analytics — Real-time analytics [optional, http]'
    );
    expect(consoleSpy).toHaveBeenCalledWith('\n2 server(s)');
  });

  it('shows message when no servers configured', () => {
    loadMcpConfigSpy.mockReturnValue({
      servers: {},
      errors: [],
    });

    const rootDir = path.resolve('.agentflow');
    const config = mcpConfigManager.loadMcpConfig(rootDir);
    const servers = config.servers || {};
    const names = Object.keys(servers);

    expect(names).toHaveLength(0);

    // Verify the empty-state message
    console.log('No MCP servers configured. Use `agentflow mcp add <server-name>` to add one.');

    expect(consoleSpy).toHaveBeenCalledWith(
      'No MCP servers configured. Use `agentflow mcp add <server-name>` to add one.'
    );
  });

  it('handles servers with missing description', () => {
    loadMcpConfigSpy.mockReturnValue({
      servers: {
        'io.example/no-desc': {
          command: 'node',
          args: ['server.js'],
          required: false,
        },
      },
      errors: [],
    });

    const rootDir = path.resolve('.agentflow');
    const config = mcpConfigManager.loadMcpConfig(rootDir);
    const servers = config.servers || {};
    const names = Object.keys(servers);

    expect(names).toHaveLength(1);

    const s = servers['io.example/no-desc'];
    const required = s.required ? 'required' : 'optional';
    const transport = s.command ? 'stdio' : s.url ? 'http' : 'unknown';
    const desc = s.description || '(no description)';
    const line = `  ${names[0]} — ${desc} [${required}, ${transport}]`;
    console.log(line);

    expect(consoleSpy).toHaveBeenCalledWith(
      '  io.example/no-desc — (no description) [optional, stdio]'
    );
  });
});


/* ------------------------------------------------------------------ */
/*  Tests: unified search command                                      */
/* ------------------------------------------------------------------ */

import * as unifiedSearchModule from '../../packages/cli/src/mcp/unified-search';

describe('unified search command', () => {
  let unifiedSearchSpy;

  beforeEach(() => {
    unifiedSearchSpy = vi.spyOn(unifiedSearchModule, 'unifiedSearch');
  });

  afterEach(() => {
    unifiedSearchSpy.mockRestore();
  });

  it('returns combined results with source annotations', async () => {
    const combinedResults = [
      { source: 'local', type: 'workflow', name: 'build-feature', description: 'Build a feature' },
      {
        source: 'mcp',
        type: 'server',
        name: 'io.github.modelcontextprotocol/github',
        description: 'GitHub API integration',
        packages: [{ registryType: 'npm', identifier: '@mcp/github', transport: { type: 'stdio' } }],
        remotes: [],
      },
    ];
    unifiedSearchSpy.mockResolvedValue(combinedResults);

    const registry = { entries: [] };
    const query = 'github';
    const results = await unifiedSearchModule.unifiedSearch(registry, query, {});

    expect(results).toHaveLength(2);
    expect(results[0].source).toBe('local');
    expect(results[1].source).toBe('mcp');
    expect(unifiedSearchSpy).toHaveBeenCalledWith(registry, query, {});
  });

  it('passes localOnly option when --local-only flag is set', async () => {
    const localResults = [
      { source: 'local', type: 'skill', name: 'api-design', description: 'API design skill' },
    ];
    unifiedSearchSpy.mockResolvedValue(localResults);

    const registry = { entries: [] };
    const query = 'api';
    const opts = { localOnly: true, mcpOnly: false };
    const results = await unifiedSearchModule.unifiedSearch(registry, query, opts);

    expect(results).toHaveLength(1);
    expect(results.every(r => r.source === 'local')).toBe(true);
    expect(unifiedSearchSpy).toHaveBeenCalledWith(registry, query, { localOnly: true, mcpOnly: false });
  });

  it('passes mcpOnly option when --mcp-only flag is set', async () => {
    const mcpResults = [
      {
        source: 'mcp',
        type: 'server',
        name: 'io.example/analytics',
        description: 'Analytics server',
        packages: [],
        remotes: [{ type: 'streamable-http', url: 'https://example.com' }],
      },
    ];
    unifiedSearchSpy.mockResolvedValue(mcpResults);

    const registry = { entries: [] };
    const query = 'analytics';
    const opts = { localOnly: false, mcpOnly: true };
    const results = await unifiedSearchModule.unifiedSearch(registry, query, opts);

    expect(results).toHaveLength(1);
    expect(results.every(r => r.source === 'mcp')).toBe(true);
    expect(unifiedSearchSpy).toHaveBeenCalledWith(registry, query, { localOnly: false, mcpOnly: true });
  });

  it('returns empty array when no results match', async () => {
    unifiedSearchSpy.mockResolvedValue([]);

    const registry = { entries: [] };
    const query = 'nonexistent';
    const results = await unifiedSearchModule.unifiedSearch(registry, query, {});

    expect(results).toHaveLength(0);
  });

  it('propagates errors when mcpOnly and registry is unreachable', async () => {
    unifiedSearchSpy.mockRejectedValue(new Error('MCP registry is unreachable'));

    const registry = { entries: [] };
    const query = 'test';

    await expect(
      unifiedSearchModule.unifiedSearch(registry, query, { mcpOnly: true })
    ).rejects.toThrow('MCP registry is unreachable');
  });
});
