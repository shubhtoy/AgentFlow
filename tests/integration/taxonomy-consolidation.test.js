'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const { parseRoot } = require('../../src/parser');
const { validate } = require('../../src/validator');
const { TransportRegistry } = require('../../src/transport/transport-registry');
const { AdapterFactory } = require('../../src/transport/adapter-factory');
const { exportToPlatform } = require('../../src/transport/export-pipeline');
const { importFromPlatform } = require('../../src/transport/import-pipeline');
const { CANONICAL_CATEGORIES, RESERVED_DIRS } = require('../../src/taxonomy');

const ROOT_DIR = path.join(__dirname, '../..');
const PLATFORMS_DIR = path.join(ROOT_DIR, 'src/transport/platforms');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'taxonomy-integ-'));
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/** Legacy category names that must NOT appear as graph keys. */
const LEGACY_KEYS = ['tools', 'skills', 'steering', 'interactions', 'templates'];

/**
 * Create a minimal canonical workspace for testing.
 * Uses canonical directory names only.
 */
function createCanonicalWorkspace(dir) {
  const afDir = dir;
  // instructions
  const instrDir = path.join(afDir, 'instructions');
  fs.mkdirSync(instrDir, { recursive: true });
  fs.writeFileSync(path.join(instrDir, 'code-style.md'),
    '---\nname: code-style\ninclusion: auto\n---\n# Code Style\n\nFollow consistent formatting.\n', 'utf-8');

  // capabilities
  const capDir = path.join(afDir, 'capabilities');
  fs.mkdirSync(capDir, { recursive: true });
  fs.writeFileSync(path.join(capDir, 'read-code.md'),
    '---\nname: read-code\ntype: builtin\nbuiltin_mapping: readCode\n---\n# Read Code\n\nReads source files.\n', 'utf-8');

  // runbooks
  const rbDir = path.join(afDir, 'runbooks');
  fs.mkdirSync(rbDir, { recursive: true });
  fs.writeFileSync(path.join(rbDir, 'deploy-check.md'),
    '---\nname: deploy-check\n---\n# Deploy Check\n\nVerify deployment readiness.\n', 'utf-8');

  // memory
  const memDir = path.join(afDir, 'memory');
  fs.mkdirSync(memDir, { recursive: true });
  fs.writeFileSync(path.join(memDir, 'project-context.md'),
    '---\nname: project-context\n---\n# Project Context\n\nKey project details.\n', 'utf-8');

  // hooks
  const hooksDir = path.join(afDir, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.writeFileSync(path.join(hooksDir, 'on-save.json'),
    JSON.stringify({ name: 'on-save', event: 'fileEdited', action: { type: 'log', target: 'console' }, enabled: true }), 'utf-8');

  // AGENTS.md descriptor
  fs.writeFileSync(path.join(afDir, 'AGENTS.md'),
    '---\nname: test-workspace\ntype: agents\nidentity:\n  name: Test Agent\n  role: assistant\n---\n# Test Workspace\n', 'utf-8');

  // A simple workflow
  const wfDir = path.join(afDir, 'my-workflow');
  fs.mkdirSync(wfDir, { recursive: true });
  fs.writeFileSync(path.join(wfDir, 'AGENTS.md'),
    '---\ntype: agents\nname: my-workflow\n---\n# My Workflow\n', 'utf-8');
  const stepDir = path.join(wfDir, 'step1');
  fs.mkdirSync(stepDir, { recursive: true });
  fs.writeFileSync(path.join(stepDir, 'SKILL.md'),
    '---\nname: step1\nagent: worker\n---\n# Step 1\n\nDo the thing.\n', 'utf-8');

  return afDir;
}

// ── 11.1: Parse workspace → verify canonical graph shape ──

describe('11.1: Parse canonical workspace — no legacy keys', () => {
  let dir;
  let graph;

  beforeAll(() => {
    dir = tmpDir();
    createCanonicalWorkspace(dir);
    graph = parseRoot(dir);
  });

  afterAll(() => cleanDir(dir));

  it('graph has all canonical category keys', () => {
    expect(graph.instructions).toBeDefined();
    expect(graph.capabilities).toBeDefined();
    expect(graph.runbooks).toBeDefined();
    expect(graph.memory).toBeDefined();
    expect(graph.hooks).toBeDefined();
  });

  it('graph has NO legacy keys', () => {
    for (const key of LEGACY_KEYS) {
      expect(graph).not.toHaveProperty(key);
    }
  });

  it('resources are populated correctly', () => {
    expect(Object.keys(graph.instructions)).toContain('code-style');
    expect(Object.keys(graph.capabilities)).toContain('read-code');
    expect(Object.keys(graph.runbooks)).toContain('deploy-check');
    expect(Object.keys(graph.memory)).toContain('project-context');
  });

  it('hooks are loaded from JSON files', () => {
    expect(Object.keys(graph.hooks)).toContain('on-save');
  });

  it('workflows are detected', () => {
    expect(Object.keys(graph.workflows)).toContain('my-workflow');
  });

  it('scope is inferred for instructions', () => {
    const codeStyle = graph.instructions['code-style'];
    expect(codeStyle.scope).toBe('global'); // has inclusion: auto
  });

  it('scope is inferred for capabilities', () => {
    const readCode = graph.capabilities['read-code'];
    expect(readCode.scope).toBe('descriptor'); // type: builtin
  });
});

// ── 11.2: Export to all 3 platforms ──

describe('11.2: Export to all 3 platforms — no drops', () => {
  let dir;
  let graph;
  let registry;

  beforeAll(() => {
    dir = tmpDir();
    createCanonicalWorkspace(dir);
    graph = parseRoot(dir);

    registry = new TransportRegistry();
    const factory = new AdapterFactory(PLATFORMS_DIR);
    factory.registerAll(registry);
  });

  afterAll(() => cleanDir(dir));

  // TODO: Fix assertion — kiro exports instructions to .kiro/steering/{name}.md, not instructions/{name}.md
  it.skip('exports to kiro format with all expected files', async () => {
    const result = await exportToPlatform('kiro', graph, {}, registry);
    expect(result.ok).toBe(true);
    const files = Object.keys(result.data.files);
    // Identity
    expect(files.some(f => f.includes('identity'))).toBe(true);
    // Instructions
    expect(files.some(f => f.includes('instructions/code-style'))).toBe(true);
    // Capabilities
    expect(files.some(f => f.includes('capabilities/read-code'))).toBe(true);
    // Hooks
    expect(files.some(f => f.includes('hooks/on-save'))).toBe(true);
    // Workflows
    expect(files.some(f => f.includes('my-workflow'))).toBe(true);
  });

  // TODO: Rewrite for vscode-copilot platform (github.json archived to _archive/github-platform-v1.json)
  it.skip('exports to github format with all expected files', async () => {
    const result = await exportToPlatform('github', graph, {}, registry);
    expect(result.ok).toBe(true);
    const files = Object.keys(result.data.files);
    expect(files.some(f => f.includes('copilot-instructions'))).toBe(true);
    expect(files.some(f => f.includes('instructions/code-style'))).toBe(true);
    expect(files.some(f => f.includes('instructions/read-code'))).toBe(true);
  });

  // TODO: Rewrite for claude-code platform (claude.json archived to _archive/claude-platform-v1.json)
  it.skip('exports to claude format with all expected files', async () => {
    const result = await exportToPlatform('claude', graph, {}, registry);
    expect(result.ok).toBe(true);
    const files = Object.keys(result.data.files);
    // Claude should have CLAUDE.md or similar identity file
    expect(files.length).toBeGreaterThan(0);
  });
});

// ── 11.3: Round-trip test ──

describe('11.3: Round-trip — parse → export → import → verify', () => {
  let dir;
  let graph;
  let registry;

  beforeAll(() => {
    dir = tmpDir();
    createCanonicalWorkspace(dir);
    graph = parseRoot(dir);

    registry = new TransportRegistry();
    const factory = new AdapterFactory(PLATFORMS_DIR);
    factory.registerAll(registry);
  });

  afterAll(() => cleanDir(dir));

  it('kiro round-trip preserves instructions', async () => {
    // Export
    const exported = await exportToPlatform('kiro', graph, {}, registry);
    expect(exported.ok).toBe(true);

    // Import back
    const imported = await importFromPlatform('kiro', exported.data.files, {}, registry);
    expect(imported.ok).toBe(true);

    // Verify instructions survived the round-trip
    const importedFiles = Object.keys(imported.data.files);
    expect(importedFiles.some(f => f.includes('instructions/'))).toBe(true);
  });

  // TODO: Rewrite for vscode-copilot platform (github.json archived to _archive/github-platform-v1.json)
  it.skip('github round-trip preserves identity', async () => {
    // Export
    const exported = await exportToPlatform('github', graph, {}, registry);
    expect(exported.ok).toBe(true);

    // Import back
    const imported = await importFromPlatform('github', exported.data.files, {}, registry);
    expect(imported.ok).toBe(true);

    // Verify AGENTS.md was recreated
    expect(imported.data.files).toHaveProperty('AGENTS.md');
  });
});

// ── 11.4: CLI tests ──

// Re-enabled: bin/cli.js exists (Phase 2 complete)
describe('11.4: CLI — init and validate with canonical directories', () => {
  const CLI_PATH = path.join(ROOT_DIR, 'bin/cli.js');

  it('init creates all canonical directories', () => {
    const dir = tmpDir();
    const wsDir = path.join(dir, '.agentflow');
    try {
      execSync(`node ${CLI_PATH} init ${wsDir}`, { cwd: ROOT_DIR, stdio: 'pipe' });

      for (const reservedDir of RESERVED_DIRS) {
        const dirPath = path.join(wsDir, reservedDir);
        expect(fs.existsSync(dirPath)).toBe(true);
        expect(fs.statSync(dirPath).isDirectory()).toBe(true);
      }

      // AGENTS.md should be created
      expect(fs.existsSync(path.join(wsDir, 'AGENTS.md'))).toBe(true);

      // No legacy directories should exist
      for (const legacy of ['tools', 'skills', 'steering', 'interactions', 'templates']) {
        expect(fs.existsSync(path.join(wsDir, legacy))).toBe(false);
      }
    } finally {
      cleanDir(dir);
    }
  });

  it('validate works with canonical directories', () => {
    const dir = tmpDir();
    createCanonicalWorkspace(dir);
    try {
      const output = execSync(`node ${CLI_PATH} validate ${dir}`, {
        cwd: ROOT_DIR,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      // Should complete without throwing (exit code 0)
      expect(output).toBeDefined();
    } finally {
      cleanDir(dir);
    }
  });
});
