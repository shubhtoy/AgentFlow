import { describe, it, expect } from 'vitest';
import { classifyResource, identifyPrimaryFile } from '../../packages/core/src/parser-core.js';

function makeFile(frontmatter = {}, relativePath = 'fake/file.md') {
  return { frontmatter, filePath: relativePath, relativePath };
}

describe('classifyResource', () => {
  it('uses frontmatter.type first when it resolves to a schema key', () => {
    expect(classifyResource(makeFile({ type: 'step' }), 'some-wf/node1')).toBe('step');
    expect(classifyResource(makeFile({ type: 'sub-workflow' }), '')).toBe('sub-workflow');
    expect(classifyResource(makeFile({ type: 'agents' }), '')).toBe('agents');
  });

  it('falls back to dir convention when no frontmatter type', () => {
    // classifyResource strips trailing 's' from dir name
    expect(classifyResource(makeFile(), 'capabilities')).toBe('capabilitie');
    expect(classifyResource(makeFile(), 'instructions')).toBe('instruction');
    expect(classifyResource(makeFile(), 'skills')).toBe('skill');
    expect(classifyResource(makeFile(), 'memory')).toBe('memory');
    expect(classifyResource(makeFile(), 'hooks')).toBe('hook');
  });

  it('uses first segment of dirPath for dir inference', () => {
    expect(classifyResource(makeFile(), 'capabilities/sub/deep')).toBe('capabilitie');
    expect(classifyResource(makeFile(), 'instructions/advanced')).toBe('instruction');
  });

  it('files in skills/ are classified as skill', () => {
    expect(classifyResource(makeFile(), 'skills')).toBe('skill');
    expect(classifyResource(makeFile(), 'skills/my-skill')).toBe('skill');
  });

  it('detects AGENTS.md by filename', () => {
    const file = makeFile({}, 'some-wf/AGENTS.md');
    expect(classifyResource(file, 'some-wf')).toBe('agents');
  });

  it('returns untyped for unknown dirs with no frontmatter type', () => {
    expect(classifyResource(makeFile(), '')).toBe('untyped');
    expect(classifyResource(makeFile(), 'custom-dir')).toBe('untyped');
  });
});

describe('identifyPrimaryFile', () => {
  function makeNodeFile(filename, frontmatter = {}) {
    return { filePath: `/fake/node/${filename}`, relativePath: `node/${filename}`, frontmatter };
  }

  it('returns the only file when array has one element', () => {
    const file = makeNodeFile('only.md');
    expect(identifyPrimaryFile([file])).toBe(file);
  });

  it('prefers SKILL.md', () => {
    const a = makeNodeFile('a.md');
    const skill = makeNodeFile('SKILL.md');
    expect(identifyPrimaryFile([a, skill])).toBe(skill);
  });

  it('prefers main.md when no SKILL.md', () => {
    const a = makeNodeFile('a.md');
    const main = makeNodeFile('main.md');
    expect(identifyPrimaryFile([a, main])).toBe(main);
  });

  it('falls back to alphabetical when no SKILL.md or main.md', () => {
    const c = makeNodeFile('charlie.md');
    const a = makeNodeFile('alpha.md');
    expect(identifyPrimaryFile([c, a])).toBe(a);
  });

  it('throws on empty array', () => {
    expect(() => identifyPrimaryFile([])).toThrow();
  });
});
