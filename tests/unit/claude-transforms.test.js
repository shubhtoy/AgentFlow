'use strict';

const { getTransform, listTransforms } = require('../../packages/core/src/transport/transforms');
const { PlatformMappingConfigSchema } = require('../../packages/core/src/transport/schemas');
const fs = require('fs');
const path = require('path');

// ── Claude transform registration ──

describe('Claude transforms registration', () => {
  const claudeTransformNames = [
    'identity-to-claude-md',
    'claude-md-to-identity',
    'mcp-to-claude-settings',
    'claude-settings-to-mcp',
    'annotate-supplementary-memory',
    'strip-supplementary-annotation',
  ];

  it('all Claude transforms are registered', () => {
    const names = listTransforms();
    for (const name of claudeTransformNames) {
      expect(names).toContain(name);
      expect(getTransform(name)).toBeTypeOf('function');
    }
  });
});

// ── identity-to-claude-md ──

describe('identity-to-claude-md', () => {
  const transform = getTransform('identity-to-claude-md');

  it('strips YAML frontmatter from AGENTS.md string', () => {
    const input = '---\nname: my-agent\nrole: assistant\n---\n# My Agent\n\nDoes things.';
    const result = transform(input);
    expect(result).toBe('# My Agent\n\nDoes things.');
    expect(result).not.toContain('---');
  });

  it('handles object with rawContent', () => {
    const input = { rawContent: '---\ntype: agents\n---\n# Identity' };
    expect(transform(input)).toBe('# Identity');
  });

  it('handles object with content field', () => {
    const input = { content: '---\ntype: agents\n---\nHello world' };
    expect(transform(input)).toBe('Hello world');
  });

  it('returns content unchanged when no frontmatter present', () => {
    expect(transform('# No frontmatter here')).toBe('# No frontmatter here');
  });

  it('handles empty string', () => {
    expect(transform('')).toBe('');
  });
});

// ── claude-md-to-identity ──

describe('claude-md-to-identity', () => {
  const transform = getTransform('claude-md-to-identity');

  it('wraps plain markdown in AGENTS.md frontmatter', () => {
    const input = '# My Agent\n\nDoes things.';
    const result = transform(input);
    expect(result).toBe('---\ntype: agents\n---\n# My Agent\n\nDoes things.');
  });

  it('adds type: agents frontmatter', () => {
    const result = transform('Hello');
    expect(result).toContain('type: agents');
    expect(result).toMatch(/^---\n/);
  });

  it('handles empty string', () => {
    const result = transform('');
    expect(result).toBe('---\ntype: agents\n---\n');
  });
});

// ── Round-trip: identity → claude-md → back to identity ──

describe('identity ↔ claude-md round-trip', () => {
  const toClaudeMd = getTransform('identity-to-claude-md');
  const toIdentity = getTransform('claude-md-to-identity');

  it('preserves content through export → import round-trip', () => {
    const originalContent = '# My Agent\n\nI help with coding tasks.\n\n## Rules\n\n- Be helpful\n- Be concise';
    const agentsMd = `---\ntype: agents\n---\n${originalContent}`;

    const claudeMd = toClaudeMd(agentsMd);
    expect(claudeMd).toBe(originalContent);

    const restored = toIdentity(claudeMd);
    expect(restored).toBe(agentsMd);
  });

  it('round-trip preserves multiline content', () => {
    const body = 'Line 1\nLine 2\nLine 3';
    const exported = toClaudeMd(`---\nname: test\n---\n${body}`);
    const imported = toIdentity(exported);
    expect(imported).toContain(body);
  });
});

// ── mcp-to-claude-settings ──

describe('mcp-to-claude-settings', () => {
  const transform = getTransform('mcp-to-claude-settings');

  it('converts MCP server config to Claude settings format', () => {
    const input = { mcpServers: { 'my-server': { command: 'node', args: ['server.js'] } } };
    const result = JSON.parse(transform(input));
    expect(result.mcpServers).toEqual({ 'my-server': { command: 'node', args: ['server.js'] } });
    expect(result.hooks).toEqual([]);
  });

  it('includes empty hooks array for OpenClaude compatibility', () => {
    const result = JSON.parse(transform({ mcpServers: {} }));
    expect(result).toHaveProperty('hooks');
    expect(Array.isArray(result.hooks)).toBe(true);
  });

  it('handles string input (JSON)', () => {
    const input = JSON.stringify({ mcpServers: { s1: { url: 'http://localhost' } } });
    const result = JSON.parse(transform(input));
    expect(result.mcpServers).toHaveProperty('s1');
  });

  it('handles servers key fallback', () => {
    const input = { servers: { alt: { command: 'python' } } };
    const result = JSON.parse(transform(input));
    expect(result.mcpServers).toHaveProperty('alt');
  });

  it('returns empty structure for invalid JSON string', () => {
    const result = JSON.parse(transform('not-json'));
    expect(result.mcpServers).toEqual({});
    expect(result.hooks).toEqual([]);
  });
});

// ── claude-settings-to-mcp ──

