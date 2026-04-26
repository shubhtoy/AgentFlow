import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  matchesSyncRules,
  inferResourceTypeFromPath,
  findMapping,
  acquireLock,
  releaseLock,
  sync,
  resolveConflictByStrategy,
  SYNCLOCK_FILENAME,
  RESERVED_DIRS,
} from '../../packages/cli/src/git/sync-engine.js';

import * as gitManager from '../../packages/cli/src/git/git-manager.js';
import { getDefaults } from '../../packages/cli/src/git/config-manager.js';

function createTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agentflow-sync-'));
}

function removeTmpDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

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

describe('RESERVED_DIRS re-export', () => {
  it('matches canonical categories', () => {
    expect(RESERVED_DIRS).toEqual(['instructions', 'capabilities', 'skills', 'memory', 'hooks']);
  });
});

describe('matchesSyncRules', () => {
  it('returns true for matching include pattern', () => {
    expect(matchesSyncRules('tools/search.md', { include: ['**/*.md'], exclude: [], resourceTypes: [] })).toBe(true);
  });

  it('returns false for non-matching include', () => {
    expect(matchesSyncRules('tools/search.js', { include: ['**/*.md'], exclude: [], resourceTypes: [] })).toBe(false);
  });

  it('exclude takes precedence', () => {
    expect(matchesSyncRules('output/report.md', { include: ['**/*.md'], exclude: ['**/output/**'], resourceTypes: [] })).toBe(false);
  });

  it('filters by resourceTypes', () => {
    const rules = { include: ['**/*.md'], exclude: [], resourceTypes: ['capabilities'] };
    expect(matchesSyncRules('capabilities/search.md', rules)).toBe(true);
    expect(matchesSyncRules('instructions/review.md', rules)).toBe(false);
  });

  it('allows all resource types from RESERVED_DIRS', () => {
    const rules = { include: ['**/*.md'], exclude: [], resourceTypes: [...RESERVED_DIRS] };
    for (const dir of RESERVED_DIRS) {
      expect(matchesSyncRules(`${dir}/file.md`, rules)).toBe(true);
    }
  });

  it('returns true when syncRules is null/undefined', () => {
    expect(matchesSyncRules('anything.md', null)).toBe(true);
    expect(matchesSyncRules('anything.md', undefined)).toBe(true);
  });
});

describe('inferResourceTypeFromPath', () => {
  it('infers from RESERVED_DIRS', () => {
    expect(inferResourceTypeFromPath('capabilities/search.md')).toBe('capabilities');
    expect(inferResourceTypeFromPath('instructions/review.md')).toBe('instructions');
    expect(inferResourceTypeFromPath('skills/deploy.md')).toBe('skills');
    expect(inferResourceTypeFromPath('memory/facts.md')).toBe('memory');
    expect(inferResourceTypeFromPath('hooks/on-save.json')).toBe('hooks');
  });

  it('returns null for unknown dirs', () => {
    expect(inferResourceTypeFromPath('readme.md')).toBeNull();
    expect(inferResourceTypeFromPath('src/main.js')).toBeNull();
  });

  it('handles backslash paths', () => {
    expect(inferResourceTypeFromPath('capabilities\\search.md')).toBe('capabilities');
  });
});

describe('findMapping', () => {
  it('finds by name', () => {
    expect(findMapping([{ name: 'a' }, { name: 'b' }], 'b')).toEqual({ name: 'b' });
  });

  it('returns null for unknown', () => {
    expect(findMapping([{ name: 'a' }], 'x')).toBeNull();
  });

  it('returns null for null/empty repos', () => {
    expect(findMapping(null, 'x')).toBeNull();
    expect(findMapping([], 'x')).toBeNull();
  });
});

describe('conflict resolution', () => {
  let mockGm;

  beforeEach(() => {
    mockGm = {
      repoDir: '/tmp/test-repo',
      checkoutOurs: vi.fn().mockResolvedValue(undefined),
      checkoutTheirs: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('local_wins resolves deterministically', async () => {
    const r = await resolveConflictByStrategy(mockGm, 'f.md', {}, 'local_wins');
    expect(r).toBe('local_wins');
    expect(mockGm.checkoutOurs).toHaveBeenCalled();
  });

  it('remote_wins resolves deterministically', async () => {
    const r = await resolveConflictByStrategy(mockGm, 'f.md', {}, 'remote_wins');
    expect(r).toBe('remote_wins');
    expect(mockGm.checkoutTheirs).toHaveBeenCalled();
  });

  it('manual resolves to pending', async () => {
    const r = await resolveConflictByStrategy(mockGm, 'f.md', {}, 'manual');
    expect(r).toBe('pending');
    expect(mockGm.checkoutOurs).not.toHaveBeenCalled();
    expect(mockGm.checkoutTheirs).not.toHaveBeenCalled();
  });
});

describe('lockfile', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTmpDir(); fs.mkdirSync(path.join(tmpDir, '.agentflow'), { recursive: true }); });
  afterEach(() => { removeTmpDir(tmpDir); });

  it('acquireLock creates and releaseLock removes', () => {
    const afDir = path.join(tmpDir, '.agentflow');
    const lockPath = acquireLock(afDir);
    expect(fs.existsSync(lockPath)).toBe(true);
    releaseLock(lockPath);
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('acquireLock throws when lock exists', () => {
    const afDir = path.join(tmpDir, '.agentflow');
    const lockPath = acquireLock(afDir);
    expect(() => acquireLock(afDir)).toThrow(/Sync already in progress/);
    releaseLock(lockPath);
  });
});

describe('sync error cases', () => {
  it('throws when repo mapping not found', async () => {
    const config = makeConfig();
    await expect(sync(config, 'nonexistent', 'pull_only')).rejects.toThrow(/No repo mapping found/);
  });
});
