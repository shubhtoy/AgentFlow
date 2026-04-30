import fs from 'fs';
import path from 'path';
import os from 'os';

import { loadMcpConfig, saveMcpConfig, mcpConfigPath, } from '../../packages/cli/src/mcp/config-manager';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agentflow-mcp-cfg-'));
}

function removeTmpDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeConfig(rootDir, content) {
  const dir = path.join(rootDir, '.agentflow');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'mcp.json'), content, 'utf-8');
}

/* ------------------------------------------------------------------ */
/*  loadMcpConfig                                                      */
/* ------------------------------------------------------------------ */

describe('loadMcpConfig', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTmpDir(); });
  afterEach(() => { removeTmpDir(tmpDir); });

  it('returns empty servers and no errors when mcp.json does not exist', () => {
    const result = loadMcpConfig(tmpDir);
    expect(result).toEqual({ servers: {}, errors: [] });
  });

  it('returns empty servers and no errors when .agentflow dir does not exist', () => {
    const result = loadMcpConfig(path.join(tmpDir, 'nonexistent'));
    expect(result).toEqual({ servers: {}, errors: [] });
  });

  it('loads a valid mcp.json with server entries', () => {
    const servers = {
      github: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: { GITHUB_TOKEN: '${env:GITHUB_TOKEN}' },
        required: true,
        description: 'GitHub API integration',
      },
    };
    writeConfig(tmpDir, JSON.stringify({ mcpServers: servers }, null, 2));

    const result = loadMcpConfig(tmpDir);
    expect(result.errors).toEqual([]);
    expect(result.servers).toEqual(servers);
  });

  it('returns parse errors for malformed JSON', () => {
    writeConfig(tmpDir, '{ this is not valid json }');

    const result = loadMcpConfig(tmpDir);
    expect(result.servers).toEqual({});
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Failed to parse mcp\.json/);
  });

  it('returns empty servers when mcpServers key is missing', () => {
    writeConfig(tmpDir, JSON.stringify({ otherKey: 'value' }));

    const result = loadMcpConfig(tmpDir);
    expect(result.servers).toEqual({});
    expect(result.errors).toEqual([]);
  });

  it('preserves ${env:VAR} tokens as literal strings', () => {
    const servers = {
      myserver: {
        command: 'node',
        args: ['server.js'],
        env: {
          API_KEY: '${env:MY_API_KEY}',
          SECRET: '${env:MY_SECRET}',
        },
      },
    };
    writeConfig(tmpDir, JSON.stringify({ mcpServers: servers }, null, 2));

    const result = loadMcpConfig(tmpDir);
    expect(result.servers.myserver.env.API_KEY).toBe('${env:MY_API_KEY}');
    expect(result.servers.myserver.env.SECRET).toBe('${env:MY_SECRET}');
  });

  it('handles empty JSON object', () => {
    writeConfig(tmpDir, '{}');

    const result = loadMcpConfig(tmpDir);
    expect(result.servers).toEqual({});
    expect(result.errors).toEqual([]);
  });

  it('handles mcpServers being null', () => {
    writeConfig(tmpDir, JSON.stringify({ mcpServers: null }));

    const result = loadMcpConfig(tmpDir);
    expect(result.servers).toEqual({});
    expect(result.errors).toEqual([]);
  });

  it('preserves all standard and extension fields', () => {
    const servers = {
      github: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: { GITHUB_TOKEN: '${env:GITHUB_TOKEN}' },
        required: true,
        description: 'GitHub API integration',
        registry: 'modelcontextprotocol',
        registryName: 'io.github.modelcontextprotocol/github',
        version: '2025.11.28',
        discoveredTools: ['github-create-issue', 'github-list-issues'],
      },
      analytics: {
        url: 'https://analytics.example.com/mcp',
        env: {},
        required: false,
        description: 'Real-time analytics',
        discoveredTools: ['analytics-query-metrics'],
      },
    };
    writeConfig(tmpDir, JSON.stringify({ mcpServers: servers }, null, 2));

    const result = loadMcpConfig(tmpDir);
    expect(result.errors).toEqual([]);
    expect(result.servers).toEqual(servers);
  });
});

/* ------------------------------------------------------------------ */
/*  saveMcpConfig                                                      */
/* ------------------------------------------------------------------ */

