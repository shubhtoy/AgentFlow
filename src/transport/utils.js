'use strict';

const isAbsolutePath = (p) => /^(?:\/|[A-Za-z]:[\\/])/.test(p);

/**
 * Resolve a rule's `source` string to actual data from the parsed graph.
 *
 * When options.workflowId is set:
 *   - 'identity' merges root + workflow descriptor into one
 *   - 'workflows/*' returns only the active workflow
 *
 * Supports canonical source names:
 *   - 'identity'        → merged descriptor
 *   - 'protocols.mcp'   → graph.protocols.mcp
 *   - 'instructions/*'  → graph.instructions
 *   - 'capabilities/*'  → graph.capabilities
 *   - 'runbooks/*'      → graph.runbooks
 *   - 'memory/*'        → graph.memory
 *   - 'hooks/*'         → graph.hooks
 *   - 'workflows/*'     → graph.workflows (or just the active one)
 *   - 'customFiles'     → graph.customFiles
 */
function resolveGraphSource(graph, source, options) {
  if (source === 'identity') {
    return graph.descriptorFile || null;
  }

  if (source === 'root-identity') {
    return graph.descriptorFile || null;
  }

  if (source === 'workflow-descriptor') {
    if (options?.workflowId) {
      const wf = graph.workflows?.[options.workflowId];
      if (wf?.descriptorFile) return wf.descriptorFile;
    }
    return null;
  }

  if (source === 'protocols.mcp') return graph.protocols?.mcp || null;

  const globMatch = source.match(/^(\w+)\/\*$/);
  if (globMatch) {
    const section = globMatch[1];

    // Scope workflows to the active one if specified
    if (section === 'workflows' && options?.workflowId) {
      const wf = graph.workflows?.[options.workflowId];
      if (!wf) return null;
      return { [options.workflowId]: wf };
    }

    const data = graph[section];
    return data && typeof data === 'object' && Object.keys(data).length > 0 ? data : null;
  }

  if (source === 'customFiles') return graph.customFiles || null;

  return null;
}

/**
 * Resolve the effective identity for export.
 *
 * When exporting a specific workflow, use the workflow's AGENTS.md as identity.
 * It already contains the workflow-specific identity, constraints, and navigation.
 * Falls back to root AGENTS.md if the workflow has no descriptor.
 */
function resolveIdentity(graph, options) {
  if (options?.workflowId) {
    const wf = graph.workflows?.[options.workflowId];
    if (wf?.descriptorFile) return wf.descriptorFile;
  }
  return graph.descriptorFile || null;
}

/**
 * Match source files against a glob-like pattern (e.g. '.kiro/instructions/*.md').
 */
function matchGlob(files, pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '([^/]+)');
  const re = new RegExp(`^${escaped}$`);
  const matched = {};
  for (const [fp, content] of Object.entries(files)) {
    if (re.test(fp)) matched[fp] = content;
  }
  return matched;
}

/**
 * Extract the {name} portion from a path given a glob pattern.
 */
function extractName(filePath, pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '([^/]+)');
  const re = new RegExp(`^${escaped}$`);
  const m = filePath.match(re);
  if (m && m[1]) {
    return m[1].replace(/\.[^.]+$/, '');
  }
  const parts = filePath.split('/');
  const base = parts[parts.length - 1];
  return base.replace(/\.[^.]+$/, '');
}

/**
 * Merge new content into existing content (string concat with separator).
 */
function mergeIntoExisting(existing, newContent) {
  if (!existing) return newContent;
  return existing + '\n' + newContent;
}

/**
 * Deep merge two objects. `override` wins on conflicts.
 */
function deepMerge(base, override) {
  const result = { ...base };
  for (const [key, val] of Object.entries(override)) {
    if (val && typeof val === 'object' && !Array.isArray(val) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      result[key] = deepMerge(base[key], val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Validate that a file path is safe for export output.
 * Must be relative, no '..' traversal, no absolute paths.
 */
function isPathSafe(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  if (isAbsolutePath(filePath)) return false;
  if (filePath.includes('..')) return false;
  return true;
}

/**
 * Validate all file paths in an output object.
 * Returns { safe: true } or { safe: false, invalidPaths: [...] }
 */
function validateOutputPaths(files) {
  const invalidPaths = Object.keys(files).filter(p => !isPathSafe(p));
  return invalidPaths.length === 0 ? { safe: true } : { safe: false, invalidPaths };
}

module.exports = { resolveGraphSource, resolveIdentity, matchGlob, extractName, mergeIntoExisting, deepMerge, isPathSafe, validateOutputPaths };
