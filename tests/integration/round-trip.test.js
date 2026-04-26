import { describe, it, expect } from 'vitest';
import { parseFromFiles } from '../../packages/core/src/parser-core.js';
import { exportForPlatform, listPlatforms } from '../../packages/cli/src/export/engine.js';

function createMockGraph() {
  return parseFromFiles({
    'AGENTS.md': '---\ntype: agents\nname: test-agent\n---\n# Test Agent\nPick a workflow.',
    'instructions/code-style.md': '---\nname: code-style\n---\n# Code Style\nUse consistent formatting.',
    'capabilities/search.md': '---\nname: search\ntype: mcp\nmcp: search-server\n---\n# Search',
    'skills/deploy/SKILL.md': '---\nname: deploy\ndescription: Deploy stuff\n---\n# Deploy',
    'memory/prefs.md': '---\nname: prefs\n---\n# Preferences',
    'build-feature/AGENTS.md': '---\ntype: agents\nname: Build Feature\n---\n# Build Feature',
    'build-feature/plan/SKILL.md': '---\nname: plan\n---\n# Plan\n\nPlan the feature.',
    'build-feature/implement/SKILL.md': '---\nname: implement\n---\n# Implement',
  });
}

describe('export engine', () => {
  it('listPlatforms returns available platforms', () => {
    const platforms = listPlatforms();
    expect(platforms.length).toBeGreaterThan(0);
    expect(platforms).toContain('claude-code');
  });

  it('exports to claude-code without error', () => {
    const graph = createMockGraph();
    const files = exportForPlatform(graph, 'claude-code');
    expect(Object.keys(files).length).toBeGreaterThan(0);
    expect(files['CLAUDE.md']).toBeDefined();
  });

  it('exports to kiro without error', () => {
    const graph = createMockGraph();
    const files = exportForPlatform(graph, 'kiro');
    expect(Object.keys(files).length).toBeGreaterThan(0);
  });

  it('exports to cursor without error', () => {
    const graph = createMockGraph();
    const files = exportForPlatform(graph, 'cursor');
    expect(Object.keys(files).length).toBeGreaterThan(0);
  });

  it('throws for unknown platform', () => {
    const graph = createMockGraph();
    expect(() => exportForPlatform(graph, 'nonexistent')).toThrow(/Unknown platform/);
  });
});
