'use strict';

const { TransportRegistry } = require('../../packages/core/src/transport/transport-registry');
const { PlatformAdapter } = require('../../packages/core/src/transport/platform-adapter');
const { AdapterFactory } = require('../../packages/core/src/transport/adapter-factory');
const { resolveGraphSource, matchGlob, extractName, deepMerge } = require('../../packages/core/src/transport/utils');
const { getTransform, listTransforms } = require('../../packages/core/src/transport/transforms');
const { PlatformMappingConfigSchema } = require('../../packages/core/src/transport/schemas');
const path = require('path');

// ── TransportRegistry ──

describe('TransportRegistry', () => {
  let registry;
  beforeEach(() => { registry = new TransportRegistry(); });

  it('registers and retrieves an adapter', () => {
    const adapter = { name: 'test', displayName: 'Test', version: '1.0.0', capabilities: ['export'] };
    registry.register(adapter);
    expect(registry.get('test')).toBe(adapter);
    expect(registry.supports('test')).toBe(true);
  });

  it('rejects duplicate names', () => {
    registry.register({ name: 'dup', displayName: 'D', version: '1', capabilities: [] });
    expect(() => registry.register({ name: 'dup', displayName: 'D2', version: '1', capabilities: [] }))
      .toThrow('already registered');
  });

  it('returns null for unknown adapter', () => {
    expect(registry.get('nope')).toBeNull();
    expect(registry.supports('nope')).toBe(false);
  });

  it('lists all registered adapters', () => {
    registry.register({ name: 'a', displayName: 'A', version: '1', capabilities: ['export'] });
    registry.register({ name: 'b', displayName: 'B', version: '1', capabilities: ['import'] });
    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map(l => l.name)).toEqual(['a', 'b']);
  });
});

// ── Utils ──

describe('resolveGraphSource', () => {
  const graph = {
    descriptorFile: { name: 'test' },
    instructions: { 'code-style': { content: 'x' } },
    hooks: { 'hook1': { event: 'fileEdited' } },
    workflows: {},
  };

  it('resolves identity', () => {
    expect(resolveGraphSource(graph, 'identity')).toEqual({ name: 'test' });
  });

  it('resolves glob patterns', () => {
    expect(resolveGraphSource(graph, 'instructions/*')).toEqual(graph.instructions);
  });

  it('returns null for missing sections', () => {
    expect(resolveGraphSource(graph, 'capabilities/*')).toBeNull();
  });
});

describe('matchGlob', () => {
  it('matches files against a glob pattern', () => {
    const files = { '.kiro/instructions/a.md': 'x', '.kiro/instructions/b.md': 'y', '.kiro/hooks/h.json': 'z' };
    const matched = matchGlob(files, '.kiro/instructions/*.md');
    expect(Object.keys(matched)).toEqual(['.kiro/instructions/a.md', '.kiro/instructions/b.md']);
  });
});

describe('extractName', () => {
  it('extracts name from path', () => {
    expect(extractName('.kiro/instructions/code-style.md', '.kiro/instructions/*.md')).toBe('code-style');
  });
});

describe('deepMerge', () => {
  it('merges nested objects with override winning', () => {
    const base = { a: 1, b: { c: 2, d: 3 } };
    const override = { b: { c: 99 }, e: 5 };
    expect(deepMerge(base, override)).toEqual({ a: 1, b: { c: 99, d: 3 }, e: 5 });
  });

  it('override replaces arrays', () => {
    expect(deepMerge({ a: [1, 2] }, { a: [3] })).toEqual({ a: [3] });
  });
});

// ── Transforms ──

