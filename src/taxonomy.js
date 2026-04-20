'use strict';

/**
 * Taxonomy Registry — THE single source of truth for all resource categories.
 *
 * Every module that needs category names, directory names, resource types,
 * or scope definitions imports from here. No hardcoded category arrays
 * exist anywhere else in the codebase.
 *
 * Adding a new sub-type = add a scope entry here + support the frontmatter value.
 * Adding a new category = add an entry here. That's it.
 */

const TAXONOMY_REGISTRY = {
  instructions: {
    label: 'Instruction',
    pluralLabel: 'Instructions',
    dir: 'instructions',
    resourceType: 'instruction',
    scopes: {
      workflow: { label: 'Skill', description: 'Reusable instruction set for workflow nodes' },
      global:  { label: 'Steering', description: 'Persistent project-level instruction' },
    },
    defaultScope: 'workflow',
  },
  capabilities: {
    label: 'Capability',
    pluralLabel: 'Capabilities',
    dir: 'capabilities',
    resourceType: 'capability',
    scopes: {
      descriptor: { label: 'Tool', description: 'MCP/builtin/script tool descriptor' },
      config:     { label: 'Protocol', description: 'Protocol configuration' },
    },
    defaultScope: 'descriptor',
  },
  runbooks: {
    label: 'Runbook',
    pluralLabel: 'Runbooks',
    dir: 'runbooks',
    resourceType: 'runbook',
    scopes: {
      interaction: { label: 'Interaction', description: 'Human-in-the-loop pause point' },
      condition:   { label: 'Condition', description: 'Routing condition check' },
    },
    defaultScope: 'interaction',
  },
  memory: {
    label: 'Memory',
    pluralLabel: 'Memory',
    dir: 'memory',
    resourceType: 'memory',
    scopes: {},
    defaultScope: null,
  },
  hooks: {
    label: 'Hook',
    pluralLabel: 'Hooks',
    dir: 'hooks',
    resourceType: 'hook',
    scopes: {},
    defaultScope: null,
  },
};

/* ------------------------------------------------------------------ */
/*  Derived constants (computed once at module load)                    */
/* ------------------------------------------------------------------ */

const CANONICAL_CATEGORIES = Object.keys(TAXONOMY_REGISTRY);

const RESERVED_DIRS = CANONICAL_CATEGORIES.map(k => TAXONOMY_REGISTRY[k].dir);

const DIR_TO_CATEGORY = Object.fromEntries(
  CANONICAL_CATEGORIES.map(k => [TAXONOMY_REGISTRY[k].dir, k])
);

const RESOURCE_TYPE_MAP = Object.fromEntries(
  CANONICAL_CATEGORIES.map(k => [TAXONOMY_REGISTRY[k].dir, TAXONOMY_REGISTRY[k].resourceType])
);

/** Reverse: resourceType → canonical category name (e.g. 'capability' → 'capabilities') */
const RESOURCE_TYPE_TO_CATEGORY = Object.fromEntries(
  CANONICAL_CATEGORIES.map(k => [TAXONOMY_REGISTRY[k].resourceType, k])
);

/* ------------------------------------------------------------------ */
/*  Lookup helpers                                                     */
/* ------------------------------------------------------------------ */

function getCategory(name) {
  return TAXONOMY_REGISTRY[name] || null;
}

function getCategoryByDir(dirName) {
  return TAXONOMY_REGISTRY[DIR_TO_CATEGORY[dirName]] || null;
}

function isReservedDir(dirName) {
  return RESERVED_DIRS.includes(dirName);
}

/* ------------------------------------------------------------------ */
/*  Scope inference                                                    */
/* ------------------------------------------------------------------ */

/** Tool subtypes that map to capability scope 'descriptor' */
const TOOL_SUBTYPES = new Set(['builtin', 'script', 'mcp', 'package']);

/**
 * Infer the scope of a resource from its frontmatter.
 * Explicit `scope` in frontmatter wins. Otherwise inferred from type/inclusion fields.
 * Returns null for categories with no scopes (memory, hooks).
 */
function inferScope(frontmatter, categoryName) {
  const cat = TAXONOMY_REGISTRY[categoryName];
  if (!cat || !cat.scopes || Object.keys(cat.scopes).length === 0) return null;

  const fm = frontmatter || {};

  // Explicit scope wins
  if (fm.scope && cat.scopes[fm.scope]) return fm.scope;

  // Infer from frontmatter fields
  if (categoryName === 'instructions') {
    if (fm.inclusion) return 'global';
    return 'workflow';
  }
  if (categoryName === 'capabilities') {
    if (TOOL_SUBTYPES.has(fm.type)) return 'descriptor';
    return cat.defaultScope;
  }
  if (categoryName === 'runbooks') {
    if (fm.type === 'condition') return 'condition';
    return 'interaction';
  }

  return cat.defaultScope;
}

module.exports = {
  TAXONOMY_REGISTRY,
  CANONICAL_CATEGORIES,
  RESERVED_DIRS,
  DIR_TO_CATEGORY,
  RESOURCE_TYPE_MAP,
  RESOURCE_TYPE_TO_CATEGORY,
  getCategory,
  getCategoryByDir,
  isReservedDir,
  inferScope,
};
