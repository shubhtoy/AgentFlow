import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * git-manager tests.
 *
 * 1. Pure parsing helpers — tested directly, no mocking needed
 * 2. attach() — tested with real filesystem
 * 3. Credential sanitisation
 * 4. createBoundInstance shape
 *
 * Command-level tests (clone, pull, push, status, etc.) mock simple-git
 * via the exported _git factory.
 */

const gitManager = require('../../packages/cli/src/git/git-manager');
const {
  attach,
  sanitiseOutput,
  parseStatusOutput,
  parseRevListCount,
  parsePullConflicts,
  createBoundInstance,
} = gitManager;

/* ------------------------------------------------------------------ */
/*  Mock simple-git via the _git factory                               */
/* ------------------------------------------------------------------ */

let mockGitInstance;

function createMockGit() {
  return {
    clone: vi.fn().mockResolvedValue(undefined),
    pull: vi.fn().mockResolvedValue({ summary: '' }),
    push: vi.fn().mockResolvedValue(undefined),
    status: vi.fn().mockResolvedValue({
      current: 'main',
      modified: [],
      created: [],
      deleted: [],
      renamed: [],
      conflicted: [],
      not_added: [],
      ahead: 0,
      behind: 0,
    }),
    add: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue({ summary: '' }),
    diff: vi.fn().mockResolvedValue(''),
    addRemote: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(''),
    checkout: vi.fn().mockResolvedValue(undefined),
    getRemotes: vi.fn().mockResolvedValue([]),
  };
}

