import { describe, it, expect } from 'vitest';
import { TRANSFORM_REGISTRY } from '../../packages/cli/src/export/transforms/index.js';
import { getPlatformConfig, listPlatforms } from '../../packages/cli/src/export/engine.js';

describe('transform registry', () => {
  it('has all expected transforms registered', () => {
    const expected = ['copy', 'rename', 'to-mdc', 'concatenate', 'flatten-skill', 'split-identity', 'merge-mcp-config', 'to-skill-dir'];
    for (const name of expected) {
      expect(TRANSFORM_REGISTRY[name], `missing transform: ${name}`).toBeTypeOf('function');
    }
  });
});

describe('platform configs', () => {
  it('claude-code config has expected structure', () => {
    const config = getPlatformConfig('claude-code');
    expect(config).not.toBeNull();
    expect(config.id).toBe('claude-code');
    expect(config.mapping).toBeDefined();
    expect(config.mapping.identity).toBeDefined();
    expect(config.mapping.instructions).toBeDefined();
  });

  it('all platform configs have id and mapping', () => {
    for (const id of listPlatforms()) {
      const config = getPlatformConfig(id);
      expect(config.id, `${id} missing id`).toBe(id);
      expect(config.mapping, `${id} missing mapping`).toBeDefined();
    }
  });
});

describe('copy transform', () => {
  const copy = TRANSFORM_REGISTRY['copy'];

  it('copies rawContent to target path', () => {
    const file = { rawContent: '# Hello', relativePath: 'instructions/hello.md' };
    const result = copy(file, { name: 'hello', targetPattern: 'output/{name}.md', config: {} });
    expect(result['output/hello.md']).toBe('# Hello');
  });
});

describe('rename transform', () => {
  const rename = TRANSFORM_REGISTRY['rename'];

  it('renames file to target path', () => {
    const file = { rawContent: '# Identity', relativePath: 'AGENTS.md' };
    const result = rename(file, { name: 'identity', targetPattern: 'CLAUDE.md', config: {} });
    expect(result['CLAUDE.md']).toBe('# Identity');
  });
});

describe('concatenate transform', () => {
  const concatenate = TRANSFORM_REGISTRY['concatenate'];

  it('concatenates multiple files', () => {
    const files = [
      { title: 'A', content: 'Content A', frontmatter: { name: 'a' } },
      { title: 'B', content: 'Content B', frontmatter: { name: 'b' } },
    ];
    const result = concatenate(files, 'output.md');
    expect(result['output.md']).toContain('Content A');
    expect(result['output.md']).toContain('Content B');
  });
});