describe('saveMcpConfig', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTmpDir(); });
  afterEach(() => { removeTmpDir(tmpDir); });

  it('creates .agentflow directory and writes mcp.json', () => {
    const servers = {
      test: { command: 'node', args: ['test.js'] },
    };

    saveMcpConfig(tmpDir, servers);

    const configPath = mcpConfigPath(tmpDir);
    expect(fs.existsSync(configPath)).toBe(true);

    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.mcpServers).toEqual(servers);
  });

  it('wraps servers under mcpServers key', () => {
    const servers = { myserver: { url: 'https://example.com/mcp' } };

    saveMcpConfig(tmpDir, servers);

    const raw = fs.readFileSync(mcpConfigPath(tmpDir), 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed).toHaveProperty('mcpServers');
    expect(parsed.mcpServers).toEqual(servers);
  });

  it('preserves ${env:VAR} tokens as literal strings', () => {
    const servers = {
      myserver: {
        command: 'node',
        env: {
          TOKEN: '${env:MY_TOKEN}',
          KEY: '${env:API_KEY}',
        },
      },
    };

    saveMcpConfig(tmpDir, servers);

    const raw = fs.readFileSync(mcpConfigPath(tmpDir), 'utf-8');
    expect(raw).toContain('${env:MY_TOKEN}');
    expect(raw).toContain('${env:API_KEY}');

    const parsed = JSON.parse(raw);
    expect(parsed.mcpServers.myserver.env.TOKEN).toBe('${env:MY_TOKEN}');
    expect(parsed.mcpServers.myserver.env.KEY).toBe('${env:API_KEY}');
  });

  it('overwrites existing mcp.json', () => {
    const initial = { old: { command: 'old' } };
    saveMcpConfig(tmpDir, initial);

    const updated = { new: { command: 'new' } };
    saveMcpConfig(tmpDir, updated);

    const result = loadMcpConfig(tmpDir);
    expect(result.servers).toEqual(updated);
    expect(result.servers).not.toHaveProperty('old');
  });

  it('saves empty servers object', () => {
    saveMcpConfig(tmpDir, {});

    const result = loadMcpConfig(tmpDir);
    expect(result.servers).toEqual({});
    expect(result.errors).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  Round-trip preservation                                            */
/* ------------------------------------------------------------------ */

describe('load/save round-trip', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTmpDir(); });
  afterEach(() => { removeTmpDir(tmpDir); });

  it('round-trips a full config with env tokens and extension fields', () => {
    const servers = {
      github: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: { GITHUB_TOKEN: '${env:GITHUB_TOKEN}' },
        required: true,
        description: 'GitHub API integration',
        registry: 'modelcontextprotocol',
        registryName: 'io.github.modelcontextprotocol/github',
        version: '2025.11.28',
        discoveredTools: ['github-create-issue', 'github-list-issues'],
      },
    };

    saveMcpConfig(tmpDir, servers);
    const result = loadMcpConfig(tmpDir);

    expect(result.errors).toEqual([]);
    expect(result.servers).toEqual(servers);
  });

  it('round-trips multiple servers with mixed transports', () => {
    const servers = {
      stdio_server: {
        command: 'node',
        args: ['server.js'],
        env: { KEY: '${env:KEY}' },
      },
      http_server: {
        url: 'https://example.com/mcp',
        env: {},
      },
    };

    saveMcpConfig(tmpDir, servers);
    const result = loadMcpConfig(tmpDir);

    expect(result.errors).toEqual([]);
    expect(result.servers).toEqual(servers);
  });
});

/* ------------------------------------------------------------------ */
/*  addServer                                                          */
/* ------------------------------------------------------------------ */

import { addServer, removeServer, } from '../../packages/cli/src/mcp/config-manager';

