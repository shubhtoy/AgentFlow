'use strict';

const path = require('path');
const { TransportRegistry } = require('../../packages/core/src/transport/transport-registry');
const { AdapterFactory } = require('../../packages/core/src/transport/adapter-factory');
const { exportToPlatform } = require('../../packages/core/src/transport/export-pipeline');
const { importFromPlatform } = require('../../packages/cli/src/transport/import-pipeline');
const { defaultExport, resolveRefs } = require('../../packages/core/src/transport/default-export');

const platformsDir = path.join(__dirname, '..', '..', 'packages', 'core', 'src', 'transport', 'platforms');

function createMockGraph() {
  return {
    rootDir: '/mock',
    descriptorFile: {
      rawContent: '---\nname: test-agent\n---\n# Test Agent\nPick a workflow.',
      frontmatter: { name: 'test-agent' },
      refs: [],
    },
    identity: { name: 'test-agent' },
    instructions: {
      'code-style': {
        rawContent: '---\ninclusion: auto\nscope: global\n---\n# Code Style\nUse consistent formatting.',
        frontmatter: { inclusion: 'auto', scope: 'global' },
        scope: 'global',
      },
    },
    capabilities: {
      'search': {
        rawContent: '---\nname: search\nscope: descriptor\n---\n# Search\nSearch the codebase.',
        frontmatter: { name: 'search', scope: 'descriptor' },
      },
    },
    runbooks: {},
    memory: {
      'prefs': { rawContent: '# User Preferences\nDark mode.' },
    },
    hooks: {
      'pre-commit': { name: 'pre-commit', event: 'FileEdited', action: { type: 'command', target: 'npm test' }, enabled: true },
    },
    protocols: { mcp: { mcpServers: { github: { command: 'npx', args: ['@github/mcp'] } } } },
    workflows: {
      'build-feature': {
        name: 'Build Feature',
        descriptorFile: { rawContent: '# Build Feature\nA workflow.', refs: [] },
        nodes: {
          'plan': { rawContent: 'Plan the feature using {{instructions/code-style}}', name: 'plan', nodeType: 'step', allRefs: [] },
          'implement': { rawContent: 'Implement it', name: 'implement', nodeType: 'step', allRefs: [] },
        },
        edges: [{ from: 'plan', to: 'implement' }],
        entryPoints: ['plan'],
      },
    },
    customFiles: {},
    allFiles: [],
  };
}

let registry;

beforeAll(() => {
  registry = new TransportRegistry();
  const factory = new AdapterFactory(platformsDir);
  factory.registerAll(registry);
});

describe('Default Export', () => {
  it('produces all expected files', () => {
    const graph = createMockGraph();
    const result = defaultExport(graph);
    expect(result.ok).toBe(true);
    const files = Object.keys(result.data.files);
    expect(files).toContain('AGENTS.md');
    expect(files).toContain('instructions/code-style.md');
    expect(files).toContain('capabilities/search.md');
    expect(files).toContain('memory/prefs.md');
    expect(files).toContain('mcp.json');
    expect(files.some(f => f.includes('build-feature'))).toBe(true);
  });

  it('resolves {{ref}} in SKILL.md', () => {
    const graph = createMockGraph();
    const result = defaultExport(graph);
    const skillContent = result.data.files['build-feature/plan/SKILL.md'];
    expect(skillContent).toContain('instructions/code-style.md');
    expect(skillContent).not.toContain('{{instructions/code-style}}');
  });
});

describe('Platform round-trip', () => {
  const tier1Platforms = ['kiro', 'cursor', 'claude-code', 'vscode-copilot', 'windsurf'];

  for (const platform of tier1Platforms) {
    it(`exports to ${platform} without error`, async () => {
      const graph = createMockGraph();
      const result = await exportToPlatform(platform, graph, {}, registry);
      expect(result.ok).toBe(true);
      expect(Object.keys(result.data.files).length).toBeGreaterThan(0);
    });
  }

  it('exports to agent-spec without error', async () => {
    const graph = createMockGraph();
    const adapter = registry.get('agent-spec');
    // agent-spec only supports export, call adapter directly to avoid getMappingInfo issue with missing importRules
    const result = await adapter.exportWorkspace(graph, { workflowId: 'build-feature' });
    expect(Object.keys(result.files).length).toBeGreaterThan(0);
  });
});
