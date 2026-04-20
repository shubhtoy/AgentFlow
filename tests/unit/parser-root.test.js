const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseRoot } = require('../../packages/cli/src/parser');

/**
 * Helper: create a temp directory with a given file tree.
 * tree is an object where keys are relative paths and values are file contents.
 */
function createTempTree(tree) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentflow-root-'));
  for (const [relPath, content] of Object.entries(tree)) {
    const fullPath = path.join(tmpDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
  }
  return tmpDir;
}

function removeTempTree(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('parseRoot', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) removeTempTree(tmpDir);
  });

  it('discovers all .md files and populates allFiles', () => {
    tmpDir = createTempTree({
      'capabilities/hammer.md': '---\nname: hammer\ntype: builtin\n---\n# Hammer',
      'instructions/debug.md': '---\nname: debug\n---\n# Debug',
      'my-workflow/step1/main.md': '# Step 1',
      'my-workflow/step2/main.md': '# Step 2',
    });

    const graph = parseRoot(tmpDir);

    expect(graph.allFiles).toHaveLength(4);
    expect(graph.rootDir).toBe(tmpDir);
  });

  it('classifies capability resources with tool-specific fields', () => {
    tmpDir = createTempTree({
      'capabilities/run-tests.md': '---\nname: run-tests\ntype: script\ncommand: npm test\n---\n# Run Tests',
      'capabilities/read-code.md': '---\nname: read-code\ntype: builtin\nbuiltin_mapping: file_read\n---\n# Read Code',
    });

    const graph = parseRoot(tmpDir);

    expect(Object.keys(graph.capabilities)).toHaveLength(2);
    expect(graph.capabilities['run-tests']).toBeDefined();
    expect(graph.capabilities['run-tests'].toolType).toBe('script');
    expect(graph.capabilities['run-tests'].command).toBe('npm test');
    expect(graph.capabilities['run-tests'].scope).toBe('descriptor');
    expect(graph.capabilities['read-code'].toolType).toBe('builtin');
    expect(graph.capabilities['read-code'].builtinMapping).toBe('file_read');
    expect(graph.capabilities['read-code'].scope).toBe('descriptor');
  });

  it('classifies instructions, runbooks, and memory', () => {
    tmpDir = createTempTree({
      'instructions/search.md': '---\nname: search\n---\n# Search',
      'runbooks/approve.md': '---\nname: approve\ntype: approval\n---\n# Approve',
      'runbooks/is-done.md': '---\nname: is-done\ntype: condition\ncheck: Task is complete\n---\n',
      'memory/facts.md': '# Facts',
    });

    const graph = parseRoot(tmpDir);

    expect(Object.keys(graph.instructions)).toHaveLength(1);
    expect(graph.instructions['search']).toBeDefined();
    expect(graph.instructions['search'].scope).toBe('workflow');
    expect(Object.keys(graph.runbooks)).toHaveLength(2);
    expect(graph.runbooks['approve']).toBeDefined();
    expect(graph.runbooks['approve'].scope).toBe('interaction');
    expect(graph.runbooks['is-done']).toBeDefined();
    expect(graph.runbooks['is-done'].scope).toBe('condition');
    expect(Object.keys(graph.memory)).toHaveLength(1);
    expect(graph.memory['facts']).toBeDefined();
  });

  it('classifies global instructions (steering) with scope: global', () => {
    tmpDir = createTempTree({
      'instructions/code-style.md': '---\ninclusion: auto\ndescription: Code style guidelines\ntags:\n  - style\n  - conventions\n---\n# Code Style\n\n- Use single quotes\n- 2-space indentation',
      'instructions/security.md': '---\ninclusion: manual\ndescription: Security policies\n---\n# Security\n\nAlways validate inputs.',
    });

    const graph = parseRoot(tmpDir);

    expect(graph.instructions).toBeDefined();
    expect(Object.keys(graph.instructions)).toHaveLength(2);
    expect(graph.instructions['code-style']).toBeDefined();
    expect(graph.instructions['code-style'].frontmatter.inclusion).toBe('auto');
    expect(graph.instructions['code-style'].frontmatter.description).toBe('Code style guidelines');
    expect(graph.instructions['code-style'].scope).toBe('global');
    expect(graph.instructions['security']).toBeDefined();
    expect(graph.instructions['security'].frontmatter.inclusion).toBe('manual');
    expect(graph.instructions['security'].scope).toBe('global');

    // Instructions should NOT appear in customFiles
    const customKeys = Object.keys(graph.customFiles);
    expect(customKeys.some(k => k.includes('code-style'))).toBe(false);
    expect(customKeys.some(k => k.includes('security'))).toBe(false);
  });

  it('identifies workflow directories and parses them', () => {
    tmpDir = createTempTree({
      'fix-bug/AGENTS.md': '---\ntype: agents\nname: Fix Bug\n---\n# Fix Bug',
      'fix-bug/reproduce/main.md': '# Reproduce\n\n{{-> fix}}',
      'fix-bug/fix/main.md': '# Fix',
    });

    const graph = parseRoot(tmpDir);

    expect(Object.keys(graph.workflows)).toHaveLength(1);
    expect(graph.workflows['fix-bug']).toBeDefined();
    expect(graph.workflows['fix-bug'].name).toBe('Fix Bug');
    expect(Object.keys(graph.workflows['fix-bug'].nodes)).toHaveLength(2);
  });

  it('detects root-level descriptor file', () => {
    tmpDir = createTempTree({
      'AGENTS.md': '# Root Workspace',
      'my-wf/step1/main.md': '# Step 1',
    });

    const graph = parseRoot(tmpDir);

    expect(graph.descriptorFile).toBeDefined();
    expect(graph.descriptorFile.title).toBe('Root Workspace');
  });

  it('detects root descriptor by type: agents frontmatter', () => {
    tmpDir = createTempTree({
      'workspace.md': '---\ntype: agents\nname: My Workspace\n---\n# Workspace',
      'wf/step/main.md': '# Step',
    });

    const graph = parseRoot(tmpDir);

    expect(graph.descriptorFile).toBeDefined();
    expect(graph.descriptorFile.frontmatter.name).toBe('My Workspace');
  });

  it('does not treat reserved directories as workflows', () => {
    tmpDir = createTempTree({
      'capabilities/hammer.md': '---\nname: hammer\n---\n# Hammer',
      'instructions/debug.md': '# Debug',
      'my-wf/step1/main.md': '# Step 1',
    });

    const graph = parseRoot(tmpDir);

    expect(graph.workflows['capabilities']).toBeUndefined();
    expect(graph.workflows['instructions']).toBeUndefined();
    expect(graph.workflows['my-wf']).toBeDefined();
  });

  it('handles empty root directory', () => {
    tmpDir = createTempTree({
      '.gitkeep': '',
    });

    const graph = parseRoot(tmpDir);

    expect(graph.allFiles).toHaveLength(0);
    expect(Object.keys(graph.capabilities)).toHaveLength(0);
    expect(Object.keys(graph.workflows)).toHaveLength(0);
  });

  it('sets relativePath on all parsed files', () => {
    tmpDir = createTempTree({
      'capabilities/hammer.md': '---\nname: hammer\n---\n# Hammer',
      'my-wf/step1/main.md': '# Step 1',
    });

    const graph = parseRoot(tmpDir);

    const relPaths = graph.allFiles.map((f) => f.relativePath);
    expect(relPaths).toContain('my-wf/step1/main.md');
    expect(relPaths).toContain('capabilities/hammer.md');
  });

  it('supports metadata-only mode', () => {
    tmpDir = createTempTree({
      'capabilities/hammer.md': '---\nname: hammer\ntype: builtin\n---\n# Hammer\n\nSome content with {{instructions/debug}}',
    });

    const graph = parseRoot(tmpDir, 'metadata-only');

    expect(graph.allFiles).toHaveLength(1);
    const file = graph.allFiles[0];
    expect(file.frontmatter.name).toBe('hammer');
    expect(file.content).toBe('');
    expect(file.refs).toHaveLength(0);
  });

  it('preserves ${env:VARIABLE_NAME} tokens without resolving', () => {
    tmpDir = createTempTree({
      'capabilities/api.md': '---\nname: api\ntype: mcp\nmcp: ${env:API_SERVER}\n---\n# API Tool\n\nUse ${env:API_KEY} for auth.',
    });

    const graph = parseRoot(tmpDir);

    const file = graph.allFiles[0];
    expect(file.frontmatter.mcp).toBe('${env:API_SERVER}');
    expect(file.content).toContain('${env:API_KEY}');
  });

  it('handles capability with parameters', () => {
    tmpDir = createTempTree({
      'capabilities/search.md': '---\nname: search\ntype: mcp\nmcp: search-server\nparameters:\n  query:\n    type: string\n    required: true\n  limit:\n    type: integer\n---\n# Search',
    });

    const graph = parseRoot(tmpDir);

    expect(graph.capabilities['search'].toolType).toBe('mcp');
    expect(graph.capabilities['search'].mcp).toBe('search-server');
    expect(graph.capabilities['search'].parameters).toBeDefined();
    expect(graph.capabilities['search'].parameters.query.type).toBe('string');
    expect(graph.capabilities['search'].scope).toBe('descriptor');
  });
});


