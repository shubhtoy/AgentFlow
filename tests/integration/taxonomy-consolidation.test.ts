import { describe, it, expect } from 'vitest';
import { parseFromFiles } from '../../packages/core/src/parser-core.js';
import { CANONICAL_CATEGORIES, RESERVED_DIRS } from '../../packages/core/src/taxonomy.js';

function createSampleWorkspace() {
  return {
    'AGENTS.md': '---\ntype: agents\nname: test-workspace\nidentity:\n  name: Test Agent\n  role: assistant\n---\n# Test Workspace',
    'instructions/code-style.md': '---\nname: code-style\n---\n# Code Style\nFollow consistent formatting.',
    'capabilities/read-code.md': '---\nname: read-code\ntype: builtin\n---\n# Read Code',
    'skills/deploy-check/SKILL.md': '---\nname: deploy-check\ndescription: Verify deployment\n---\n# Deploy Check',
    'memory/project-context.md': '---\nname: project-context\n---\n# Project Context',
    'my-workflow/AGENTS.md': '---\ntype: agents\nname: my-workflow\n---\n# My Workflow',
    'my-workflow/step1/SKILL.md': '---\nname: step1\n---\n# Step 1',
  };
}

describe('taxonomy consolidation integration', () => {
  it('graph has all canonical category keys', () => {
    const graph = parseFromFiles(createSampleWorkspace());
    expect(graph.instructions).toBeDefined();
    expect(graph.capabilities).toBeDefined();
    expect(graph.skills).toBeDefined();
    expect(graph.memory).toBeDefined();
    expect(graph.hooks).toBeDefined();
  });

  it('graph has NO legacy keys', () => {
    const graph = parseFromFiles(createSampleWorkspace());
    for (const key of ['tools', 'steering', 'interactions', 'templates', 'runbooks']) {
      expect(graph).not.toHaveProperty(key);
    }
  });

  it('resources are populated correctly', () => {
    const graph = parseFromFiles(createSampleWorkspace());
    expect(Object.keys(graph.instructions)).toContain('code-style');
    expect(Object.keys(graph.capabilities)).toContain('read-code');
    expect(Object.keys(graph.skills)).toContain('deploy-check');
    expect(Object.keys(graph.memory)).toContain('project-context');
  });

  it('workflows are detected', () => {
    const graph = parseFromFiles(createSampleWorkspace());
    expect(Object.keys(graph.workflows)).toContain('my-workflow');
  });

  it('descriptor file is found', () => {
    const graph = parseFromFiles(createSampleWorkspace());
    expect(graph.descriptorFile).toBeDefined();
    expect(graph.descriptorFile.frontmatter.name).toBe('test-workspace');
  });

  it('RESERVED_DIRS matches CANONICAL_CATEGORIES dirs', () => {
    expect(RESERVED_DIRS).toEqual(CANONICAL_CATEGORIES.map(c => c));
  });
});
