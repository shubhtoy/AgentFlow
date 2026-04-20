/**
 * ConfigManager — manages `.agentflow/.gitconfig.yaml`
 *
 * Handles loading, saving, validation, and defaults for the
 * Git integration configuration file.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_CONFIG_FILENAME = '.gitconfig.yaml';
const DEFAULT_AGENTFLOW_DIR = '.agentflow';

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

/**
 * Returns the default GitSyncConfig object.
 *
 * @returns {GitSyncConfig}
 */
function getDefaults() {
  return {
    version: '1.0.0',
    repos: [],
    syncRules: {
      include: ['**/*.md', '**/*.yaml'],
      exclude: ['**/output/**', '**/node_modules/**'],
      resourceTypes: [],
      syncDirection: 'bidirectional',
    },
    conflictStrategy: 'manual',
    autoScan: true,
    scanDepth: 5,
  };
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

/** Valid conflict strategy values. */
const VALID_CONFLICT_STRATEGIES = ['local_wins', 'remote_wins', 'manual', 'timestamp'];

/** Valid sync direction values. */
const VALID_SYNC_DIRECTIONS = ['bidirectional', 'push_only', 'pull_only'];

/** Valid repo type values. */
const VALID_REPO_TYPES = ['public', 'private', 'custom'];

/** Valid role values. */
const VALID_ROLES = ['primary', 'agentic', 'shared'];

/**
 * Checks whether a glob pattern contains path traversal sequences.
 *
 * @param {string} pattern
 * @returns {boolean} true if the pattern is unsafe
 */
function hasPathTraversal(pattern) {
  return pattern.includes('../');
}

/**
 * Validates all glob patterns in sync rules.
 * Throws if any pattern contains `../`.
 *
 * @param {SyncRules} syncRules
 */
function validateGlobPatterns(syncRules) {
  if (!syncRules) return;

  const allPatterns = [
    ...(syncRules.include || []),
    ...(syncRules.exclude || []),
  ];

  for (const pattern of allPatterns) {
    if (hasPathTraversal(pattern)) {
      throw new Error(
        `Invalid glob pattern "${pattern}": path traversal ("../") is not allowed`
      );
    }
  }
}

/**
 * Validates that no two repo mappings share the same `name`.
 *
 * @param {Array<RepoMapping>} repos
 */
function validateRepoUniqueness(repos) {
  if (!repos || repos.length === 0) return;

  const seen = new Set();
  for (const repo of repos) {
    if (!repo.name) continue;
    if (seen.has(repo.name)) {
      throw new Error(
        `Duplicate repo mapping name "${repo.name}": each repo must have a unique name`
      );
    }
    seen.add(repo.name);
  }
}

/**
 * Validates a full GitSyncConfig object.
 * Throws on the first validation error found.
 *
 * @param {GitSyncConfig} config
 */
function validate(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Config must be a non-null object');
  }

  if (config.conflictStrategy &&
      !VALID_CONFLICT_STRATEGIES.includes(config.conflictStrategy)) {
    throw new Error(
      `Invalid conflictStrategy "${config.conflictStrategy}". ` +
      `Must be one of: ${VALID_CONFLICT_STRATEGIES.join(', ')}`
    );
  }

  if (config.syncRules) {
    if (config.syncRules.syncDirection &&
        !VALID_SYNC_DIRECTIONS.includes(config.syncRules.syncDirection)) {
      throw new Error(
        `Invalid syncDirection "${config.syncRules.syncDirection}". ` +
        `Must be one of: ${VALID_SYNC_DIRECTIONS.join(', ')}`
      );
    }
    validateGlobPatterns(config.syncRules);
  }

  if (config.repos) {
    validateRepoUniqueness(config.repos);

    for (const repo of config.repos) {
      if (repo.repoType && !VALID_REPO_TYPES.includes(repo.repoType)) {
        throw new Error(
          `Invalid repoType "${repo.repoType}" for repo "${repo.name}". ` +
          `Must be one of: ${VALID_REPO_TYPES.join(', ')}`
        );
      }
      if (repo.role && !VALID_ROLES.includes(repo.role)) {
        throw new Error(
          `Invalid role "${repo.role}" for repo "${repo.name}". ` +
          `Must be one of: ${VALID_ROLES.join(', ')}`
        );
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Load / Save                                                        */
/* ------------------------------------------------------------------ */

/**
 * Resolves the default config file path.
 *
 * @param {string} [configPath] — explicit path, or auto-resolved
 * @returns {string}
 */
function resolveConfigPath(configPath) {
  if (configPath) return configPath;
  return path.join(DEFAULT_AGENTFLOW_DIR, DEFAULT_CONFIG_FILENAME);
}

/**
 * Loads an existing `.agentflow/.gitconfig.yaml`, or returns defaults
 * if the file does not exist. Creates the default config object in
 * memory only — does not write to disk when the file is missing.
 *
 * @param {string} [configPath] — path to the YAML config file
 * @returns {GitSyncConfig}
 */
function loadOrCreate(configPath) {
  const resolved = resolveConfigPath(configPath);

  if (!fs.existsSync(resolved)) {
    return getDefaults();
  }

  const raw = fs.readFileSync(resolved, 'utf-8');
  let parsed;

  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new Error(`Failed to parse config at "${resolved}": ${err.message}`);
  }

  // If the file is empty or not an object, return defaults
  if (!parsed || typeof parsed !== 'object') {
    return getDefaults();
  }

  // Merge with defaults so missing fields are filled in
  const defaults = getDefaults();
  const config = {
    version: parsed.version || defaults.version,
    repos: Array.isArray(parsed.repos) ? parsed.repos : defaults.repos,
    syncRules: {
      ...defaults.syncRules,
      ...(parsed.syncRules || {}),
    },
    conflictStrategy: parsed.conflictStrategy || defaults.conflictStrategy,
    autoScan: parsed.autoScan !== undefined ? parsed.autoScan : defaults.autoScan,
    scanDepth: parsed.scanDepth !== undefined ? parsed.scanDepth : defaults.scanDepth,
  };

  // Validate the loaded config
  validate(config);

  return config;
}

/**
 * Validates and writes a GitSyncConfig to disk as YAML.
 *
 * @param {GitSyncConfig} config
 * @param {string} [configPath] — path to write to
 */
function save(config, configPath) {
  validate(config);

  const resolved = resolveConfigPath(configPath);
  const dir = path.dirname(resolved);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const yamlStr = yaml.dump(config, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });

  fs.writeFileSync(resolved, yamlStr, 'utf-8');
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

module.exports = {
  // Core API
  loadOrCreate,
  save,
  getDefaults,

  // Validation (exported for testing)
  validate,
  validateRepoUniqueness,
  validateGlobPatterns,
  hasPathTraversal,

  // Constants (exported for testing / reuse)
  VALID_CONFLICT_STRATEGIES,
  VALID_SYNC_DIRECTIONS,
  VALID_REPO_TYPES,
  VALID_ROLES,
  DEFAULT_CONFIG_FILENAME,
  DEFAULT_AGENTFLOW_DIR,
};
