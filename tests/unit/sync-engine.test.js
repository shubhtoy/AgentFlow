import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const syncEngine = require('../../packages/cli/src/git/sync-engine');
const {
  matchesSyncRules,
  inferResourceTypeFromPath,
  findMapping,
  acquireLock,
  releaseLock,
  sync,
  resolveConflictByStrategy,
  SYNCLOCK_FILENAME,
} = syncEngine;

const gitManager = require('../../packages/cli/src/git/git-manager');
const { getDefaults } = require('../../packages/cli/src/git/config-manager');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agentflow-sync-'));
}

function removeTmpDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/** Create a minimal config with one repo mapping. */
function makeConfig(overrides = {}) {
  const defaults = getDefaults();
  const localPath = overrides.localPath || '/tmp/test-repo';
  return {
    ...defaults,
    ...overrides,
    repos: overrides.repos || [{
      name: 'test-repo',
      url: 'https://github.com/team/repo.git',
      branch: 'main',
      localPath,
      repoType: 'public',
      role: overrides.role || 'primary',
      agentflowPath: overrides.agentflowPath || '.agentflow',
    }],
  };
}

/* ------------------------------------------------------------------ */
/*  Property 2: Sync rule consistency — matchesSyncRules               */
/* ------------------------------------------------------------------ */

