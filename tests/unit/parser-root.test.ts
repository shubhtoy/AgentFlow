import { describe, it, expect } from 'vitest';
import { parseFromFiles } from '../../packages/core/src/parser-core.js';

describe('parseFromFiles', () => {
  it('output has skills key, no runbooks key', () => {
    const graph = parseFromFiles({
      'AGENTS.md': '---\ntype: agents\nname: test\n---\n# Test',
    });
    expect(graph).toHaveProperty('skills');
    expect(graph).not.toHaveProperty('runbooks');
  });

  it('populates instructions, capabilities, memory from reserved dirs', () => {
    const graph = parseFromFiles({
      'instructions/debug.md': '---\nname: debug\n---\n# Debug',
      'capabilities/hammer.md': '---\nname: hammer\ntype: builtin\n---\n# Hammer',
      'memory/facts.md': '---\nname: facts\n---\n# Facts',
    });
    expect(Object.keys(graph.instructions)).toContain('debug');
    expect(Object.keys(graph.capabilities)).toContain('hammer');
    expect(Object.keys(graph.memory)).toContain('facts');
  });

  it('detects skills from skills/<id>/SKILL.md directory structure', () => {
    const graph = parseFromFiles({
      'skills/deploy/SKILL.md': '---\nname: deploy\ndescription: Deploy stuff\n---\n# Deploy',
    });
    expect(Object.keys(graph.skills)).toContain('deploy');
    expect(graph.skills['deploy'].name).toBe('deploy');
  });

  it('detects root descriptor from AGENTS.md', () => {
    const graph = parseFromFiles({
      'AGENTS.md': '---\ntype: agents\nname: My Workspace\n---\n# Workspace',
    });
    expect(graph.descriptorFile).toBeDefined();
    expect(graph.descriptorFile.frontmatter.name).toBe('My Workspace');
  });

  it('resolves AGENTS.md refs for workspace', () => {
    const graph = parseFromFiles({
      'AGENTS.md': '---\ntype: agents\n---\n# Root\n\nUse {{instructions/style}}',
      'instructions/style.md': '---\nname: style\n---\n# Style',
    });
    expect(graph.resolvedIdentityRefs.workspace.length).toBeGreaterThan(0);
    expect(graph.resolvedIdentityRefs.workspace[0].name).toBe('style');
  });

  it('infers router from conditional edges', () => {
    const graph = parseFromFiles({
      'my-wf/AGENTS.md': '---\ntype: agents\nname: wf\n---\n# WF',
      'my-wf/triage/SKILL.md': '# Triage\n\n{{-> fix | bug found}}\n{{-> close | no bug}}',
      'my-wf/fix/SKILL.md': '# Fix',
      'my-wf/close/SKILL.md': '# Close',
    });
    const wf = graph.workflows['my-wf'];
    expect(wf).toBeDefined();
    expect(wf.nodes['triage'].isRouter).toBe(true);
    expect(wf.nodes['fix'].isRouter).toBe(false);
  });

  it('does not treat reserved dirs as workflows', () => {
    const graph = parseFromFiles({
      'capabilities/hammer.md': '---\nname: hammer\n---\n# Hammer',
      'instructions/debug.md': '# Debug',
      'my-wf/step1/SKILL.md': '# Step 1',
    });
    expect(graph.workflows['capabilities']).toBeUndefined();
    expect(graph.workflows['instructions']).toBeUndefined();
  });

  it('collects untyped files into customFiles', () => {
    const graph = parseFromFiles({
      'docs/readme.md': '# Readme',
      'capabilities/hammer.md': '---\nname: hammer\ntype: builtin\n---\n# Hammer',
    });
    expect(graph.customFiles['docs/readme']).toBeDefined();
    expect(Object.keys(graph.customFiles).some(k => k.includes('hammer'))).toBe(false);
  });

  it('supports metadata-only mode', () => {
    const graph = parseFromFiles({
      'capabilities/hammer.md': '---\nname: hammer\n---\n# Hammer\n\n{{instructions/debug}}',
    }, 'metadata-only');
    expect(graph.allFiles[0].content).toBe('');
    expect(graph.allFiles[0].refs).toHaveLength(0);
  });

  it('graph has all canonical keys', () => {
    const graph = parseFromFiles({ 'AGENTS.md': '# Root' });
    for (const key of ['rootDir', 'descriptorFile', 'identity', 'instructions',
      'capabilities', 'skills', 'memory', 'hooks', 'customFiles', 'workflows',
      'allFiles', 'mcpServers', 'mcpErrors']) {
      expect(graph).toHaveProperty(key);
    }
    expect(graph).not.toHaveProperty('runbooks');
  });
});
