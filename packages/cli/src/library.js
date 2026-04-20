/**
 * Library Manager — search, add, and index operations for the
 * reusable component library.
 *
 * @module library
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { TAXONOMY_REGISTRY, CANONICAL_CATEGORIES } = require('@agentflow/core/taxonomy');

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Map top-level library directory names to entry types (derived from taxonomy). */
const DIR_TYPE_MAP = Object.fromEntries([
  ['workflows', 'workflow'],
  ...CANONICAL_CATEGORIES.map(k => [TAXONOMY_REGISTRY[k].dir, TAXONOMY_REGISTRY[k].resourceType]),
]);

/* ------------------------------------------------------------------ */
/*  search(registry, query)                                            */
/* ------------------------------------------------------------------ */

/**
 * Search the library registry by query string.
 * Case-insensitive substring match on name, description, and tags.
 * Returns all entries when query is empty/falsy.
 *
 * @param {object} registry  - LibraryRegistry object ({ version, entries })
 * @param {string} query     - Search query
 * @returns {object[]}       - Matching LibraryEntry objects
 */
function search(registry, query) {
  if (!registry || !Array.isArray(registry.entries)) return [];
  if (!query) return registry.entries;

  const q = query.toLowerCase();

  return registry.entries.filter((entry) => {
    const name = (entry.name || '').toLowerCase();
    const desc = (entry.description || '').toLowerCase();
    const tags = (entry.tags || []).map((t) => t.toLowerCase());

    return (
      name.includes(q) ||
      desc.includes(q) ||
      tags.some((t) => t.includes(q))
    );
  });
}

/* ------------------------------------------------------------------ */
/*  add(registry, type, name, targetRoot)                              */
/* ------------------------------------------------------------------ */

/**
 * Add a library resource to the user's .agentflow/ workspace.
 *
 * For workflows: copies the entire directory tree.
 * For other types: copies the single file to the corresponding
 * reserved directory (tools/, skills/, etc.).
 *
 * @param {object} registry   - LibraryRegistry object
 * @param {string} type       - Resource type (workflow, skill, tool, …)
 * @param {string} name       - Resource name
 * @param {string} targetRoot - Path to the .agentflow/ workspace root
 * @throws {Error} If entry not found in registry
 */
function add(registry, type, name, targetRoot) {
  if (!registry || !Array.isArray(registry.entries)) {
    throw new Error(`Library registry is invalid or empty`);
  }

  const entry = registry.entries.find(
    (e) => e.type === type && e.name === name,
  );

  if (!entry) {
    const available = registry.entries
      .filter((e) => e.type === type)
      .map((e) => e.name);
    const hint = available.length
      ? ` Available ${type}s: ${available.join(', ')}`
      : ` No ${type}s found in library.`;
    throw new Error(
      `Resource "${name}" of type "${type}" not found in library.${hint}`,
    );
  }

  // Resolve the source path relative to the registry file's directory.
  // entry.path is relative to the library root (e.g. "workflows/code-review").
  // We derive libraryDir from the registry — the caller is expected to have
  // loaded the registry from <libraryDir>/registry.json.  Since we don't
  // store libraryDir on the registry object, we accept it via a convention:
  // registry._libraryDir (set by index()) or fall back to a sibling
  // "library/" directory next to the project root.
  const libraryDir = registry._libraryDir || path.resolve('library');
  const srcPath = path.resolve(libraryDir, entry.path);

  if (type === 'workflow') {
    // Copy entire directory tree
    const destDir = path.join(targetRoot, path.basename(entry.path));
    fs.cpSync(srcPath, destDir, { recursive: true });
  } else {
    // Determine target reserved directory (derived from taxonomy)
    const typeToDir = Object.fromEntries(
      CANONICAL_CATEGORIES.map(k => [TAXONOMY_REGISTRY[k].resourceType, TAXONOMY_REGISTRY[k].dir])
    );
    const dirName = typeToDir[type] || type + 's';
    const destDir = path.join(targetRoot, dirName);
    fs.mkdirSync(destDir, { recursive: true });
    fs.cpSync(srcPath, path.join(destDir, path.basename(srcPath)));
  }
}