describe('matchesSyncRules (Property 2)', () => {
  it('returns true for a .md file matching default include rules', () => {
    const rules = { include: ['**/*.md'], exclude: [], resourceTypes: [] };
    expect(matchesSyncRules('tools/search.md', rules)).toBe(true);
  });

  it('returns true for a .yaml file matching default include rules', () => {
    const rules = { include: ['**/*.yaml'], exclude: [], resourceTypes: [] };
    expect(matchesSyncRules('config/settings.yaml', rules)).toBe(true);
  });

  it('returns false for a file not matching any include pattern', () => {
    const rules = { include: ['**/*.md'], exclude: [], resourceTypes: [] };
    expect(matchesSyncRules('tools/search.js', rules)).toBe(false);
  });

  it('exclude takes precedence over include', () => {
    const rules = {
      include: ['**/*.md'],
      exclude: ['**/output/**'],
      resourceTypes: [],
    };
    expect(matchesSyncRules('output/report.md', rules)).toBe(false);
  });

  it('excludes node_modules even if included by glob', () => {
    const rules = {
      include: ['**/*.md'],
      exclude: ['**/node_modules/**'],
      resourceTypes: [],
    };
    expect(matchesSyncRules('node_modules/pkg/readme.md', rules)).toBe(false);
  });

  it('filters by resource type when resourceTypes is specified', () => {
    const rules = {
      include: ['**/*.md'],
      exclude: [],
      resourceTypes: ['capabilities'],
    };
    // capabilities/search.md → type "capabilities" → allowed
    expect(matchesSyncRules('capabilities/search.md', rules)).toBe(true);
    // instructions/review.md → type "instructions" → not in allowed list
    expect(matchesSyncRules('instructions/review.md', rules)).toBe(false);
  });

  it('allows files with no inferred resource type when resourceTypes filter is active', () => {
    const rules = {
      include: ['**/*.md'],
      exclude: [],
      resourceTypes: ['capabilities'],
    };
    // A file not in any known resource dir → resourceType is null → allowed
    expect(matchesSyncRules('readme.md', rules)).toBe(true);
  });

  it('returns true when syncRules is null/undefined', () => {
    expect(matchesSyncRules('anything.md', null)).toBe(true);
    expect(matchesSyncRules('anything.md', undefined)).toBe(true);
  });

  it('handles multiple include patterns', () => {
    const rules = {
      include: ['**/*.md', '**/*.yaml'],
      exclude: [],
      resourceTypes: [],
    };
    expect(matchesSyncRules('tools/search.md', rules)).toBe(true);
    expect(matchesSyncRules('config/settings.yaml', rules)).toBe(true);
    expect(matchesSyncRules('script.js', rules)).toBe(false);
  });

  it('handles multiple exclude patterns', () => {
    const rules = {
      include: ['**/*.md'],
      exclude: ['**/output/**', '**/draft/**'],
      resourceTypes: [],
    };
    expect(matchesSyncRules('output/report.md', rules)).toBe(false);
    expect(matchesSyncRules('draft/wip.md', rules)).toBe(false);
    expect(matchesSyncRules('tools/search.md', rules)).toBe(true);
  });

  it('handles empty include array (matches everything not excluded)', () => {
    const rules = { include: [], exclude: ['**/secret/**'], resourceTypes: [] };
    expect(matchesSyncRules('tools/search.md', rules)).toBe(true);
    expect(matchesSyncRules('secret/key.md', rules)).toBe(false);
  });

  it('handles all resource types in filter', () => {
    const rules = {
      include: ['**/*.md'],
      exclude: [],
      resourceTypes: ['capabilities', 'instructions', 'runbooks', 'hooks', 'memory'],
    };
    expect(matchesSyncRules('capabilities/a.md', rules)).toBe(true);
    expect(matchesSyncRules('instructions/b.md', rules)).toBe(true);
    expect(matchesSyncRules('runbooks/c.md', rules)).toBe(true);
    expect(matchesSyncRules('hooks/d.md', rules)).toBe(true);
    expect(matchesSyncRules('memory/e.md', rules)).toBe(true);
  });

  it('handles dotfiles with dot: true matching', () => {
    const rules = { include: ['**/*.md'], exclude: [], resourceTypes: [] };
    expect(matchesSyncRules('.agentflow/tools/search.md', rules)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  inferResourceTypeFromPath                                          */
/* ------------------------------------------------------------------ */

describe('inferResourceTypeFromPath', () => {
  it('infers capabilities from path', () => {
    expect(inferResourceTypeFromPath('capabilities/search.md')).toBe('capabilities');
    expect(inferResourceTypeFromPath('.agentflow/capabilities/search.md')).toBe('capabilities');
  });

  it('infers instructions from path', () => {
    expect(inferResourceTypeFromPath('instructions/review.md')).toBe('instructions');
  });

  it('returns null for unknown directories', () => {
    expect(inferResourceTypeFromPath('readme.md')).toBeNull();
    expect(inferResourceTypeFromPath('src/main.js')).toBeNull();
  });

  it('handles Windows-style paths', () => {
    expect(inferResourceTypeFromPath('capabilities\\search.md')).toBe('capabilities');
  });
});

/* ------------------------------------------------------------------ */
/*  Property 3: Conflict resolution determinism                        */
/* ------------------------------------------------------------------ */

describe('conflict resolution determinism (Property 3)', () => {
  let mockGm;

  beforeEach(() => {
    mockGm = {
      repoDir: '/tmp/test-repo',
      checkoutOurs: vi.fn().mockResolvedValue(undefined),
      checkoutTheirs: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('local_wins always resolves to local_wins', async () => {
    const conflict = { localContent: 'local', remoteContent: 'remote' };
    const r1 = await resolveConflictByStrategy(mockGm, 'file.md', conflict, 'local_wins');
    const r2 = await resolveConflictByStrategy(mockGm, 'file.md', conflict, 'local_wins');
    expect(r1).toBe('local_wins');
    expect(r2).toBe('local_wins');
    expect(r1).toBe(r2);
    expect(mockGm.checkoutOurs).toHaveBeenCalledTimes(2);
  });

  it('remote_wins always resolves to remote_wins', async () => {
    const conflict = { localContent: 'local', remoteContent: 'remote' };
    const r1 = await resolveConflictByStrategy(mockGm, 'file.md', conflict, 'remote_wins');
    const r2 = await resolveConflictByStrategy(mockGm, 'file.md', conflict, 'remote_wins');
    expect(r1).toBe('remote_wins');
    expect(r2).toBe('remote_wins');
    expect(r1).toBe(r2);
    expect(mockGm.checkoutTheirs).toHaveBeenCalledTimes(2);
  });

  it('manual always resolves to pending (no git operations)', async () => {
    const conflict = { localContent: 'local', remoteContent: 'remote' };
    const r1 = await resolveConflictByStrategy(mockGm, 'file.md', conflict, 'manual');
    const r2 = await resolveConflictByStrategy(mockGm, 'file.md', conflict, 'manual');
    expect(r1).toBe('pending');
    expect(r2).toBe('pending');
    expect(r1).toBe(r2);
    expect(mockGm.checkoutOurs).not.toHaveBeenCalled();
    expect(mockGm.checkoutTheirs).not.toHaveBeenCalled();
  });

  it('timestamp strategy produces deterministic result for same inputs', async () => {
    // Create a real temp file so statSync works
    const tmpDir = createTmpDir();
    const filePath = path.join(tmpDir, 'file.md');
    fs.writeFileSync(filePath, 'content', 'utf-8');

    const gm = { ...mockGm, repoDir: tmpDir };
    const conflict = { localContent: 'local', remoteContent: 'remote' };

    const r1 = await resolveConflictByStrategy(gm, 'file.md', conflict, 'timestamp');
    const r2 = await resolveConflictByStrategy(gm, 'file.md', conflict, 'timestamp');
    expect(r1).toBe(r2);

    removeTmpDir(tmpDir);
  });

  it('each strategy produces a valid resolution string', async () => {
    const conflict = { localContent: 'local', remoteContent: 'remote' };
    const validResolutions = ['local_wins', 'remote_wins', 'pending'];

    for (const strategy of ['local_wins', 'remote_wins', 'manual']) {
      const result = await resolveConflictByStrategy(mockGm, 'f.md', conflict, strategy);
      expect(validResolutions).toContain(result);
    }
  });
});


/* ------------------------------------------------------------------ */
/*  Property 7: Sync idempotency                                       */
/* ------------------------------------------------------------------ */

describe('sync idempotency — no changes when already in sync (Property 7)', () => {
  let tmpDir;
  let attachSpy;
  let mockBound;

  beforeEach(() => {
    tmpDir = createTmpDir();
    fs.mkdirSync(path.join(tmpDir, '.git'));
    fs.mkdirSync(path.join(tmpDir, '.agentflow'), { recursive: true });

    mockBound = {
      repoDir: tmpDir,
      status: vi.fn().mockResolvedValue({
        isRepo: true, isClean: true, branch: 'main',
        ahead: 0, behind: 0, modifiedFiles: [], untrackedFiles: [],
        hasRemote: true, remoteUrl: 'https://github.com/team/repo.git',
      }),
      pull: vi.fn().mockResolvedValue({ hasConflicts: false, conflictFiles: [] }),
      push: vi.fn().mockResolvedValue({ success: true }),
      stage: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(''),
      stagedFileCount: vi.fn().mockResolvedValue(0),
      showRemote: vi.fn().mockResolvedValue(''),
      checkoutOurs: vi.fn().mockResolvedValue(undefined),
      checkoutTheirs: vi.fn().mockResolvedValue(undefined),
    };
    attachSpy = vi.spyOn(gitManager, 'attach').mockReturnValue(mockBound);
  });

  afterEach(() => {
    attachSpy.mockRestore();
    removeTmpDir(tmpDir);
  });

  it('reports zero changes when local and remote are in sync', async () => {
    const config = makeConfig({ localPath: tmpDir });
    const result = await sync(config, 'test-repo', 'bidirectional');

    expect(result.success).toBe(true);
    expect(result.filesAdded).toHaveLength(0);
    expect(result.filesModified).toHaveLength(0);
    expect(result.filesDeleted).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it('does not create commits when nothing to push', async () => {
    const config = makeConfig({ localPath: tmpDir });
    await sync(config, 'test-repo', 'push_only');

    expect(mockBound.commit).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  Property 9: Agentic repo isolation                                 */
/* ------------------------------------------------------------------ */

describe('agentic repo isolation (Property 9)', () => {
  let tmpDir;
  let attachSpy;
  let mockBound;
  let stagedFiles;

  beforeEach(() => {
    tmpDir = createTmpDir();
    fs.mkdirSync(path.join(tmpDir, '.git'));
    fs.mkdirSync(path.join(tmpDir, '.agentflow'), { recursive: true });
    stagedFiles = [];

    mockBound = {
      repoDir: tmpDir,
      status: vi.fn().mockResolvedValue({
        isRepo: true, isClean: false, branch: 'main',
        ahead: 0, behind: 0,
        modifiedFiles: ['.agentflow/capabilities/search.md', 'src/app.js', '.agentflow/instructions/review.md'],
        untrackedFiles: [],
        hasRemote: true, remoteUrl: 'https://github.com/team/repo.git',
      }),
      pull: vi.fn().mockResolvedValue({ hasConflicts: false, conflictFiles: [] }),
      push: vi.fn().mockResolvedValue({ success: true }),
      stage: vi.fn().mockImplementation((fp) => { stagedFiles.push(fp); return Promise.resolve(); }),
      commit: vi.fn().mockResolvedValue(''),
      stagedFileCount: vi.fn().mockImplementation(() => Promise.resolve(stagedFiles.length)),
      showRemote: vi.fn().mockResolvedValue(''),
      checkoutOurs: vi.fn().mockResolvedValue(undefined),
      checkoutTheirs: vi.fn().mockResolvedValue(undefined),
    };
    attachSpy = vi.spyOn(gitManager, 'attach').mockReturnValue(mockBound);
  });

  afterEach(() => {
    attachSpy.mockRestore();
    removeTmpDir(tmpDir);
  });

  it('only stages files within agentflowPath for agentic repos', async () => {
    const config = makeConfig({
      localPath: tmpDir,
      role: 'agentic',
      agentflowPath: '.agentflow',
    });
    // Include all .md files
    config.syncRules.include = ['**/*.md', '**/*.js'];

    await sync(config, 'test-repo', 'push_only');

    // Only .agentflow files should have been staged
    expect(stagedFiles).toContain('.agentflow/capabilities/search.md');
    expect(stagedFiles).toContain('.agentflow/instructions/review.md');
    expect(stagedFiles).not.toContain('src/app.js');
  });
});

/* ------------------------------------------------------------------ */
/*  Lockfile prevents concurrent sync (Error Scenario 7)               */
/* ------------------------------------------------------------------ */

describe('lockfile prevents concurrent sync', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
    fs.mkdirSync(path.join(tmpDir, '.agentflow'), { recursive: true });
  });

  afterEach(() => {
    removeTmpDir(tmpDir);
  });

  it('acquireLock creates a lockfile', () => {
    const afDir = path.join(tmpDir, '.agentflow');
    const lockPath = acquireLock(afDir);

    expect(fs.existsSync(lockPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
    expect(content.pid).toBe(process.pid);
    expect(content.timestamp).toBeDefined();

    releaseLock(lockPath);
  });

  it('acquireLock throws when lock already exists', () => {
    const afDir = path.join(tmpDir, '.agentflow');
    const lockPath = acquireLock(afDir);

    expect(() => acquireLock(afDir)).toThrow(/Sync already in progress/);

    releaseLock(lockPath);
  });

  it('releaseLock removes the lockfile', () => {
    const afDir = path.join(tmpDir, '.agentflow');
    const lockPath = acquireLock(afDir);
    expect(fs.existsSync(lockPath)).toBe(true);

    releaseLock(lockPath);
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('sync releases lock even on error', async () => {
    fs.mkdirSync(path.join(tmpDir, '.git'));
    const attachSpy = vi.spyOn(gitManager, 'attach').mockImplementation(() => {
      throw new Error('network error');
    });

    const config = makeConfig({ localPath: tmpDir });
    const afDir = path.join(tmpDir, '.agentflow');
    const lockPath = path.join(afDir, SYNCLOCK_FILENAME);

    try {
      await sync(config, 'test-repo', 'pull_only');
    } catch (_) {
      // Expected to fail
    }

    // Lock should be released
    expect(fs.existsSync(lockPath)).toBe(false);

    attachSpy.mockRestore();
  });

  it('acquireLock creates directory if it does not exist', () => {
    const afDir = path.join(tmpDir, 'nested', '.agentflow');
    const lockPath = acquireLock(afDir);

    expect(fs.existsSync(lockPath)).toBe(true);
    releaseLock(lockPath);
  });
});

/* ------------------------------------------------------------------ */
/*  Dry-run mode (no actual git operations)                            */
/* ------------------------------------------------------------------ */

describe('dry-run mode', () => {
  let tmpDir;
  let attachSpy;
  let mockBound;

  beforeEach(() => {
    tmpDir = createTmpDir();
    fs.mkdirSync(path.join(tmpDir, '.git'));
    fs.mkdirSync(path.join(tmpDir, '.agentflow'), { recursive: true });

    mockBound = {
      repoDir: tmpDir,
      status: vi.fn().mockResolvedValue({
        isRepo: true, isClean: false, branch: 'main',
        ahead: 2, behind: 3,
        modifiedFiles: ['tools/search.md'],
        untrackedFiles: [],
        hasRemote: true, remoteUrl: 'https://github.com/team/repo.git',
      }),
      pull: vi.fn().mockResolvedValue({ hasConflicts: false, conflictFiles: [] }),
      push: vi.fn().mockResolvedValue({ success: true }),
      stage: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(''),
      stagedFileCount: vi.fn().mockResolvedValue(0),
      showRemote: vi.fn().mockResolvedValue(''),
      checkoutOurs: vi.fn().mockResolvedValue(undefined),
      checkoutTheirs: vi.fn().mockResolvedValue(undefined),
    };
    attachSpy = vi.spyOn(gitManager, 'attach').mockReturnValue(mockBound);
  });

  afterEach(() => {
    attachSpy.mockRestore();
    removeTmpDir(tmpDir);
  });

  it('does not create a lockfile in dry-run mode', async () => {
    const config = makeConfig({ localPath: tmpDir });
    const lockPath = path.join(tmpDir, '.agentflow', SYNCLOCK_FILENAME);

    await sync(config, 'test-repo', 'bidirectional', { dryRun: true });

    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('does not call pull in dry-run mode', async () => {
    const config = makeConfig({ localPath: tmpDir });
    await sync(config, 'test-repo', 'pull_only', { dryRun: true });

    expect(mockBound.pull).not.toHaveBeenCalled();
  });

  it('does not call push/commit/stage in dry-run mode', async () => {
    const config = makeConfig({ localPath: tmpDir });
    await sync(config, 'test-repo', 'push_only', { dryRun: true });

    expect(mockBound.push).not.toHaveBeenCalled();
    expect(mockBound.commit).not.toHaveBeenCalled();
    expect(mockBound.stage).not.toHaveBeenCalled();
  });

  it('returns dryRun: true in the result', async () => {
    const config = makeConfig({ localPath: tmpDir });
    const result = await sync(config, 'test-repo', 'bidirectional', { dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.success).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  findMapping                                                        */
/* ------------------------------------------------------------------ */

describe('findMapping', () => {
  it('finds a mapping by name', () => {
    const repos = [
      { name: 'alpha', url: 'https://a.git' },
      { name: 'beta', url: 'https://b.git' },
    ];
    expect(findMapping(repos, 'beta')).toEqual({ name: 'beta', url: 'https://b.git' });
  });

  it('returns null for unknown name', () => {
    const repos = [{ name: 'alpha', url: 'https://a.git' }];
    expect(findMapping(repos, 'unknown')).toBeNull();
  });

  it('returns null for null/empty repos', () => {
    expect(findMapping(null, 'x')).toBeNull();
    expect(findMapping([], 'x')).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  sync — error cases                                                 */
/* ------------------------------------------------------------------ */

describe('sync — error cases', () => {
  it('throws when repo mapping not found', async () => {
    const config = makeConfig();
    await expect(sync(config, 'nonexistent', 'pull_only')).rejects.toThrow(
      /No repo mapping found for: nonexistent/
    );
  });
});