describe('addServer', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTmpDir(); });
  afterEach(() => { removeTmpDir(tmpDir); });

  it('converts npm stdio package to npx command/args', () => {
    const registryEntry = {
      server: {
        name: 'io.github.modelcontextprotocol/github',
        description: 'GitHub API integration',
        version: '2025.11.28',
        packages: [{
          registryType: 'npm',
          identifier: '@modelcontextprotocol/server-github',
          transport: { type: 'stdio' },
        }],
        remotes: [],
      },
    };

    const entry = addServer(tmpDir, 'github', registryEntry);

    expect(entry.command).toBe('npx');
    expect(entry.args).toEqual(['-y', '@modelcontextprotocol/server-github']);
  });

  it('converts pypi stdio package to uvx command/args', () => {
    const registryEntry = {
      server: {
        name: 'io.github.example/pyserver',
        description: 'Python MCP server',
        version: '1.0.0',
        packages: [{
          registryType: 'pypi',
          identifier: 'mcp-server-python',
          transport: { type: 'stdio' },
        }],
        remotes: [],
      },
    };

    const entry = addServer(tmpDir, 'pyserver', registryEntry);

    expect(entry.command).toBe('uvx');
    expect(entry.args).toEqual(['mcp-server-python']);
  });

  it('converts HTTP/SSE remote to url field', () => {
    const registryEntry = {
      server: {
        name: 'io.example/analytics',
        description: 'Analytics server',
        version: '2.0.0',
        packages: [],
        remotes: [{
          type: 'streamable-http',
          url: 'https://analytics.example.com/mcp',
        }],
      },
    };

    const entry = addServer(tmpDir, 'analytics', registryEntry);

    expect(entry.url).toBe('https://analytics.example.com/mcp');
    expect(entry.command).toBeUndefined();
    expect(entry.args).toBeUndefined();
  });

  it('prefers stdio package over remote when both exist', () => {
    const registryEntry = {
      server: {
        name: 'io.example/dual',
        description: 'Dual transport',
        version: '1.0.0',
        packages: [{
          registryType: 'npm',
          identifier: '@example/dual-server',
          transport: { type: 'stdio' },
        }],
        remotes: [{
          type: 'sse',
          url: 'https://dual.example.com/mcp',
        }],
      },
    };

    const entry = addServer(tmpDir, 'dual', registryEntry);

    expect(entry.command).toBe('npx');
    expect(entry.args).toEqual(['-y', '@example/dual-server']);
    expect(entry.url).toBeUndefined();
  });

  it('sets required: true when opts.required is true', () => {
    const registryEntry = {
      server: {
        name: 'io.example/server',
        description: 'Test',
        packages: [],
        remotes: [],
      },
    };

    const entry = addServer(tmpDir, 'test', registryEntry, { required: true });

    expect(entry.required).toBe(true);
  });

  it('does not set required field when opts.required is falsy', () => {
    const registryEntry = {
      server: {
        name: 'io.example/server',
        description: 'Test',
        packages: [],
        remotes: [],
      },
    };

    const entry = addServer(tmpDir, 'test', registryEntry);

    expect(entry.required).toBeUndefined();
  });

  it('populates env object from opts.env', () => {
    const registryEntry = {
      server: {
        name: 'io.example/server',
        description: 'Test',
        packages: [],
        remotes: [],
      },
    };

    const entry = addServer(tmpDir, 'test', registryEntry, {
      env: { GITHUB_TOKEN: '${env:GITHUB_TOKEN}', API_KEY: 'my-key' },
    });

    expect(entry.env).toEqual({
      GITHUB_TOKEN: '${env:GITHUB_TOKEN}',
      API_KEY: 'my-key',
    });
  });

  it('defaults env to empty object when not provided', () => {
    const registryEntry = {
      server: {
        name: 'io.example/server',
        description: 'Test',
        packages: [],
        remotes: [],
      },
    };

    const entry = addServer(tmpDir, 'test', registryEntry);

    expect(entry.env).toEqual({});
  });

  it('stores AgentFlow extension fields', () => {
    const registryEntry = {
      server: {
        name: 'io.github.modelcontextprotocol/github',
        description: 'GitHub API integration',
        version: '2025.11.28',
        packages: [{
          registryType: 'npm',
          identifier: '@modelcontextprotocol/server-github',
          transport: { type: 'stdio' },
        }],
        remotes: [],
      },
    };

    const entry = addServer(tmpDir, 'github', registryEntry);

    expect(entry.description).toBe('GitHub API integration');
    expect(entry.registryName).toBe('io.github.modelcontextprotocol/github');
    expect(entry.version).toBe('2025.11.28');
    expect(entry.discoveredTools).toEqual([]);
  });

  it('persists the entry to mcp.json', () => {
    const registryEntry = {
      server: {
        name: 'io.example/server',
        description: 'Test',
        packages: [],
        remotes: [],
      },
    };

    addServer(tmpDir, 'test', registryEntry);

    const { servers } = loadMcpConfig(tmpDir);
    expect(servers).toHaveProperty('test');
    expect(servers.test.description).toBe('Test');
  });

  it('preserves existing servers when adding a new one', () => {
    const existing = { existing: { command: 'node', args: ['existing.js'], env: {} } };
    saveMcpConfig(tmpDir, existing);

    const registryEntry = {
      server: {
        name: 'io.example/new',
        description: 'New server',
        packages: [],
        remotes: [],
      },
    };

    addServer(tmpDir, 'new-server', registryEntry);

    const { servers } = loadMcpConfig(tmpDir);
    expect(servers).toHaveProperty('existing');
    expect(servers).toHaveProperty('new-server');
  });

  it('creates mcp.json when it does not exist', () => {
    const registryEntry = {
      server: {
        name: 'io.example/first',
        description: 'First server',
        packages: [],
        remotes: [],
      },
    };

    addServer(tmpDir, 'first', registryEntry);

    const configPath = mcpConfigPath(tmpDir);
    expect(fs.existsSync(configPath)).toBe(true);

    const { servers } = loadMcpConfig(tmpDir);
    expect(servers).toHaveProperty('first');
  });
});