describe('claude-settings-to-mcp', () => {
  const transform = getTransform('claude-settings-to-mcp');

  it('extracts mcpServers from Claude settings', () => {
    const input = JSON.stringify({
      mcpServers: { 'my-server': { command: 'node', args: ['server.js'] } },
      hooks: [{ event: 'onSave' }],
    });
    const result = JSON.parse(transform(input));
    expect(result.mcpServers).toEqual({ 'my-server': { command: 'node', args: ['server.js'] } });
    expect(result).not.toHaveProperty('hooks');
  });

  it('handles object input', () => {
    const input = { mcpServers: { s1: {} }, hooks: [] };
    const result = JSON.parse(transform(input));
    expect(result.mcpServers).toHaveProperty('s1');
  });

  it('returns empty object for invalid JSON', () => {
    expect(transform('bad-json')).toBe('{}');
  });

  it('returns empty mcpServers when none present', () => {
    const result = JSON.parse(transform(JSON.stringify({ hooks: [] })));
    expect(result.mcpServers).toEqual({});
  });
});

// ── MCP round-trip ──

describe('mcp ↔ claude-settings round-trip', () => {
  const toClaudeSettings = getTransform('mcp-to-claude-settings');
  const toMcp = getTransform('claude-settings-to-mcp');

  it('preserves server config through round-trip', () => {
    const servers = { 'code-server': { command: 'npx', args: ['-y', 'server'] } };
    const original = { mcpServers: servers };

    const claudeSettings = toClaudeSettings(original);
    const restored = JSON.parse(toMcp(claudeSettings));

    expect(restored.mcpServers).toEqual(servers);
  });
});

// ── annotate-supplementary-memory ──

describe('annotate-supplementary-memory', () => {
  const transform = getTransform('annotate-supplementary-memory');
  const annotation = '<!-- AgentFlow supplementary memory. This platform has native memory. Adjust prompts as needed. -->';

  it('prepends annotation comment to content', () => {
    const result = transform('# Decisions\n\nWe chose React.');
    expect(result).toMatch(new RegExp(`^${annotation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    expect(result).toContain('# Decisions\n\nWe chose React.');
  });

  it('handles object with rawContent', () => {
    const result = transform({ rawContent: 'Some memory' });
    expect(result).toContain(annotation);
    expect(result).toContain('Some memory');
  });

  it('handles empty content', () => {
    const result = transform('');
    expect(result).toContain(annotation);
  });
});

// ── strip-supplementary-annotation ──

describe('strip-supplementary-annotation', () => {
  const transform = getTransform('strip-supplementary-annotation');
  const annotation = '<!-- AgentFlow supplementary memory. This platform has native memory. Adjust prompts as needed. -->';

  it('removes the supplementary annotation comment', () => {
    const input = `${annotation}\n\n# Decisions\n\nWe chose React.`;
    const result = transform(input);
    expect(result).toBe('# Decisions\n\nWe chose React.');
    expect(result).not.toContain('AgentFlow supplementary memory');
  });

  it('returns content unchanged when no annotation present', () => {
    const input = '# Just content';
    expect(transform(input)).toBe('# Just content');
  });

  it('handles empty string', () => {
    expect(transform('')).toBe('');
  });
});

// ── Memory annotation round-trip ──

describe('memory annotation round-trip', () => {
  const annotate = getTransform('annotate-supplementary-memory');
  const strip = getTransform('strip-supplementary-annotation');

  it('preserves content through annotate → strip round-trip', () => {
    const original = '# Lessons Learned\n\n- Use TypeScript\n- Write tests';
    const annotated = annotate(original);
    const restored = strip(annotated);
    expect(restored).toBe(original);
  });
});

// ── claude.json platform config validation ──

// TODO: Rewrite for claude-code.json platform (claude.json archived to _archive/claude-platform-v1.json)
describe.skip('claude.json platform config', () => {
  const configPath = path.join(__dirname, '../../packages/core/src/transport/platforms/claude-code.json');
  let config;
  beforeAll(() => { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); });

  it('passes schema validation', () => {
    const result = PlatformMappingConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('has memoryHandling set to prefer-native', () => {
    expect(config.memoryHandling).toBe('prefer-native');
  });

  it('has all export rules with fidelity set', () => {
    for (const rule of config.exportRules) {
      expect(rule.fidelity).toBeDefined();
      expect(['direct', 'transform', 'lossy']).toContain(rule.fidelity);
    }
  });

  it('has all import rules with fidelity set', () => {
    for (const rule of config.importRules) {
      expect(rule.fidelity).toBeDefined();
      expect(['direct', 'transform', 'lossy']).toContain(rule.fidelity);
    }
  });

  it('covers all canonical source categories in export rules', () => {
    const sources = config.exportRules.map(r => r.source);
    expect(sources).toContain('identity');
    expect(sources).toContain('protocols.mcp');
    expect(sources).toContain('instructions/*');
    expect(sources).toContain('capabilities/*');
    expect(sources).toContain('runbooks/*');
    expect(sources).toContain('memory/*');
    expect(sources).toContain('hooks/*');
    expect(sources).toContain('customFiles');
  });

  it('has matching import rules for all exported categories', () => {
    const importSources = config.importRules.map(r => r.source);
    expect(importSources).toContain('CLAUDE.md');
    expect(importSources).toContain('.claude/settings.json');
    expect(importSources).toContain('.claude/instructions/*.md');
    expect(importSources).toContain('.claude/tools/*.md');
    expect(importSources).toContain('.claude/runbooks/*.md');
    expect(importSources).toContain('.claude/memory/*.md');
    expect(importSources).toContain('.claude/hooks/*.json');
  });
});
