/**
 * Tests for src/mcp/unified-search.js
 *
 * Uses vi.spyOn to mock library.search and registryClient.searchRegistry
 * so unified-search picks up our stubs via the module references.
 */

import { vi, afterEach } from 'vitest';
import * as library from '../../packages/cli/src/library';
import * as registryClient from '../../packages/core/src/mcp/registry-client';
import { unifiedSearch } from '../../packages/cli/src/mcp/unified-search';

/* ------------------------------------------------------------------ */
/*  Stub management                                                    */
/* ------------------------------------------------------------------ */

afterEach(() => {
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeLocalEntry(overrides = {}) {
  return {
    type: 'tool',
    name: 'read-code',
    description: 'Read source code files',
    tags: ['code'],
    ...overrides,
  };
}

function makeRegistryEntry(overrides = {}) {
  return {
    name: 'io.github.modelcontextprotocol/github',
    description: 'GitHub API integration',
    packages: [{ registryType: 'npm', identifier: '@mcp/server-github', transport: { type: 'stdio' } }],
    remotes: [{ type: 'streamable-http', url: 'https://github.example.com/mcp' }],
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('unifiedSearch', () => {
  it('returns combined local and mcp results with correct source annotations', async () => {
    const localEntry = makeLocalEntry();
    const mcpEntry = makeRegistryEntry();

    vi.spyOn(library, "search").mockImplementation(() => [localEntry]);
    vi.spyOn(registryClient, "searchRegistry").mockImplementation(async () => ({ entries: [mcpEntry], nextCursor: null, count: 1 }));

    const results = await unifiedSearch({ entries: [] }, 'test');

    expect(results).toHaveLength(2);
    expect(results[0].source).toBe('local');
    expect(results[0].name).toBe('read-code');
    expect(results[0].type).toBe('tool');
    expect(results[1].source).toBe('mcp');
    expect(results[1].type).toBe('server');
    expect(results[1].name).toBe('io.github.modelcontextprotocol/github');
    expect(results[1].description).toBe('GitHub API integration');
    expect(results[1].packages).toEqual(mcpEntry.packages);
    expect(results[1].remotes).toEqual(mcpEntry.remotes);
  });

  it('skips MCP registry when localOnly is set', async () => {
    const localEntry = makeLocalEntry();
    vi.spyOn(library, "search").mockImplementation(() => [localEntry]);
    let registryCalled = false;
    vi.spyOn(registryClient, "searchRegistry").mockImplementation(async () => { registryCalled = true; return { entries: [], nextCursor: null, count: 0 }; });

    const results = await unifiedSearch({ entries: [] }, 'test', { localOnly: true });

    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('local');
    expect(registryCalled).toBe(false);
  });

  it('skips local library when mcpOnly is set', async () => {
    const mcpEntry = makeRegistryEntry();
    let searchCalled = false;
    vi.spyOn(library, "search").mockImplementation(() => { searchCalled = true; return []; });
    vi.spyOn(registryClient, "searchRegistry").mockImplementation(async () => ({ entries: [mcpEntry], nextCursor: null, count: 1 }));

    const results = await unifiedSearch({ entries: [] }, 'test', { mcpOnly: true });

    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('mcp');
    expect(searchCalled).toBe(false);
  });

  it('re-throws registry error when mcpOnly is set', async () => {
    vi.spyOn(registryClient, "searchRegistry").mockImplementation(async () => {
      throw new Error('MCP registry is unreachable: ECONNREFUSED');
    });

    await expect(
      unifiedSearch({ entries: [] }, 'test', { mcpOnly: true })
    ).rejects.toThrow(/MCP registry is unreachable/);
  });

  it('returns local results only when registry fails and mcpOnly is not set', async () => {
    const localEntry = makeLocalEntry();
    vi.spyOn(library, "search").mockImplementation(() => [localEntry]);
    vi.spyOn(registryClient, "searchRegistry").mockImplementation(async () => {
      throw new Error('MCP registry is unreachable');
    });

    const results = await unifiedSearch({ entries: [] }, 'test');

    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('local');
    expect(results[0].name).toBe('read-code');
  });

  it('returns empty array when both sources return empty results', async () => {
    vi.spyOn(library, "search").mockImplementation(() => []);
    vi.spyOn(registryClient, "searchRegistry").mockImplementation(async () => ({ entries: [], nextCursor: null, count: 0 }));

    const results = await unifiedSearch({ entries: [] }, 'test');

    expect(results).toEqual([]);
  });

  it('passes mcpLimit through to searchRegistry', async () => {
    let capturedOpts;
    vi.spyOn(library, "search").mockImplementation(() => []);
    vi.spyOn(registryClient, "searchRegistry").mockImplementation(async (q, opts) => { capturedOpts = opts; return { entries: [], nextCursor: null, count: 0 }; });

    await unifiedSearch({ entries: [] }, 'test', { mcpLimit: 5 });

    expect(capturedOpts).toEqual({ limit: 5 });
  });

  it('uses default mcpLimit of 10 when not specified', async () => {
    let capturedOpts;
    vi.spyOn(library, "search").mockImplementation(() => []);
    vi.spyOn(registryClient, "searchRegistry").mockImplementation(async (q, opts) => { capturedOpts = opts; return { entries: [], nextCursor: null, count: 0 }; });

    await unifiedSearch({ entries: [] }, 'test');

    expect(capturedOpts).toEqual({ limit: 10 });
  });
});