describe('parseRoot - mcpServers', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) removeTempTree(tmpDir);
  });

  it('produces empty mcpServers when mcp.json does not exist', () => {
    tmpDir = createTempTree({
      'capabilities/hammer.md': '---\nname: hammer\ntype: builtin\n---\n# Hammer',
    });

    const graph = parseRoot(tmpDir);

    expect(graph.mcpServers).toEqual({});
    expect(graph.mcpErrors).toEqual([]);
  });

  it('populates mcpServers from mcp.json', () => {
    const mcpConfig = {
      mcpServers: {
        github: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { GITHUB_TOKEN: '${env:GITHUB_TOKEN}' },
          required: true,
          description: 'GitHub API integration',
        },
      },
    };

    tmpDir = createTempTree({
      '.agentflow/mcp.json': JSON.stringify(mcpConfig, null, 2),
      'capabilities/hammer.md': '---\nname: hammer\ntype: builtin\n---\n# Hammer',
    });

    const graph = parseRoot(tmpDir);

    expect(graph.mcpServers).toBeDefined();
    expect(graph.mcpServers.github).toBeDefined();
    expect(graph.mcpServers.github.command).toBe('npx');
    expect(graph.mcpServers.github.required).toBe(true);
    expect(graph.mcpServers.github.env.GITHUB_TOKEN).toBe('${env:GITHUB_TOKEN}');
    expect(graph.mcpErrors).toEqual([]);
  });

  it('still parses type: mcp capability files correctly alongside mcp.json', () => {
    const mcpConfig = {
      mcpServers: {
        'search-server': {
          command: 'npx',
          args: ['-y', 'search-mcp'],
          env: {},
        },
      },
    };

    tmpDir = createTempTree({
      '.agentflow/mcp.json': JSON.stringify(mcpConfig, null, 2),
      'capabilities/search.md': '---\nname: search\ntype: mcp\nmcp: search-server\nparameters:\n  query:\n    type: string\n    required: true\n---\n# Search Tool',
    });

    const graph = parseRoot(tmpDir);

    // MCP capability file still parsed correctly
    expect(graph.capabilities['search']).toBeDefined();
    expect(graph.capabilities['search'].toolType).toBe('mcp');
    expect(graph.capabilities['search'].mcp).toBe('search-server');
    expect(graph.capabilities['search'].parameters.query.type).toBe('string');

    // mcpServers also populated
    expect(graph.mcpServers['search-server']).toBeDefined();
  });

  it('returns mcpErrors for malformed mcp.json', () => {
    tmpDir = createTempTree({
      '.agentflow/mcp.json': '{ invalid json',
      'capabilities/hammer.md': '---\nname: hammer\ntype: builtin\n---\n# Hammer',
    });

    const graph = parseRoot(tmpDir);

    expect(graph.mcpServers).toEqual({});
    expect(graph.mcpErrors.length).toBeGreaterThan(0);
  });
});