describe('transforms', () => {
  it('lists all registered transforms', () => {
    const names = listTransforms();
    expect(names).toContain('markdown-passthrough');
    expect(names).toContain('mcp-extract-servers');
    expect(names).toContain('workflow-to-copilot-instructions');
  });

  it('markdown-passthrough returns string content', () => {
    const fn = getTransform('markdown-passthrough');
    expect(fn('hello')).toBe('hello');
    expect(fn({ rawContent: '# Title' })).toBe('# Title');
  });

  it('json-passthrough handles objects', () => {
    const fn = getTransform('json-passthrough');
    expect(fn({ a: 1 })).toBe(JSON.stringify({ a: 1 }, null, 2));
  });

  it('ensure-instruction-frontmatter adds frontmatter', () => {
    const fn = getTransform('ensure-instruction-frontmatter');
    expect(fn('# Hello')).toContain('---\ninclusion: manual\n---');
  });

  it('mcp-extract-servers extracts servers', () => {
    const fn = getTransform('mcp-extract-servers');
    const result = JSON.parse(fn({ mcpServers: { s1: {} } }));
    expect(result.mcpServers).toHaveProperty('s1');
  });
});

// ── PlatformAdapter engine ──

describe('PlatformAdapter', () => {
  const config = {
    name: 'test',
    displayName: 'Test Platform',
    version: '1.0.0',
    capabilities: ['export', 'import'],
    exportRules: [
      { source: 'instructions/*', target: 'out/{name}.md', type: 'glob-copy', fidelity: 'direct', transform: 'markdown-passthrough' },
      { source: 'capabilities/*', target: null, type: 'skip', fidelity: 'skip', transform: 'markdown-passthrough' },
    ],
    importRules: [
      { source: 'in/*.md', target: 'instructions/{name}.md', type: 'glob-copy', fidelity: 'direct', transform: 'ensure-instruction-frontmatter' },
    ],
  };

  it('exports workspace using config rules', async () => {
    const adapter = new PlatformAdapter(config);
    const graph = { instructions: { 'style': { rawContent: '# Style' } }, capabilities: { 'lint': {} } };
    const result = await adapter.exportWorkspace(graph);
    expect(result.files['out/style.md']).toBe('# Style');
    expect(result.warnings.length).toBeGreaterThan(0); // capabilities skipped
  });

  it('imports workspace using config rules', async () => {
    const adapter = new PlatformAdapter(config);
    const sourceFiles = { 'in/guide.md': '# Guide' };
    const result = await adapter.importWorkspace(sourceFiles);
    expect(result.files['instructions/guide.md']).toContain('inclusion: manual');
  });

  it('getMappingInfo returns config-derived info', () => {
    const adapter = new PlatformAdapter(config);
    const info = adapter.getMappingInfo();
    expect(info.platform).toBe('test');
    expect(info.exportMappings).toHaveLength(2);
    expect(info.importMappings).toHaveLength(1);
  });
});

// ── Schema validation ──

describe('PlatformMappingConfigSchema', () => {
  it('validates a correct config', () => {
    const config = {
      name: 'test', displayName: 'Test', version: '1.0.0',
      capabilities: ['export'],
      exportRules: [{ source: 'x', target: 'y', type: 'single-file', fidelity: 'direct', transform: 'markdown-passthrough' }],
      importRules: [],
    };
    expect(PlatformMappingConfigSchema.safeParse(config).success).toBe(true);
  });

  it('rejects config with missing name', () => {
    const config = { displayName: 'T', capabilities: [], exportRules: [], importRules: [] };
    expect(PlatformMappingConfigSchema.safeParse(config).success).toBe(false);
  });
});

// ── AdapterFactory ──

describe('AdapterFactory', () => {
  it('loads built-in platform configs', () => {
    const builtInDir = path.join(__dirname, '../../src/transport/platforms');
    const factory = new AdapterFactory(builtInDir);
    const adapters = factory.loadAll();
    expect(adapters.length).toBeGreaterThanOrEqual(2);
    expect(adapters.map(a => a.name)).toContain('kiro');
    expect(adapters.map(a => a.name)).toContain('vscode-copilot');
  });

  it('registers all adapters into a registry', () => {
    const builtInDir = path.join(__dirname, '../../src/transport/platforms');
    const factory = new AdapterFactory(builtInDir);
    const registry = new TransportRegistry();
    factory.registerAll(registry);
    expect(registry.supports('kiro')).toBe(true);
    expect(registry.supports('vscode-copilot')).toBe(true);
  });
});