beforeEach(() => {
  mockGitInstance = createMockGit();
  vi.spyOn(gitManager, '_git').mockReturnValue(mockGitInstance);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/*  Pure helper tests                                                  */
/* ------------------------------------------------------------------ */

describe('sanitiseOutput', () => {
  it('strips user:password from HTTPS URLs', () => {
    const dirty = 'fatal: could not read from https://user:s3cret@github.com/repo.git';
    const clean = sanitiseOutput(dirty);
    expect(clean).not.toContain('user:s3cret');
    expect(clean).toContain('***:***@');
  });

  it('leaves clean URLs untouched', () => {
    const url = 'https://github.com/team/repo.git';
    expect(sanitiseOutput(url)).toBe(url);
  });

  it('returns empty string for falsy input', () => {
    expect(sanitiseOutput(null)).toBe('');
    expect(sanitiseOutput(undefined)).toBe('');
    expect(sanitiseOutput('')).toBe('');
  });
});

describe('parseStatusOutput', () => {
  it('parses modified and untracked files', () => {
    const output = ' M src/foo.js\nA  src/bar.js\n?? new-file.txt\n?? another.md';
    const result = parseStatusOutput(output);
    expect(result.modified).toEqual(['src/foo.js', 'src/bar.js']);
    expect(result.untracked).toEqual(['new-file.txt', 'another.md']);
  });

  it('returns empty arrays for clean repo', () => {
    const result = parseStatusOutput('');
    expect(result.modified).toEqual([]);
    expect(result.untracked).toEqual([]);
  });

  it('handles whitespace-only lines', () => {
    const result = parseStatusOutput('  \n\n  \n');
    expect(result.modified).toEqual([]);
    expect(result.untracked).toEqual([]);
  });
});

describe('parseRevListCount', () => {
  it('parses ahead/behind counts', () => {
    expect(parseRevListCount('3\t1\n')).toEqual({ ahead: 3, behind: 1 });
  });

  it('handles zero counts', () => {
    expect(parseRevListCount('0\t0\n')).toEqual({ ahead: 0, behind: 0 });
  });

  it('handles missing values gracefully', () => {
    expect(parseRevListCount('')).toEqual({ ahead: 0, behind: 0 });
  });
});

describe('parsePullConflicts', () => {
  it('detects merge conflicts', () => {
    const output = [
      'CONFLICT (content): Merge conflict in tools/search.md',
      'CONFLICT (content): Merge conflict in skills/review.md',
      'Automatic merge failed; fix conflicts and then commit the result.',
    ].join('\n');
    const result = parsePullConflicts(output);
    expect(result.hasConflicts).toBe(true);
    expect(result.conflictFiles).toEqual(['tools/search.md', 'skills/review.md']);
  });

  it('returns no conflicts for clean pull', () => {
    const result = parsePullConflicts('Already up to date.\n');
    expect(result.hasConflicts).toBe(false);
    expect(result.conflictFiles).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  clone                                                              */
/* ------------------------------------------------------------------ */

describe('clone', () => {
  it('calls simple-git clone with branch', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-clone-'));
    fs.mkdirSync(path.join(tmpDir, '.git'));
    try {
      await gitManager.clone('https://github.com/team/repo.git', tmpDir, 'develop');
      expect(mockGitInstance.clone).toHaveBeenCalledWith(
        'https://github.com/team/repo.git', tmpDir, ['-b', 'develop']
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('calls simple-git clone without branch', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-clone-'));
    fs.mkdirSync(path.join(tmpDir, '.git'));
    try {
      await gitManager.clone('https://github.com/team/repo.git', tmpDir);
      expect(mockGitInstance.clone).toHaveBeenCalledWith(
        'https://github.com/team/repo.git', tmpDir, []
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

/* ------------------------------------------------------------------ */
/*  pull                                                               */
/* ------------------------------------------------------------------ */

describe('pull', () => {
  it('calls simple-git pull', async () => {
    mockGitInstance.pull.mockResolvedValue({ summary: 'Already up to date.' });
    const result = await gitManager.pull('/repo', 'main');
    expect(mockGitInstance.pull).toHaveBeenCalledWith('origin', 'main');
    expect(result.hasConflicts).toBe(false);
  });

  it('detects conflicts from pull error', async () => {
    const conflictMsg = 'CONFLICT (content): Merge conflict in tools/search.md\nAutomatic merge failed';
    mockGitInstance.pull.mockRejectedValue(new Error(conflictMsg));
    const result = await gitManager.pull('/repo', 'main');
    expect(result.hasConflicts).toBe(true);
    expect(result.conflictFiles).toEqual(['tools/search.md']);
  });

  it('re-throws non-conflict errors', async () => {
    mockGitInstance.pull.mockRejectedValue(new Error('fatal: not a git repository'));
    await expect(gitManager.pull('/repo', 'main')).rejects.toThrow(/not a git repository/);
  });
});

/* ------------------------------------------------------------------ */
/*  push                                                               */
/* ------------------------------------------------------------------ */

describe('push', () => {
  it('calls simple-git push', async () => {
    const result = await gitManager.push('/repo', 'main');
    expect(mockGitInstance.push).toHaveBeenCalledWith('origin', 'main');
    expect(result.success).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  status                                                             */
/* ------------------------------------------------------------------ */

describe('status', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-status-'));
    fs.mkdirSync(path.join(tmpDir, '.git'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns isRepo:false for non-git directory', async () => {
    const noGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-nogit-'));
    try {
      const result = await gitManager.status(noGitDir);
      expect(result.isRepo).toBe(false);
    } finally {
      fs.rmSync(noGitDir, { recursive: true, force: true });
    }
  });

  it('parses a clean repo status', async () => {
    mockGitInstance.getRemotes.mockResolvedValue([
      { name: 'origin', refs: { fetch: 'https://github.com/team/repo.git' } },
    ]);

    const result = await gitManager.status(tmpDir);
    expect(result.isRepo).toBe(true);
    expect(result.isClean).toBe(true);
    expect(result.branch).toBe('main');
    expect(result.ahead).toBe(0);
    expect(result.behind).toBe(0);
    expect(result.hasRemote).toBe(true);
  });

  it('parses a dirty repo with ahead/behind', async () => {
    mockGitInstance.status.mockResolvedValue({
      current: 'feature',
      modified: ['src/foo.js'],
      created: [],
      deleted: [],
      renamed: [],
      conflicted: [],
      not_added: ['new.txt'],
      ahead: 2,
      behind: 5,
    });
    mockGitInstance.getRemotes.mockResolvedValue([
      { name: 'origin', refs: { fetch: 'https://github.com/team/repo.git' } },
    ]);

    const result = await gitManager.status(tmpDir);
    expect(result.isRepo).toBe(true);
    expect(result.isClean).toBe(false);
    expect(result.branch).toBe('feature');
    expect(result.ahead).toBe(2);
    expect(result.behind).toBe(5);
    expect(result.modifiedFiles).toEqual(['src/foo.js']);
    expect(result.untrackedFiles).toEqual(['new.txt']);
  });
});

/* ------------------------------------------------------------------ */
/*  stage, commit, stagedFileCount                                     */
/* ------------------------------------------------------------------ */

describe('stage', () => {
  it('calls simple-git add', async () => {
    await gitManager.stage('/repo', 'tools/search.md');
    expect(mockGitInstance.add).toHaveBeenCalledWith('tools/search.md');
  });
});

describe('commit', () => {
  it('calls simple-git commit', async () => {
    await gitManager.commit('/repo', 'my message');
    expect(mockGitInstance.commit).toHaveBeenCalledWith('my message');
  });
});

describe('stagedFileCount', () => {
  it('counts staged files', async () => {
    mockGitInstance.diff.mockResolvedValue('file1.md\nfile2.yaml\n');
    const count = await gitManager.stagedFileCount('/repo');
    expect(count).toBe(2);
  });

  it('returns 0 when nothing staged', async () => {
    mockGitInstance.diff.mockResolvedValue('');
    const count = await gitManager.stagedFileCount('/repo');
    expect(count).toBe(0);
  });

  it('returns 0 on error', async () => {
    mockGitInstance.diff.mockRejectedValue(new Error('fatal'));
    const count = await gitManager.stagedFileCount('/repo');
    expect(count).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  addRemote, showRemote, checkoutOurs, checkoutTheirs                */
/* ------------------------------------------------------------------ */

describe('addRemote', () => {
  it('calls simple-git addRemote', async () => {
    await gitManager.addRemote('/repo', 'agentflow', 'https://github.com/team/repo.git');
    expect(mockGitInstance.addRemote).toHaveBeenCalledWith('agentflow', 'https://github.com/team/repo.git');
  });
});

describe('showRemote', () => {
  it('calls simple-git show with correct ref', async () => {
    mockGitInstance.show.mockResolvedValue('# file content\n');
    const content = await gitManager.showRemote('/repo', 'tools/search.md', 'main');
    expect(mockGitInstance.show).toHaveBeenCalledWith(['origin/main:tools/search.md']);
    expect(content).toBe('# file content\n');
  });
});

describe('checkoutOurs', () => {
  it('calls simple-git checkout --ours', async () => {
    await gitManager.checkoutOurs('/repo', 'conflict.md');
    expect(mockGitInstance.checkout).toHaveBeenCalledWith(['--ours', 'conflict.md']);
  });
});

describe('checkoutTheirs', () => {
  it('calls simple-git checkout --theirs', async () => {
    await gitManager.checkoutTheirs('/repo', 'conflict.md');
    expect(mockGitInstance.checkout).toHaveBeenCalledWith(['--theirs', 'conflict.md']);
  });
});

/* ------------------------------------------------------------------ */
/*  attach                                                             */
/* ------------------------------------------------------------------ */

describe('attach', () => {
  it('throws for a directory without .git', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-no-git-'));
    try {
      expect(() => attach(tmpDir)).toThrow(/Not a git repository/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns a bound instance for a directory with .git', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-git-'));
    fs.mkdirSync(path.join(tmpDir, '.git'));
    try {
      const instance = attach(tmpDir);
      expect(instance).toBeDefined();
      expect(instance.repoDir).toBe(tmpDir);
      expect(typeof instance.pull).toBe('function');
      expect(typeof instance.push).toBe('function');
      expect(typeof instance.status).toBe('function');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Property 8 — no credentials in error messages                      */
/* ------------------------------------------------------------------ */

describe('Property 8 — no credentials in commands or error messages', () => {
  it('sanitiseOutput strips credentials from various URL formats', () => {
    const urls = [
      'https://user:token123@github.com/repo.git',
      'https://deploy:ghp_abc123@github.com/org/repo.git',
      'https://oauth2:glpat-xxxx@gitlab.com/group/project.git',
    ];
    for (const url of urls) {
      const sanitised = sanitiseOutput(`fatal: could not access ${url}`);
      expect(sanitised).not.toMatch(/user:token123/);
      expect(sanitised).not.toMatch(/deploy:ghp_abc123/);
      expect(sanitised).not.toMatch(/oauth2:glpat-xxxx/);
      expect(sanitised).toContain('***:***@');
    }
  });
});

/* ------------------------------------------------------------------ */
/*  createBoundInstance                                                 */
/* ------------------------------------------------------------------ */

describe('createBoundInstance', () => {
  it('returns an object with all expected methods', () => {
    const instance = createBoundInstance('/test/repo');
    const expectedMethods = [
      'pull', 'push', 'status', 'stage', 'commit',
      'stagedFileCount', 'addRemote', 'showRemote',
      'checkoutOurs', 'checkoutTheirs',
    ];
    expect(instance.repoDir).toBe('/test/repo');
    for (const method of expectedMethods) {
      expect(typeof instance[method]).toBe('function');
    }
  });
});
