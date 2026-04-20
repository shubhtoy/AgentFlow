/**
 * RepoScanner — auto-detect `.agentflow/` structure in repositories.
 *
 * Scans a directory tree (local or cloned repo) to discover AgentFlow
 * resource structures. Leverages the existing Parser for `.md` file
 * analysis in `metadata-only` mode. Produces a structured ScanResult
 * with categorized resources, workflows, stats, and warnings.
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const { parseMarkdownFile } = require('../parser');
const { RESERVED_DIRS } = require('../taxonomy');

/** Default maximum directory depth for scanning. */
const DEFAULT_MAX_DEPTH = 5;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Recursively walk directories up to `maxDepth` and collect all
 * directories named `.agentflow`.
 *
 * @param {string} rootDir  — absolute path to start from
 * @param {number} maxDepth — max levels to descend (1 = only rootDir's children)
 * @returns {string[]} relative paths to `.agentflow/` dirs
 */
function findAgentflowDirs(rootDir, maxDepth) {
  const results = [];
  function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.name === '.agentflow') {
        results.push(path.relative(rootDir, fullPath).replace(/\\/g, '/'));
      } else {
        walk(fullPath, depth + 1);
      }
    }
  }
  walk(rootDir, 1);
  return results;
}

/**
 * Scan a single reserved directory for markdown resources.
 */
function scanReservedDir(dirPath, rootDir, resourceType) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return [];
  }
  const mdFiles = glob.sync('**/*.md', { cwd: dirPath, nodir: true });
  const resources = [];
  for (const relFile of mdFiles) {
    const absFile = path.join(dirPath, relFile);
    const parsed = parseMarkdownFile(absFile, 'metadata-only');
    if (!parsed) continue;
    const fm = parsed.frontmatter || {};
    resources.push({
      name: fm.name || path.basename(relFile, '.md'),
      path: path.relative(rootDir, absFile).replace(/\\/g, '/'),
      resourceType,
      hasFrontmatter: Object.keys(fm).length > 0,
      frontmatterFields: Object.keys(fm),
    });
  }
  return resources;
}

/**
 * Check whether a directory is a workflow directory.
 * A workflow is identified by having an `AGENTS.md` file or any `.md`
 * file with frontmatter `type: agents`.
 */
function detectWorkflow(dirPath) {
  const agentsPath = path.join(dirPath, 'AGENTS.md');
  if (fs.existsSync(agentsPath)) {
    return { isWorkflow: true, descriptorPath: agentsPath };
  }
  let entries;
  try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); }
  catch { return { isWorkflow: false, descriptorPath: null }; }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const filePath = path.join(dirPath, entry.name);
    const parsed = parseMarkdownFile(filePath, 'metadata-only');
    if (parsed && parsed.frontmatter && parsed.frontmatter.type === 'agents') {
      return { isWorkflow: true, descriptorPath: filePath };
    }
  }
  return { isWorkflow: false, descriptorPath: null };
}

/**
 * Scan a workflow directory to extract workflow metadata.
 */
function scanWorkflowDir(dirPath, rootDir) {
  const name = path.basename(dirPath);
  const relPath = path.relative(rootDir, dirPath).replace(/\\/g, '/');
  let nodeCount = 0;
  const entryPoints = [];
  let hasDescriptor = false;

  const detection = detectWorkflow(dirPath);
  hasDescriptor = detection.isWorkflow && detection.descriptorPath !== null;

  if (hasDescriptor && detection.descriptorPath) {
    const parsed = parseMarkdownFile(detection.descriptorPath, 'metadata-only');
    if (parsed && parsed.frontmatter) {
      if (parsed.frontmatter.entry) {
        entryPoints.push(parsed.frontmatter.entry);
      } else if (Array.isArray(parsed.frontmatter.entryPoints)) {
        entryPoints.push(...parsed.frontmatter.entryPoints);
      }
    }
  }

  let entries;
  try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); }
  catch { entries = []; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'output') continue;
    const subDirPath = path.join(dirPath, entry.name);
    try {
      const subFiles = fs.readdirSync(subDirPath);
      if (subFiles.some((f) => f.endsWith('.md'))) nodeCount++;
    } catch { /* skip unreadable */ }
  }

  return { name, path: relPath, nodeCount, hasDescriptor, entryPoints };
}

/* ------------------------------------------------------------------ */
/*  Core API                                                           */
/* ------------------------------------------------------------------ */

/**
 * Full scan of a directory tree for `.agentflow/` structures.
 *
 * @param {string} rootDir  — root directory to scan
 * @param {number} [maxDepth=5] — max directory depth to search
 * @returns {ScanResult}
 */