/* ------------------------------------------------------------------ */
/*  removeServer                                                       */
/* ------------------------------------------------------------------ */

describe('removeServer', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTmpDir(); });
  afterEach(() => { removeTmpDir(tmpDir); });

  it('removes a server entry from mcp.json', () => {
    const servers = {
      github: { command: 'npx', args: ['-y', '@mcp/github'], env: {} },
      analytics: { url: 'https://example.com/mcp', env: {} },
    };
    saveMcpConfig(tmpDir, servers);

    removeServer(tmpDir, 'github');

    const { servers: updated } = loadMcpConfig(tmpDir);
    expect(updated).not.toHaveProperty('github');
    expect(updated).toHaveProperty('analytics');
  });

  it('does nothing when server does not exist', () => {
    const servers = { existing: { command: 'node', args: ['s.js'], env: {} } };
    saveMcpConfig(tmpDir, servers);

    removeServer(tmpDir, 'nonexistent');

    const { servers: updated } = loadMcpConfig(tmpDir);
    expect(updated).toHaveProperty('existing');
  });

  it('deletes generated tool .md files when removeTools is true', () => {
    // Create tool files
    const toolsDir = path.join(tmpDir, '.agentflow', 'capabilities');
    fs.mkdirSync(toolsDir, { recursive: true });
    fs.writeFileSync(path.join(toolsDir, 'github-create-issue.md'), '# Tool', 'utf-8');
    fs.writeFileSync(path.join(toolsDir, 'github-list-issues.md'), '# Tool', 'utf-8');

    const servers = {
      github: {
        command: 'npx',
        args: ['-y', '@mcp/github'],
        env: {},
        discoveredTools: ['github-create-issue', 'github-list-issues'],
      },
    };
    saveMcpConfig(tmpDir, servers);

    removeServer(tmpDir, 'github', { removeTools: true });

    expect(fs.existsSync(path.join(toolsDir, 'github-create-issue.md'))).toBe(false);
    expect(fs.existsSync(path.join(toolsDir, 'github-list-issues.md'))).toBe(false);

    const { servers: updated } = loadMcpConfig(tmpDir);
    expect(updated).not.toHaveProperty('github');
  });

  it('does not delete tool files when removeTools is not set', () => {
    const toolsDir = path.join(tmpDir, '.agentflow', 'capabilities');
    fs.mkdirSync(toolsDir, { recursive: true });
    fs.writeFileSync(path.join(toolsDir, 'github-create-issue.md'), '# Tool', 'utf-8');

    const servers = {
      github: {
        command: 'npx',
        args: ['-y', '@mcp/github'],
        env: {},
        discoveredTools: ['github-create-issue'],
      },
    };
    saveMcpConfig(tmpDir, servers);

    removeServer(tmpDir, 'github');

    // Tool file should still exist
    expect(fs.existsSync(path.join(toolsDir, 'github-create-issue.md'))).toBe(true);
  });

  it('handles missing tool files gracefully when removeTools is true', () => {
    const servers = {
      github: {
        command: 'npx',
        args: ['-y', '@mcp/github'],
        env: {},
        discoveredTools: ['nonexistent-tool'],
      },
    };
    saveMcpConfig(tmpDir, servers);

    // Should not throw
    expect(() => {
      removeServer(tmpDir, 'github', { removeTools: true });
    }).not.toThrow();

    const { servers: updated } = loadMcpConfig(tmpDir);
    expect(updated).not.toHaveProperty('github');
  });

  it('handles server with no discoveredTools when removeTools is true', () => {
    const servers = {
      github: { command: 'npx', args: ['-y', '@mcp/github'], env: {} },
    };
    saveMcpConfig(tmpDir, servers);

    expect(() => {
      removeServer(tmpDir, 'github', { removeTools: true });
    }).not.toThrow();

    const { servers: updated } = loadMcpConfig(tmpDir);
    expect(updated).not.toHaveProperty('github');
  });
});