describe('parseRoot - customFiles', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) removeTempTree(tmpDir);
  });

  it('collects untyped .md files into customFiles', () => {
    tmpDir = createTempTree({
      'capabilities/hammer.md': '---\nname: hammer\ntype: builtin\n---\n# Hammer',
      'docs/readme.md': '# Project Readme',
      'notes/design.md': '# Design Notes',
    });

    const graph = parseRoot(tmpDir);

    expect(graph.customFiles).toBeDefined();
    expect(Object.keys(graph.customFiles).length).toBeGreaterThanOrEqual(2);
    // docs/readme and notes/design should be in customFiles (keyed without .md)
    expect(graph.customFiles['docs/readme']).toBeDefined();
    expect(graph.customFiles['notes/design']).toBeDefined();
  });

  it('does not include typed resources in customFiles', () => {
    tmpDir = createTempTree({
      'capabilities/hammer.md': '---\nname: hammer\ntype: builtin\n---\n# Hammer',
      'instructions/debug.md': '---\nname: debug\n---\n# Debug',
      'docs/readme.md': '# Readme',
    });

    const graph = parseRoot(tmpDir);

    // hammer and debug should NOT be in customFiles
    const customKeys = Object.keys(graph.customFiles);
    expect(customKeys.some(k => k.includes('hammer'))).toBe(false);
    expect(customKeys.some(k => k.includes('debug'))).toBe(false);
    // readme should be in customFiles
    expect(graph.customFiles['docs/readme']).toBeDefined();
  });

  it('does not include workflow node files in customFiles', () => {
    tmpDir = createTempTree({
      'my-wf/step1/main.md': '# Step 1',
      'my-wf/step2/main.md': '# Step 2',
      'docs/guide.md': '# Guide',
    });

    const graph = parseRoot(tmpDir);

    const customKeys = Object.keys(graph.customFiles);
    expect(customKeys.some(k => k.includes('step1'))).toBe(false);
    expect(customKeys.some(k => k.includes('step2'))).toBe(false);
    expect(graph.customFiles['docs/guide']).toBeDefined();
  });

  it('resolves refs to arbitrary file paths', () => {
    const { resolveRef } = require('../../packages/cli/src/parser');

    tmpDir = createTempTree({
      'docs/architecture.md': '# Architecture',
      'notes/deep/nested/file.md': '# Nested File',
    });

    const graph = parseRoot(tmpDir);

    // Resolve {{docs/architecture}}
    const ref1 = { raw: 'docs/architecture', semanticType: 'mention', category: 'docs', name: 'architecture' };
    const result1 = resolveRef(ref1, graph);
    expect(result1).not.toBeNull();
    expect(result1.target.relativePath).toBe('docs/architecture.md');

    // Resolve {{notes/deep/nested/file}}
    const ref2 = { raw: 'notes/deep/nested/file', semanticType: 'mention', category: 'notes', name: 'deep/nested/file' };
    const result2 = resolveRef(ref2, graph);
    expect(result2).not.toBeNull();
    expect(result2.target.relativePath).toBe('notes/deep/nested/file.md');
  });

  it('handles root-level untyped .md files in customFiles', () => {
    tmpDir = createTempTree({
      'readme.md': '# Readme',
      'changelog.md': '# Changelog',
      'capabilities/hammer.md': '---\nname: hammer\ntype: builtin\n---\n# Hammer',
    });

    const graph = parseRoot(tmpDir);

    expect(graph.customFiles['readme']).toBeDefined();
    expect(graph.customFiles['changelog']).toBeDefined();
  });
});

