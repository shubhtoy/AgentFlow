/**
 * SyncEngine — orchestrates pull/push/conflict resolution
 *
 * Implements Algorithm 3 (sync) and Algorithm 4 (matchesSyncRules).
 * Uses a lockfile to prevent concurrent syncs.
 * Supports dry-run mode for previewing changes without executing git operations.
 */

const fs = require('fs');
const path = require('path');
const { minimatch } = require('minimatch');
const gitManager = require('./git-manager');
const { scan } = require('./repo-scanner');

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const { RESERVED_DIRS } = require('../taxonomy');

const SYNCLOCK_FILENAME = '.synclock';

/* ------------------------------------------------------------------ */
/*  Algorithm 4: Sync Rules Matching                                   */
/* ------------------------------------------------------------------ */

/** Infer the resource type from a file path based on its directory. */
function inferResourceTypeFromPath(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  for (const dir of RESERVED_DIRS) {
    const pattern = new RegExp(`(?:^|/)${dir}/`);
    if (pattern.test(normalized)) return dir;
  }
  return null;
}

/** Determine whether a file should be synced per the given rules. */
function matchesSyncRules(filePath, syncRules) {
  if (!syncRules) return true;
  const normalized = filePath.replace(/\\/g, '/');
  const exclude = syncRules.exclude || [];
  const include = syncRules.include || [];
  const resourceTypes = syncRules.resourceTypes || [];

  // Step 1: Exclude takes precedence
  for (const pattern of exclude) {
    if (minimatch(normalized, pattern, { dot: true })) return false;
  }
  // Step 2: Must match at least one include pattern
  let matchesInclude = include.length === 0;
  for (const pattern of include) {
    if (minimatch(normalized, pattern, { dot: true })) { matchesInclude = true; break; }
  }
  if (!matchesInclude) return false;
  // Step 3: Resource type filter
  if (resourceTypes.length > 0) {
    const rt = inferResourceTypeFromPath(normalized);
    if (rt !== null && !resourceTypes.includes(rt)) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/*  Lockfile management                                                */
/* ------------------------------------------------------------------ */

function acquireLock(agentflowDir) {
  const lockPath = path.join(agentflowDir, SYNCLOCK_FILENAME);
  if (fs.existsSync(lockPath)) {
    try {
      const stat = fs.statSync(lockPath);
      if (Date.now() - stat.mtimeMs > 5 * 60 * 1000) {
        fs.unlinkSync(lockPath);
      } else {
        throw new Error('Sync already in progress');
      }
    } catch (err) {
      if (err.message === 'Sync already in progress') throw err;
    }
  }
  if (!fs.existsSync(agentflowDir)) fs.mkdirSync(agentflowDir, { recursive: true });
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, timestamp: new Date().toISOString() }), 'utf-8');
  return lockPath;
}

function releaseLock(lockPath) {
  try { if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath); } catch (_) {}
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function findMapping(repos, repoName) {
  if (!repos || !Array.isArray(repos)) return null;
  return repos.find((r) => r.name === repoName) || null;
}

async function resolveConflictByStrategy(gm, conflictPath, conflict, strategy) {
  switch (strategy) {
    case 'local_wins': await gm.checkoutOurs(conflictPath); return 'local_wins';
    case 'remote_wins': await gm.checkoutTheirs(conflictPath); return 'remote_wins';
    case 'timestamp': {
      try {
        const localStat = fs.statSync(path.resolve(gm.repoDir, conflictPath));
        if (localStat.mtimeMs > 0) { await gm.checkoutOurs(conflictPath); return 'local_wins'; }
      } catch (_) {}
      await gm.checkoutTheirs(conflictPath); return 'remote_wins';
    }
    case 'manual': default: return 'pending';
  }
}

/* ------------------------------------------------------------------ */
/*  Algorithm 3: Sync Operation                                        */
/* ------------------------------------------------------------------ */

async function sync(config, repoName, direction, options = {}) {
  const { dryRun = false } = options;
  const mapping = findMapping(config.repos, repoName);
  if (!mapping) throw new Error(`No repo mapping found for: ${repoName}`);

  const agentflowDir = path.join(mapping.localPath, mapping.agentflowPath || '.agentflow');
  let lockPath = null;
  if (!dryRun) lockPath = acquireLock(agentflowDir);

  try {
    const gm = gitManager.attach(mapping.localPath);
    const conflicts = [];
    const filesAdded = [];
    const filesModified = [];
    const filesDeleted = [];

    if (direction === 'pull_only' || direction === 'bidirectional') {
      const repoStatus = await gm.status();
      if (repoStatus.behind > 0 && !dryRun) {
        const pullResult = await gm.pull(mapping.branch);
        if (pullResult.hasConflicts) {
          for (const cp of pullResult.conflictFiles) {
            if (!matchesSyncRules(cp, config.syncRules)) continue;
            if (mapping.role === 'agentic') {
              const afPath = mapping.agentflowPath || '.agentflow';
              if (!cp.startsWith(afPath)) continue;
            }
            const conflict = { path: cp, localContent: null, remoteContent: null, resolution: null };
            try { conflict.localContent = fs.readFileSync(path.join(mapping.localPath, cp), 'utf-8'); } catch (_) {}
            try { conflict.remoteContent = await gm.showRemote(cp, mapping.branch); } catch (_) {}
            conflict.resolution = await resolveConflictByStrategy(gm, cp, conflict, config.conflictStrategy);
            conflicts.push(conflict);
          }
        }
      }
    }

    if (direction === 'push_only' || direction === 'bidirectional') {
      if (!dryRun) {
        const statusResult = await gm.status();
        const localChanges = [...statusResult.modifiedFiles, ...statusResult.untrackedFiles];
        for (const fp of localChanges) {
          if (!matchesSyncRules(fp, config.syncRules)) continue;
          if (mapping.role === 'agentic') {
            const afPath = mapping.agentflowPath || '.agentflow';
            if (!fp.startsWith(afPath)) continue;
          }
          await gm.stage(fp);
        }
        const stagedCount = await gm.stagedFileCount();
        if (stagedCount > 0) {
          await gm.commit(`agentflow sync: ${stagedCount} file(s) updated`);
          await gm.push(mapping.branch);
        }
      }
    }

    if (config.autoScan && !dryRun) {
      try { scan(mapping.localPath, config.scanDepth || 5); } catch (_) {}
    }

    return { success: true, direction, filesAdded, filesModified, filesDeleted, conflicts, timestamp: new Date().toISOString(), dryRun };
  } finally {
    if (lockPath) releaseLock(lockPath);
  }
}

async function resolveConflict(gm, conflictPath, strategy) {
  switch (strategy) {
    case 'local_wins': await gm.checkoutOurs(conflictPath); return 'local_wins';
    case 'remote_wins': await gm.checkoutTheirs(conflictPath); return 'remote_wins';
    default: return 'pending';
  }
}

module.exports = {
  sync, matchesSyncRules, resolveConflict,
  inferResourceTypeFromPath, findMapping, acquireLock, releaseLock, resolveConflictByStrategy,
  SYNCLOCK_FILENAME, RESERVED_DIRS,
};
