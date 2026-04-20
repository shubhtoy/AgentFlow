const path = require('path');
const {
  classifyResource,
  identifyPrimaryFile,
  RESOURCE_TYPE_MAP,
  NODE_TYPE_ALIASES,
} = require('../../packages/cli/src/parser');

describe('classifyResource', () => {
  /** Helper to build a minimal ParsedFile-like object. */
  function makeFile(frontmatter = {}) {
    return { frontmatter, filePath: '/fake/file.md' };
  }

  it('uses frontmatter type when present', () => {
    expect(classifyResource(makeFile({ type: 'tool' }), 'capabilities')).toBe('capability');
    expect(classifyResource(makeFile({ type: 'skill' }), '')).toBe('instruction');
    expect(classifyResource(makeFile({ type: 'template' }), 'memory')).toBe('runbook');
  });

  it('frontmatter type overrides directory inference', () => {
    // File in capabilities/ but frontmatter says skill → normalized to instruction
    expect(classifyResource(makeFile({ type: 'skill' }), 'capabilities')).toBe('instruction');
    // File in memory/ but frontmatter says interaction → normalized to runbook
    expect(classifyResource(makeFile({ type: 'interaction' }), 'memory')).toBe('runbook');
  });

  it('maps node-related types (step, router, sub-workflow) to node', () => {
    expect(classifyResource(makeFile({ type: 'step' }), '')).toBe('node');
    expect(classifyResource(makeFile({ type: 'router' }), '')).toBe('node');
    expect(classifyResource(makeFile({ type: 'sub-workflow' }), '')).toBe('node');
  });

  it('infers type from reserved directory when no frontmatter type', () => {
    expect(classifyResource(makeFile(), 'capabilities')).toBe('capability');
    expect(classifyResource(makeFile(), 'instructions')).toBe('instruction');
    expect(classifyResource(makeFile(), 'runbooks')).toBe('runbook');
    expect(classifyResource(makeFile(), 'memory')).toBe('memory');
    expect(classifyResource(makeFile(), 'hooks')).toBe('hook');
  });

  it('uses first segment of dirPath for directory inference', () => {
    expect(classifyResource(makeFile(), 'capabilities/sub/deep')).toBe('capability');
    expect(classifyResource(makeFile(), 'instructions/advanced')).toBe('instruction');
  });

  it('returns untyped for files outside reserved dirs with no frontmatter type', () => {
    expect(classifyResource(makeFile(), '')).toBe('untyped');
    expect(classifyResource(makeFile(), 'custom-dir')).toBe('untyped');
    expect(classifyResource(makeFile(), 'nodes/my-node')).toBe('untyped');
  });

  it('returns untyped when dirPath is empty or falsy', () => {
    expect(classifyResource(makeFile(), '')).toBe('untyped');
    expect(classifyResource(makeFile(), null)).toBe('untyped');
    expect(classifyResource(makeFile(), undefined)).toBe('untyped');
  });

  it('passes through agents type from frontmatter', () => {
    expect(classifyResource(makeFile({ type: 'agents' }), '')).toBe('agents');
  });

  it('handles frontmatter with other fields but no type', () => {
    expect(classifyResource(makeFile({ name: 'foo', description: 'bar' }), 'capabilities')).toBe('capability');
    expect(classifyResource(makeFile({ name: 'foo' }), 'custom')).toBe('untyped');
  });
});

describe('identifyPrimaryFile', () => {
  /** Helper to build a minimal ParsedFile-like object. */
  function makeFile(filename, frontmatter = {}) {
    return {
      filePath: `/fake/node/${filename}`,
      frontmatter,
    };
  }

  it('returns the only file when array has one element', () => {
    const file = makeFile('only.md');
    expect(identifyPrimaryFile([file])).toBe(file);
  });

  it('selects file with primary:true in frontmatter', () => {
    const a = makeFile('a.md');
    const b = makeFile('b.md', { primary: true });
    const c = makeFile('c.md');
    expect(identifyPrimaryFile([a, b, c])).toBe(b);
  });

  it('falls back to main.md when no primary:true', () => {
    const a = makeFile('a.md');
    const main = makeFile('main.md');
    const z = makeFile('z.md');
    expect(identifyPrimaryFile([z, a, main])).toBe(main);
  });

  it('falls back to alphabetical first when no primary:true and no main.md', () => {
    const c = makeFile('charlie.md');
    const a = makeFile('alpha.md');
    const b = makeFile('bravo.md');
    expect(identifyPrimaryFile([c, a, b])).toBe(a);
  });

  it('primary:true takes precedence over main.md', () => {
    const main = makeFile('main.md');
    const primary = makeFile('instructions.md', { primary: true });
    expect(identifyPrimaryFile([main, primary])).toBe(primary);
  });

  it('primary:true takes precedence over alphabetical order', () => {
    const a = makeFile('aaa.md');
    const z = makeFile('zzz.md', { primary: true });
    expect(identifyPrimaryFile([a, z])).toBe(z);
  });

  it('main.md takes precedence over alphabetical order', () => {
    const a = makeFile('aaa.md');
    const main = makeFile('main.md');
    expect(identifyPrimaryFile([a, main])).toBe(main);
  });

  it('throws on empty array', () => {
    expect(() => identifyPrimaryFile([])).toThrow();
  });

  it('does not treat primary as truthy string — only boolean true', () => {
    const a = makeFile('a.md', { primary: 'true' });
    const b = makeFile('b.md');
    // 'true' (string) !== true (boolean), so falls back to alphabetical
    expect(identifyPrimaryFile([b, a])).toBe(a);
  });
});
