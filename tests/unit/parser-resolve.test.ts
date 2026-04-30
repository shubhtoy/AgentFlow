import { resolveRef } from '../../packages/cli/src/parser';

function makeFile(relativePath, frontmatter = {}) {
  return {
    filePath: `/root/.agentflow/${relativePath}`,
    relativePath,
    frontmatter,
    title: frontmatter.name || relativePath,
    content: '',
    rawContent: '',
    refs: [],
    resourceType: null,
  };
}

function makeGraph(allFiles = [], workflows = {}) {
  return {
    rootDir: '/root/.agentflow',
    allFiles,
    tools: {},
    skills: {},
    interactions: {},
    templates: {},
    memory: {},
    workflows,
  };
}

describe('resolveRef', () => {
  describe('path-based resolution', () => {
    it('resolves by exact path (category/name.md)', () => {
      const file = makeFile('tools/search.md', { name: 'search' });
      const graph = makeGraph([file]);
      const ref = { raw: 'tools/search', semanticType: 'mention', category: 'tools', name: 'search' };
      const result = resolveRef(ref, graph);
      expect(result).not.toBeNull();
      expect(result.target).toBe(file);
      expect(result.resolvedBy).toBe('path');
    });

    it('returns null for unresolved path', () => {
      const graph = makeGraph([]);
      const ref = { raw: 'tools/missing', semanticType: 'mention', category: 'tools', name: 'missing' };
      const result = resolveRef(ref, graph);
      expect(result).toBeNull();
    });

    it('appends .md when path does not end with .md', () => {
      const file = makeFile('skills/debug.md', { name: 'debug' });
      const graph = makeGraph([file]);
      const ref = { raw: 'skills/debug', semanticType: 'mention', category: 'skills', name: 'debug' };
      const result = resolveRef(ref, graph);
      expect(result).not.toBeNull();
      expect(result.resolvedBy).toBe('path');
    });
  });

  describe('name-based resolution', () => {
    it('resolves by frontmatter name when path does not match', () => {
      const file = makeFile('tools/my-tool.md', { name: 'search' });
      const graph = makeGraph([file]);
      // ref path "tools/search.md" won't match "tools/my-tool.md", but name "search" matches
      const ref = { raw: 'search', semanticType: 'mention', category: 'search', name: '' };
      const result = resolveRef(ref, graph);
      expect(result).not.toBeNull();
      expect(result.resolvedBy).toBe('name');
    });

    it('returns ambiguous when multiple files match by name', () => {
      const file1 = makeFile('tools/a.md', { name: 'search' });
      const file2 = makeFile('skills/b.md', { name: 'search' });
      const graph = makeGraph([file1, file2]);
      const ref = { raw: 'search', semanticType: 'mention', category: 'search', name: '' };
      const result = resolveRef(ref, graph);
      expect(result).not.toBeNull();
      expect(result.resolvedBy).toBe('ambiguous');
      expect(result.matches).toHaveLength(2);
    });
  });

  describe('data_flow resolution', () => {
    it('resolves data_flow ref to a node by id', () => {
      const node = { id: 'analyze', name: 'analyze' };
      const graph = makeGraph([], {
        wf1: { nodes: { analyze: node }, edges: [] },
      });
      const ref = { raw: '<< output.analyze', semanticType: 'data_flow', category: 'output', name: 'analyze' };
      const result = resolveRef(ref, graph);
      expect(result).not.toBeNull();
      expect(result.target).toBe(node);
      expect(result.resolvedBy).toBe('path');
    });

    it('resolves data_flow ref to a node by name', () => {
      const node = { id: 'step-1', name: 'research' };
      const graph = makeGraph([], {
        wf1: { nodes: { 'step-1': node }, edges: [] },
      });
      const ref = { raw: '<< output.research', semanticType: 'data_flow', category: 'output', name: 'research' };
      const result = resolveRef(ref, graph);
      expect(result).not.toBeNull();
      expect(result.target).toBe(node);
    });

    it('returns null for unresolved data_flow ref', () => {
      const graph = makeGraph([], { wf1: { nodes: {}, edges: [] } });
      const ref = { raw: '<< output.missing', semanticType: 'data_flow', category: 'output', name: 'missing' };
      const result = resolveRef(ref, graph);
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns null for null ref', () => {
      expect(resolveRef(null, makeGraph())).toBeNull();
    });

    it('returns null for null graph', () => {
      const ref = { raw: 'tools/x', semanticType: 'mention', category: 'tools', name: 'x' };
      expect(resolveRef(ref, null)).toBeNull();
    });

    it('handles ref with category only (no name)', () => {
      const file = makeFile('readme.md', { name: 'readme' });
      const graph = makeGraph([file]);
      const ref = { raw: 'readme', semanticType: 'mention', category: 'readme', name: '' };
      const result = resolveRef(ref, graph);
      expect(result).not.toBeNull();
    });
  });
});