/* ------------------------------------------------------------------ */
/*  index(libraryDir)                                                  */
/* ------------------------------------------------------------------ */

/**
 * Scan a library directory tree and produce a LibraryRegistry object.
 *
 * Directory structure expected:
 *   library/
 *     workflows/   — each sub-dir is a workflow entry
 *     skills/      — each .md file is a skill entry
 *     tools/       — each .md file is a tool entry
 *     templates/   — each .md file is a template entry
 *     interactions/ — each .md file is an interaction entry
 *
 * For non-workflow types, each .md file becomes an entry.
 * For workflows, each immediate sub-directory becomes an entry
 * (the AGENTS.md or first .md in the dir provides metadata).
 *
 * @param {string} libraryDir - Absolute or relative path to library root
 * @returns {object} LibraryRegistry { version, entries }
 */
function index(libraryDir) {
  const entries = [];
  const absLib = path.resolve(libraryDir);

  for (const [dirName, type] of Object.entries(DIR_TYPE_MAP)) {
    const typeDir = path.join(absLib, dirName);
    if (!fs.existsSync(typeDir)) continue;

    if (type === 'workflow') {
      // Each immediate sub-directory is a workflow entry
      const items = fs.readdirSync(typeDir, { withFileTypes: true });
      for (const item of items) {
        if (!item.isDirectory()) continue;
        const wfDir = path.join(typeDir, item.name);
        const entry = buildWorkflowEntry(wfDir, item.name, dirName);
        entries.push(entry);
      }
    } else {
      // Each .md file is an entry
      const items = fs.readdirSync(typeDir, { withFileTypes: true });
      for (const item of items) {
        if (!item.isFile() || !item.name.endsWith('.md')) continue;
        const filePath = path.join(typeDir, item.name);
        const entry = buildFileEntry(filePath, type, dirName);
        entries.push(entry);
      }
    }
  }

  const registry = { version: '1.0.0', entries };
  // Stash libraryDir so add() can resolve source paths
  registry._libraryDir = absLib;
  return registry;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Build a LibraryEntry from a single .md file.
 */
function buildFileEntry(filePath, type, dirName) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data: fm, content } = matter(raw);

  const name = fm.name || path.basename(filePath, '.md');
  const description = fm.description || extractFirstParagraph(content);
  const tags = Array.isArray(fm.tags) ? fm.tags : [];
  const relPath = path.join(dirName, path.basename(filePath));

  return { name, type, path: relPath, description, tags };
}

/**
 * Build a LibraryEntry for a workflow directory.
 * Reads the AGENTS.md or first .md file in the directory for metadata.
 */
function buildWorkflowEntry(wfDir, dirBasename, parentDirName) {
  let name = dirBasename;
  let description = '';
  let tags = [];

  // Look for AGENTS.md first, then any .md file at the workflow root
  const candidates = fs.readdirSync(wfDir).filter((f) => f.endsWith('.md'));
  const agentsMd = candidates.find(
    (f) => f.toLowerCase() === 'agents.md',
  );
  const mdFile = agentsMd || candidates[0];

  if (mdFile) {
    const raw = fs.readFileSync(path.join(wfDir, mdFile), 'utf-8');
    const { data: fm, content } = matter(raw);
    if (fm.name) name = fm.name;
    description = fm.description || extractFirstParagraph(content);
    if (Array.isArray(fm.tags)) tags = fm.tags;
  }

  const relPath = path.join(parentDirName, dirBasename);
  return { name, type: 'workflow', path: relPath, description, tags };
}

/**
 * Extract the first non-empty paragraph from markdown content
 * (after stripping the leading heading).
 */
function extractFirstParagraph(content) {
  const lines = content.split('\n');
  let collecting = false;
  const parts = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip leading headings
    if (!collecting && trimmed.startsWith('#')) continue;
    // Skip blank lines before first paragraph
    if (!collecting && trimmed === '') continue;
    // Start collecting
    collecting = true;
    // Stop at next blank line or heading after we started
    if (collecting && (trimmed === '' || trimmed.startsWith('#'))) break;
    parts.push(trimmed);
  }

  return parts.join(' ');
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

module.exports = {
  search,
  add,
  index,
  DIR_TYPE_MAP,
};