function scan(rootDir, maxDepth = DEFAULT_MAX_DEPTH) {
  const startTime = Date.now();
  const warnings = [];

  const agentflowPaths = findAgentflowDirs(rootDir, maxDepth);

  if (agentflowPaths.length === 0) {
    warnings.push({
      path: rootDir,
      message: 'No .agentflow directory found',
      severity: 'warning',
    });
    return {
      repoDir: rootDir,
      agentflowPaths: [],
      resources: Object.fromEntries(RESERVED_DIRS.map(d => [d, []])),
      workflows: [],
      stats: { totalFiles: 0, totalWorkflows: 0, totalResources: 0, scanDurationMs: Date.now() - startTime },
      warnings,
    };
  }

  const allResources = Object.fromEntries(RESERVED_DIRS.map(d => [d, []]));
  const allWorkflows = [];

  for (const afPath of agentflowPaths) {
    const fullPath = path.join(rootDir, afPath);

    for (const reservedDir of RESERVED_DIRS) {
      const dirPath = path.join(fullPath, reservedDir);
      const resources = scanReservedDir(dirPath, rootDir, reservedDir);
      allResources[reservedDir].push(...resources);
    }

    let subEntries;
    try { subEntries = fs.readdirSync(fullPath, { withFileTypes: true }); }
    catch { subEntries = []; }

    for (const entry of subEntries) {
      if (!entry.isDirectory()) continue;
      if (RESERVED_DIRS.includes(entry.name)) continue;
      if (entry.name === 'output') continue;
      const subDirPath = path.join(fullPath, entry.name);
      const detection = detectWorkflow(subDirPath);
      if (detection.isWorkflow) {
        allWorkflows.push(scanWorkflowDir(subDirPath, rootDir));
      }
    }
  }

  const totalResources = RESERVED_DIRS.reduce((sum, dir) => sum + allResources[dir].length, 0);
  const totalNodeCount = allWorkflows.reduce((sum, wf) => sum + wf.nodeCount, 0);

  return {
    repoDir: rootDir,
    agentflowPaths,
    resources: allResources,
    workflows: allWorkflows,
    stats: {
      totalFiles: totalResources + totalNodeCount,
      totalWorkflows: allWorkflows.length,
      totalResources,
      scanDurationMs: Date.now() - startTime,
    },
    warnings,
  };
}

/* ------------------------------------------------------------------ */
/*  Incremental Scan                                                   */
/* ------------------------------------------------------------------ */

/** @type {ScanResult|null} */
let _cachedResult = null;

/**
 * Incremental scan: re-scan only changed files and merge with cached state.
 * Falls back to a full scan if no cached state exists.
 *
 * @param {string}   rootDir      — root directory
 * @param {string[]} changedFiles — relative paths of changed files
 * @returns {ScanResult}
 */
function scanIncremental(rootDir, changedFiles) {
  if (!_cachedResult || _cachedResult.repoDir !== rootDir) {
    const result = scan(rootDir);
    _cachedResult = result;
    return result;
  }

  const cached = _cachedResult;
  const changedSet = new Set(changedFiles.map((f) => f.replace(/\\/g, '/')));

  const updatedResources = Object.fromEntries(
    RESERVED_DIRS.map(d => [d, [...(cached.resources[d] || [])]])
  );
  const updatedWorkflows = [...cached.workflows];

  for (const changedFile of changedSet) {
    for (const afPath of cached.agentflowPaths) {
      for (const reservedDir of RESERVED_DIRS) {
        const prefix = afPath + '/' + reservedDir + '/';
        if (changedFile.startsWith(prefix)) {
          updatedResources[reservedDir] = updatedResources[reservedDir].filter(
            (r) => r.path !== changedFile
          );
          const absFile = path.join(rootDir, changedFile);
          if (fs.existsSync(absFile)) {
            const parsed = parseMarkdownFile(absFile, 'metadata-only');
            if (parsed) {
              const fm = parsed.frontmatter || {};
              updatedResources[reservedDir].push({
                name: fm.name || path.basename(changedFile, '.md'),
                path: changedFile,
                resourceType: reservedDir,
                hasFrontmatter: Object.keys(fm).length > 0,
                frontmatterFields: Object.keys(fm),
              });
            }
          }
        }
      }

      for (let i = updatedWorkflows.length - 1; i >= 0; i--) {
        const wf = updatedWorkflows[i];
        if (changedFile.startsWith(wf.path + '/') || changedFile === wf.path) {
          const wfAbsPath = path.join(rootDir, wf.path);
          if (fs.existsSync(wfAbsPath) && fs.statSync(wfAbsPath).isDirectory()) {
            updatedWorkflows[i] = scanWorkflowDir(wfAbsPath, rootDir);
          } else {
            updatedWorkflows.splice(i, 1);
          }
        }
      }
    }
  }

  const totalResources = RESERVED_DIRS.reduce(
    (sum, dir) => sum + updatedResources[dir].length, 0
  );
  const totalNodeCount = updatedWorkflows.reduce((sum, wf) => sum + wf.nodeCount, 0);

  const result = {
    repoDir: rootDir,
    agentflowPaths: cached.agentflowPaths,
    resources: updatedResources,
    workflows: updatedWorkflows,
    stats: {
      totalFiles: totalResources + totalNodeCount,
      totalWorkflows: updatedWorkflows.length,
      totalResources,
      scanDurationMs: 0,
    },
    warnings: cached.warnings,
  };

  _cachedResult = result;
  return result;
}

/**
 * Clear the internal scan cache. Useful for testing.
 */
function clearCache() {
  _cachedResult = null;
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

module.exports = {
  scan,
  scanIncremental,
  clearCache,
  findAgentflowDirs,
  scanReservedDir,
  detectWorkflow,
  scanWorkflowDir,
  RESERVED_DIRS,
  DEFAULT_MAX_DEPTH,
};
