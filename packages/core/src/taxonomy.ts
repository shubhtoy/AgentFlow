/**
 * Taxonomy Registry — single source of truth for all resource categories.
 *
 * 5 categories: instructions, capabilities, skills, memory, hooks.
 * Scoping is positional.
 */

export type CategoryName = 'instructions' | 'capabilities' | 'skills' | 'memory' | 'hooks'
export type Scope = 'workspace' | 'workflow'
export type FileFormat = 'single' | 'directory' | 'json'

export interface CategoryEntry {
  label: string
  pluralLabel: string
  dir: string
  icon: string
  color: string
  scope: Scope[]
  fileFormat: FileFormat
  description: string
  subtypes?: string[]
  subdirs?: string[]
  writable?: boolean
}

export type TaxonomyRegistry = Record<CategoryName, CategoryEntry>

export const TAXONOMY_REGISTRY: TaxonomyRegistry = {
  instructions: {
    label: 'Instruction',
    pluralLabel: 'Instructions',
    dir: 'instructions',
    icon: 'book-open',
    color: 'var(--category-instructions)',
    scope: ['workspace', 'workflow'],
    fileFormat: 'single',
    description: 'Rules, conventions, knowledge the agent follows',
  },
  capabilities: {
    label: 'Capability',
    pluralLabel: 'Capabilities',
    dir: 'capabilities',
    icon: 'wrench',
    color: 'var(--category-capabilities)',
    scope: ['workspace', 'workflow'],
    fileFormat: 'single',
    subtypes: ['builtin', 'script', 'mcp', 'package'],
    description: 'Tool definitions',
  },
  skills: {
    label: 'Skill',
    pluralLabel: 'Skills',
    dir: 'skills',
    icon: 'sparkles',
    color: 'var(--category-skills)',
    scope: ['workspace'],
    fileFormat: 'directory',
    subdirs: ['references', 'scripts', 'assets'],
    description: 'Packaged expertise (Agent Skills spec)',
  },
  memory: {
    label: 'Memory',
    pluralLabel: 'Memory',
    dir: 'memory',
    icon: 'brain',
    color: 'var(--category-memory)',
    scope: ['workspace', 'workflow'],
    fileFormat: 'single',
    writable: true,
    description: 'Persistent state across runs',
  },
  hooks: {
    label: 'Hook',
    pluralLabel: 'Hooks',
    dir: 'hooks',
    icon: 'zap',
    color: 'var(--category-hooks)',
    scope: ['workspace', 'workflow'],
    fileFormat: 'json',
    description: 'Event triggers',
  },
} as const

/* ------------------------------------------------------------------ */
/*  Derived constants                                                  */
/* ------------------------------------------------------------------ */

export const CANONICAL_CATEGORIES: CategoryName[] = Object.keys(TAXONOMY_REGISTRY) as CategoryName[]

export const RESERVED_DIRS: string[] = CANONICAL_CATEGORIES.map(k => TAXONOMY_REGISTRY[k].dir)

export const DIR_TO_CATEGORY: Record<string, CategoryName> = Object.fromEntries(
  CANONICAL_CATEGORIES.map(k => [TAXONOMY_REGISTRY[k].dir, k]),
) as Record<string, CategoryName>

export const RESOURCE_TYPE_MAP: Record<string, string> = Object.fromEntries(
  CANONICAL_CATEGORIES.map(k => [TAXONOMY_REGISTRY[k].dir, TAXONOMY_REGISTRY[k].label.toLowerCase()]),
)

export const RESOURCE_TYPE_TO_CATEGORY: Record<string, CategoryName> = Object.fromEntries(
  CANONICAL_CATEGORIES.map(k => [TAXONOMY_REGISTRY[k].label.toLowerCase(), k]),
) as Record<string, CategoryName>

/* ------------------------------------------------------------------ */
/*  Lookup helpers                                                     */
/* ------------------------------------------------------------------ */

export function getCategory(name: string): CategoryEntry | null {
  return TAXONOMY_REGISTRY[name as CategoryName] || null
}

export function getCategoryByDir(dirName: string): CategoryEntry | null {
  return TAXONOMY_REGISTRY[DIR_TO_CATEGORY[dirName]] || null
}

export function isReservedDir(dirName: string): boolean {
  return RESERVED_DIRS.includes(dirName)
}