/* ------------------------------------------------------------------ */
/*  resolveEnvTokens                                                   */
/* ------------------------------------------------------------------ */

import { resolveEnvTokens } from '../../packages/cli/src/mcp/config-manager';

describe('resolveEnvTokens', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore process.env after each test
    process.env = { ...originalEnv };
  });

  it('resolves ${env:VAR} tokens from process.env', () => {
    process.env.GITHUB_TOKEN = 'gh-secret-123';

    const result = resolveEnvTokens({ GITHUB_TOKEN: '${env:GITHUB_TOKEN}' });

    expect(result.GITHUB_TOKEN).toBe('gh-secret-123');
  });

  it('passes through non-token values unchanged', () => {
    const result = resolveEnvTokens({ API_KEY: 'literal-value' });

    expect(result.API_KEY).toBe('literal-value');
  });

  it('replaces unset env vars with empty string', () => {
    delete process.env.NONEXISTENT_VAR;

    const result = resolveEnvTokens({ KEY: '${env:NONEXISTENT_VAR}' });

    expect(result.KEY).toBe('');
  });

  it('handles a mix of tokens and literal values', () => {
    process.env.MY_TOKEN = 'resolved-token';

    const result = resolveEnvTokens({
      TOKEN: '${env:MY_TOKEN}',
      LITERAL: 'plain-value',
      MISSING: '${env:DOES_NOT_EXIST}',
    });

    expect(result.TOKEN).toBe('resolved-token');
    expect(result.LITERAL).toBe('plain-value');
    expect(result.MISSING).toBe('');
  });

  it('returns empty object for null input', () => {
    expect(resolveEnvTokens(null)).toEqual({});
  });

  it('returns empty object for undefined input', () => {
    expect(resolveEnvTokens(undefined)).toEqual({});
  });

  it('returns empty object for non-object input', () => {
    expect(resolveEnvTokens('string')).toEqual({});
  });

  it('returns empty object for empty env object', () => {
    expect(resolveEnvTokens({})).toEqual({});
  });

  it('does not modify the original env object', () => {
    process.env.SOME_VAR = 'value';
    const original = { KEY: '${env:SOME_VAR}' };

    resolveEnvTokens(original);

    expect(original.KEY).toBe('${env:SOME_VAR}');
  });

  it('passes through non-string values unchanged', () => {
    const result = resolveEnvTokens({ NUM: 42, BOOL: true, OBJ: { nested: true } });

    expect(result.NUM).toBe(42);
    expect(result.BOOL).toBe(true);
    expect(result.OBJ).toEqual({ nested: true });
  });

  it('does not resolve partial token patterns', () => {
    const result = resolveEnvTokens({
      PARTIAL: 'prefix-${env:VAR}',
      INCOMPLETE: '${env:VAR',
      WRONG_SYNTAX: '$env:VAR',
    });

    expect(result.PARTIAL).toBe('prefix-${env:VAR}');
    expect(result.INCOMPLETE).toBe('${env:VAR');
    expect(result.WRONG_SYNTAX).toBe('$env:VAR');
  });
});
