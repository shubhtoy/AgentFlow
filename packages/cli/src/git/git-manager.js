/**
 * GitManager — wraps Git operations via simple-git
 *
 * Credentials are never stored, cached, or logged —
 * authentication is delegated to the user's Git credential manager.
 */

const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Strip potential credentials from output strings.
 * Removes user:password@ patterns from URLs.
 *
 * @param {string} text
 * @returns {string}
 */
function sanitiseOutput(text) {
  if (!text) return '';
  return text.replace(/:\/\/[^@/\s]+:[^@/\s]+@/g, '://***:***@');
}

/**
 * Create a simple-git instance for a directory.
 * @param {string} [cwd]
 * @returns {import('simple-git').SimpleGit}
 */
function git(cwd) {
  return simpleGit(cwd ? { baseDir: cwd } : undefined);
}

/**
 * Wrap simple-git errors to sanitise credential leaks.
 */
async function safe(promise) {
  try {
    return await promise;
  } catch (err) {
    const msg = sanitiseOutput(err.message || String(err));
    const wrapped = new Error(msg);
    wrapped.exitCode = err.exitCode ?? 1;
    wrapped.stderr = sanitiseOutput(err.stderr || '');
    throw wrapped;
  }
}

/* ------------------------------------------------------------------ */
/*  Legacy parsing helpers (kept for backward compat / tests)          */
/* ------------------------------------------------------------------ */

function parseStatusOutput(output) {
  const modified = [];
  const untracked = [];
  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    const code = line.substring(0, 2);
    const filePath = line.substring(3).trim();
    if (code === '??') {
      untracked.push(filePath);
    } else {
      modified.push(filePath);
    }
  }
  return { modified, untracked };
}

function parseRevListCount(output) {
  const parts = output.trim().split(/\s+/);
  return {
    ahead: parseInt(parts[0], 10) || 0,
    behind: parseInt(parts[1], 10) || 0,
  };
}

function parsePullConflicts(stdout) {
  const hasConflicts = /CONFLICT/.test(stdout) || /Automatic merge failed/.test(stdout);
  const conflictFiles = [];
  if (hasConflicts) {
    const regex = /CONFLICT \([^)]+\): (?:Merge conflict in |.+ -> )(.+)/g;
    let match;
    while ((match = regex.exec(stdout)) !== null) {
      conflictFiles.push(match[1].trim());
    }
  }
  return { hasConflicts, conflictFiles };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

async function clone(repoUrl, targetDir, branch) {
  const opts = branch ? ['-b', branch] : [];
  await safe(module.exports._git().clone(repoUrl, targetDir, opts));
  return createBoundInstance(targetDir);
}

function attach(repoDir) {
  const gitDir = path.join(repoDir, '.git');
  if (!fs.existsSync(gitDir)) {
    throw new Error(`Not a git repository: "${repoDir}" (no .git directory found)`);
  }
  return createBoundInstance(repoDir);
}

async function pull(repoDir, branch) {
  try {
    const result = await safe(module.exports._git(repoDir).pull('origin', branch));
    return { hasConflicts: false, conflictFiles: [], output: result.summary || '' };
  } catch (err) {
    const conflicts = parsePullConflicts(err.message);
    if (conflicts.hasConflicts) {
      return { ...conflicts, output: err.message };
    }
    throw err;
  }
}

async function push(repoDir, branch) {
  await safe(module.exports._git(repoDir).push('origin', branch));
  return { success: true, output: '' };
}

async function status(repoDir) {
  const gitDir = path.join(repoDir, '.git');
  if (!fs.existsSync(gitDir)) {
    return {
      isRepo: false, isClean: false, branch: '', ahead: 0, behind: 0,
      modifiedFiles: [], untrackedFiles: [], hasRemote: false, remoteUrl: null,
    };
  }

  const g = module.exports._git(repoDir);
  let branch = '';
  let modifiedFiles = [];
  let untrackedFiles = [];
  let hasRemote = false;
  let remoteUrl = null;
  let ahead = 0;
  let behind = 0;

  try {
    const st = await safe(g.status());
    branch = st.current || '';
    modifiedFiles = [
      ...st.modified,
      ...st.created,
      ...st.deleted,
      ...st.renamed.map(r => r.to),
      ...st.conflicted,
    ];
    untrackedFiles = st.not_added || [];
    ahead = st.ahead || 0;
    behind = st.behind || 0;
  } catch (_) {
    // empty repo or detached HEAD
  }

  try {
    const remotes = await safe(g.getRemotes(true));
    if (remotes.length > 0) {
      hasRemote = true;
      remoteUrl = sanitiseOutput(remotes[0].refs?.fetch || remotes[0].refs?.push || null);
    }
  } catch (_) {
    // no remotes
  }

  const isClean = modifiedFiles.length === 0 && untrackedFiles.length === 0;

  return {
    isRepo: true, isClean, branch, ahead, behind,
    modifiedFiles, untrackedFiles, hasRemote, remoteUrl,
  };
}

async function stage(repoDir, filePath) {
  await safe(module.exports._git(repoDir).add(filePath));
}

async function commit(repoDir, message) {
  const result = await safe(module.exports._git(repoDir).commit(message));
  return result.summary || '';
}

async function stagedFileCount(repoDir) {
  try {
    const result = await safe(module.exports._git(repoDir).diff(['--cached', '--name-only']));
    return result.trim().split('\n').filter(Boolean).length;
  } catch (_) {
    return 0;
  }
}

async function addRemote(repoDir, name, url) {
  await safe(module.exports._git(repoDir).addRemote(name, url));
}

async function showRemote(repoDir, filePath, branch) {
  const result = await safe(module.exports._git(repoDir).show([`origin/${branch}:${filePath}`]));
  return result;
}

async function checkoutOurs(repoDir, filePath) {
  await safe(module.exports._git(repoDir).checkout(['--ours', filePath]));
}

async function checkoutTheirs(repoDir, filePath) {
  await safe(module.exports._git(repoDir).checkout(['--theirs', filePath]));
}

/* ------------------------------------------------------------------ */
/*  Bound instance                                                     */
/* ------------------------------------------------------------------ */

function createBoundInstance(repoDir) {
  return {
    repoDir,
    pull:            (branch)           => pull(repoDir, branch),
    push:            (branch)           => push(repoDir, branch),
    status:          ()                 => status(repoDir),
    stage:           (filePath)         => stage(repoDir, filePath),
    commit:          (message)          => commit(repoDir, message),
    stagedFileCount: ()                 => stagedFileCount(repoDir),
    addRemote:       (name, url)        => addRemote(repoDir, name, url),
    showRemote:      (filePath, branch) => showRemote(repoDir, filePath, branch),
    checkoutOurs:    (filePath)         => checkoutOurs(repoDir, filePath),
    checkoutTheirs:  (filePath)         => checkoutTheirs(repoDir, filePath),
  };
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

module.exports = {
  clone,
  attach,
  pull,
  push,
  status,
  stage,
  commit,
  stagedFileCount,
  addRemote,
  showRemote,
  checkoutOurs,
  checkoutTheirs,

  // Helpers (exported for testing / backward compat)
  sanitiseOutput,
  parseStatusOutput,
  parseRevListCount,
  parsePullConflicts,
  createBoundInstance,

  // Expose git factory for mocking in tests
  _git: git,
};