describe('parseRoot - hooks', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) removeTempTree(tmpDir);
  });

  it('loads valid hook JSON files into graph.hooks keyed by filename stem', () => {
    const hook1 = {
      name: 'validate-on-save',
      event: 'fileEdited',
      action: { type: 'trigger-workflow', target: 'build-feature', params: {} },
      enabled: true,
    };
    const hook2 = {
      name: 'lint-on-create',
      event: 'fileCreated',
      action: { type: 'run-script', target: 'lint', params: {} },
      enabled: false,
    };

    tmpDir = createTempTree({
      'hooks/validate-on-save.json': JSON.stringify(hook1),
      'hooks/lint-on-create.json': JSON.stringify(hook2),
      'capabilities/hammer.md': '---\nname: hammer\ntype: builtin\n---\n# Hammer',
    });

    const graph = parseRoot(tmpDir);

    expect(graph.hooks).toBeDefined();
    expect(Object.keys(graph.hooks)).toHaveLength(2);
    expect(graph.hooks['validate-on-save']).toEqual(hook1);
    expect(graph.hooks['lint-on-create']).toEqual(hook2);
  });

  it('skips invalid JSON files with a warning and loads valid ones', () => {
    const validHook = {
      name: 'good-hook',
      event: 'fileEdited',
      action: { type: 'log', target: 'console', params: {} },
      enabled: true,
    };

    tmpDir = createTempTree({
      'hooks/good-hook.json': JSON.stringify(validHook),
      'hooks/bad-hook.json': '{ this is not valid json !!!',
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const graph = parseRoot(tmpDir);

    expect(graph.hooks).toBeDefined();
    expect(Object.keys(graph.hooks)).toHaveLength(1);
    expect(graph.hooks['good-hook']).toEqual(validHook);
    expect(graph.hooks['bad-hook']).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('bad-hook.json'));

    warnSpy.mockRestore();
  });

  it('returns empty hooks when hooks/ directory does not exist', () => {
    tmpDir = createTempTree({
      'capabilities/hammer.md': '---\nname: hammer\ntype: builtin\n---\n# Hammer',
    });

    const graph = parseRoot(tmpDir);

    expect(graph.hooks).toBeDefined();
    expect(Object.keys(graph.hooks)).toHaveLength(0);
  });

  it('ignores non-JSON files in hooks/ directory', () => {
    const hook = { name: 'my-hook', event: 'fileEdited', enabled: true };

    tmpDir = createTempTree({
      'hooks/my-hook.json': JSON.stringify(hook),
      'hooks/readme.txt': 'This is not a hook',
      'hooks/notes.md': '# Notes',
    });

    const graph = parseRoot(tmpDir);

    expect(Object.keys(graph.hooks)).toHaveLength(1);
    expect(graph.hooks['my-hook']).toEqual(hook);
  });
});

