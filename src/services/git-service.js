'use strict';

const path = require('path');
const fs = require('fs');
const { ok, fail, ErrorCode } = require('./types');

/**
 * Create a GitService bound to a service context.
 * @param {{ rootDir: string, logger: object, brandConfig: object }} ctx
 * @returns {object} GitService
 */
function createGitService(ctx) {
  const { rootDir, logger } = ctx;

  // Lazy-require git modules
  const getGitManager = () => require('../git/git-manager');
  const getRepoScanner = () => require('../git/repo-scanner');
  const getSyncEngine = () => require('../git/sync-engine');
  const getConfigManager = () => require('../git/config-manager');

  // In-memory state for sync tracking
  let lastSyncTimestamp = null;
  let pendingConflicts = [];

  return {
    /**
     * GET /api/git/status — return GitRepoStatus + last sync timestamp.
     * @param {string} [repoName] — optional repo filter
     */
    async getStatus(repoName) {
      try {
        const configManager = getConfigManager();
        const gitManager = getGitManager();
        const config = configManager.loadOrCreate(
          path.join(rootDir, configManager.DEFAULT_CONFIG_FILENAME)
        );
        const repos = config.repos || [];

        if (repos.length === 0) {
          return ok({ repos: [], lastSyncTimestamp });
        }

        const statuses = [];
        const targetRepos = repoName ? repos.filter((r) => r.name === repoName) : repos;

        for (const mapping of targetRepos) {
          try {
            const repoStatus = await gitManager.status(mapping.localPath);
            statuses.push({ name: mapping.name, ...repoStatus });
          } catch (err) {
            statuses.push({ name: mapping.name, error: err.message });
          }
        }

        return ok({ repos: statuses, lastSyncTimestamp });
      } catch (err) {
        logger.error({ err }, 'GitService.getStatus failed');
        return fail(ErrorCode.GIT_SYNC_ERROR, err.message);
      }
    },

    /**
     * POST /api/git/init — initialize repo connection.
     * @param {object} params — { url, name?, role?, branch?, repoType? }
     */
    async init(params) {
      try {
        const configManager = getConfigManager();
        const gitManager = getGitManager();
        const repoScanner = getRepoScanner();
        const { url: repoUrl, name, role, branch, repoType } = params;
        const configPath = path.join(rootDir, configManager.DEFAULT_CONFIG_FILENAME);
        const config = configManager.loadOrCreate(configPath);

        const repoName = name || repoUrl.replace(/\.git$/, '').split('/').pop();

        if (config.repos.some((r) => r.name === repoName)) {
          return fail(ErrorCode.INVALID_INPUT, `Repo name "${repoName}" already exists`, 400);
        }

        const targetBranch = branch || 'main';
        let targetDir;
        if (role === 'agentic') {
          targetDir = path.join(path.dirname(rootDir), '.agentflow-repos', repoName);
        } else if (role === 'shared') {
          targetDir = path.join(path.dirname(rootDir), '.agentflow-shared', repoName);
        } else {
          targetDir = path.dirname(rootDir);
        }

        if (fs.existsSync(path.join(targetDir, '.git'))) {
          const gm = gitManager.attach(targetDir);
          try { await gm.addRemote('agentflow', repoUrl); } catch (_) { /* remote may exist */ }
        } else {
          await gitManager.clone(repoUrl, targetDir, targetBranch);
        }

        const scanResult = repoScanner.scan(targetDir, config.scanDepth || 5);

        const mapping = {
          name: repoName,
          url: repoUrl,
          branch: targetBranch,
          localPath: targetDir,
          repoType: repoType || 'public',
          role: role || 'primary',
          agentflowPath: (scanResult.agentflowPaths && scanResult.agentflowPaths[0]) || '.agentflow',
        };

        config.repos.push(mapping);
        configManager.save(config, configPath);

        return ok({ scanResult, mapping });
      } catch (err) {
        logger.error({ err }, 'GitService.init failed');
        return fail(ErrorCode.GIT_SYNC_ERROR, err.message);
      }
    },

    /**
     * POST /api/git/sync — trigger sync operation.
     * @param {object} params — { repoName, direction?, dryRun? }
     */
    async sync(params) {
      try {
        const configManager = getConfigManager();
        const syncEngine = getSyncEngine();
        const { repoName, direction, dryRun: isDryRun } = params;
        const configPath = path.join(rootDir, configManager.DEFAULT_CONFIG_FILENAME);
        const config = configManager.loadOrCreate(configPath);

        const syncDirection = direction || config.syncRules.syncDirection || 'bidirectional';
        const result = await syncEngine.sync(config, repoName, syncDirection, { dryRun: !!isDryRun });

        lastSyncTimestamp = result.timestamp;
        if (result.conflicts && result.conflicts.length > 0) {
          pendingConflicts = result.conflicts.filter((c) => c.resolution === 'pending');
        }

        return ok(result);
      } catch (err) {
        logger.error({ err }, 'GitService.sync failed');
        return fail(ErrorCode.GIT_SYNC_ERROR, err.message);
      }
    },

    /**
     * GET /api/git/scan — scan repo structure.
     * @param {string} [dir] — directory to scan
     * @param {number} [depth] — scan depth
     */
    scan(dir, depth) {
      try {
        const repoScanner = getRepoScanner();
        const scanDir = dir || rootDir;
        const scanDepth = depth || 5;
        const result = repoScanner.scan(scanDir, scanDepth);
        return ok(result);
      } catch (err) {
        logger.error({ err }, 'GitService.scan failed');
        return fail(ErrorCode.GIT_SYNC_ERROR, err.message);
      }
    },

    /**
     * GET /api/git/conflicts — return pending conflicts from last sync.
     */
    getConflicts() {
      return ok({ conflicts: pendingConflicts });
    },

    /**
     * POST /api/git/resolve — resolve a specific conflict.
     * @param {string} conflictPath
     * @param {string} strategy
     */
    async resolve(conflictPath, strategy) {
      try {
        const configManager = getConfigManager();
        const gitManager = getGitManager();
        const syncEngine = getSyncEngine();
        const configPath = path.join(rootDir, configManager.DEFAULT_CONFIG_FILENAME);
        const config = configManager.loadOrCreate(configPath);

        let resolved = false;
        for (const mapping of config.repos) {
          try {
            const gm = gitManager.attach(mapping.localPath);
            const resolution = await syncEngine.resolveConflict(gm, conflictPath, strategy);
            pendingConflicts = pendingConflicts.filter((c) => c.path !== conflictPath);
            resolved = true;
            return ok({ path: conflictPath, resolution });
          } catch (_) {
            continue;
          }
        }

        if (!resolved) {
          return fail(ErrorCode.FILE_NOT_FOUND, `Could not resolve conflict for path: ${conflictPath}`, 404);
        }
      } catch (err) {
        logger.error({ err }, 'GitService.resolve failed');
        return fail(ErrorCode.GIT_SYNC_ERROR, err.message);
      }
    },

    /**
     * GET /api/git/config — return current GitSyncConfig.
     */
    getConfig() {
      try {
        const configManager = getConfigManager();
        const configPath = path.join(rootDir, configManager.DEFAULT_CONFIG_FILENAME);
        const config = configManager.loadOrCreate(configPath);
        return ok(config);
      } catch (err) {
        logger.error({ err }, 'GitService.getConfig failed');
        return fail(ErrorCode.GIT_SYNC_ERROR, err.message);
      }
    },

    /**
     * PUT /api/git/config — validate and save updated config.
     * @param {object} updates — partial config to merge
     */
    updateConfig(updates) {
      try {
        const configManager = getConfigManager();
        const configPath = path.join(rootDir, configManager.DEFAULT_CONFIG_FILENAME);
        const existing = configManager.loadOrCreate(configPath);

        const updated = { ...existing, ...updates };

        if (updates.syncRules) {
          updated.syncRules = { ...existing.syncRules, ...updates.syncRules };
        }

        configManager.save(updated, configPath);
        return ok(updated);
      } catch (err) {
        logger.error({ err }, 'GitService.updateConfig failed');
        return fail(ErrorCode.GIT_SYNC_ERROR, err.message);
      }
    },
  };
}

module.exports = { createGitService };