describe('parseRoot - canonical graph shape', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) removeTempTree(tmpDir);
  });

  it('graph has all canonical keys and no legacy keys', () => {
    tmpDir = createTempTree({
      'AGENTS.md': '# Root',
      'instructions/search.md': '---\nname: search\n---\n# Search',
      'capabilities/hammer.md': '---\nname: hammer\ntype: builtin\n---\n# Hammer',
      'runbooks/approve.md': '---\nname: approve\n---\n# Approve',
      'memory/facts.md': '# Facts',
      'my-wf/step1/main.md': '# Step 1',
    });

    const graph = parseRoot(tmpDir);

    // Canonical keys present
    expect(graph).toHaveProperty('rootDir');
    expect(graph).toHaveProperty('descriptorFile');
    expect(graph).toHaveProperty('identity');
    expect(graph).toHaveProperty('instructions');
    expect(graph).toHaveProperty('capabilities');
    expect(graph).toHaveProperty('runbooks');
    expect(graph).toHaveProperty('memory');
    expect(graph).toHaveProperty('hooks');
    expect(graph).toHaveProperty('customFiles');
    expect(graph).toHaveProperty('workflows');
    expect(graph).toHaveProperty('allFiles');
    expect(graph).toHaveProperty('mcpServers');
    expect(graph).toHaveProperty('mcpErrors');

    // Legacy keys absent
    expect(graph).not.toHaveProperty('tools');
    expect(graph).not.toHaveProperty('skills');
    expect(graph).not.toHaveProperty('steering');
    expect(graph).not.toHaveProperty('interactions');
    expect(graph).not.toHaveProperty('templates');
  });

  it('scope inference works on parsed files', () => {
    tmpDir = createTempTree({
      'instructions/skill-file.md': '---\nname: skill-file\n---\n# A Skill',
      'instructions/steering-file.md': '---\nname: steering-file\ninclusion: auto\n---\n# Steering',
      'capabilities/tool-file.md': '---\nname: tool-file\ntype: mcp\n---\n# Tool',
      'runbooks/interaction-file.md': '---\nname: interaction-file\n---\n# Interaction',
      'runbooks/condition-file.md': '---\nname: condition-file\ntype: condition\n---\n# Condition',
    });

    const graph = parseRoot(tmpDir);

    expect(graph.instructions['skill-file'].scope).toBe('workflow');
    expect(graph.instructions['steering-file'].scope).toBe('global');
    expect(graph.capabilities['tool-file'].scope).toBe('descriptor');
    expect(graph.runbooks['interaction-file'].scope).toBe('interaction');
    expect(graph.runbooks['condition-file'].scope).toBe('condition');
  });

  it('old directory names (tools/, skills/) fall into customFiles', () => {
    tmpDir = createTempTree({
      'tools/hammer.md': '---\nname: hammer\ntype: builtin\n---\n# Hammer',
      'skills/debug.md': '---\nname: debug\n---\n# Debug',
      'steering/code-style.md': '---\ninclusion: auto\n---\n# Code Style',
      'interactions/approve.md': '---\nname: approve\n---\n# Approve',
      'templates/is-done.md': '---\nname: is-done\ntype: condition\n---\n# Done',
    });

    const graph = parseRoot(tmpDir);

    // Old dirs are NOT recognized — files go to customFiles
    expect(Object.keys(graph.capabilities)).toHaveLength(0);
    expect(Object.keys(graph.instructions)).toHaveLength(0);
    expect(Object.keys(graph.runbooks)).toHaveLength(0);

    // They should be in customFiles
    const customKeys = Object.keys(graph.customFiles);
    expect(customKeys.length).toBeGreaterThanOrEqual(5);
  });
});
