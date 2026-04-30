import { BookOpen, Wrench, Zap, Brain, Database, Box, GitBranch, FileText, ArrowDownLeft, Webhook } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ResourceCategory } from './types'

/** Canonical list of resource categories — import this instead of hardcoding */
export const RESOURCE_CATEGORIES: ResourceCategory[] = ['instructions', 'capabilities', 'skills', 'memory', 'hooks']

/** Category → icon mapping — single source of truth */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  instructions: BookOpen, capabilities: Wrench, skills: Zap,
  memory: Database, hooks: Webhook, workflows: GitBranch,
}

// ---------------------------------------------------------------------------
// Category semantic colors — light and dark variants
// ---------------------------------------------------------------------------

interface CategoryColorSet {
  primaryColor: string
  containerColor: string
  onColor: string
}

interface CategoryDef {
  icon: LucideIcon
  label: string
  /** Short tooltip shown on hover — explains what this category is */
  tooltip?: string
  /** One-liner mapping to ecosystem equivalents */
  ecosystemHint?: string
  light: CategoryColorSet
  dark: CategoryColorSet
}

const CATEGORIES: Record<string, CategoryDef> = {
  instructions: { icon: BookOpen,      label: 'Instructions',
    tooltip: 'Reusable agent instructions — project rules and workflow skills',
    ecosystemHint: 'Cursor Rules · Kiro Steering · SKILL.md · CLAUDE.md conventions',
    light: { primaryColor: '#00838F', containerColor: '#E0F7FA', onColor: '#006064' },
    dark:  { primaryColor: '#4DD0E1', containerColor: 'rgba(77,208,225,0.15)', onColor: '#4DD0E1' },
  },
  capabilities: { icon: Wrench,        label: 'Capabilities',
    tooltip: 'Tools the agent can use — MCP servers, built-ins, scripts',
    ecosystemHint: 'MCP tools · shell commands · built-in IDE actions',
    light: { primaryColor: '#D81B60', containerColor: '#FCE4EC', onColor: '#880E4F' },
    dark:  { primaryColor: '#F48FB1', containerColor: 'rgba(244,143,177,0.15)', onColor: '#F48FB1' },
  },
  skills:       { icon: Zap,           label: 'Skills',
    tooltip: 'Reusable agent skills — composable building blocks',
    ecosystemHint: 'SKILL.md · agent skills · composable steps',
    light: { primaryColor: '#6A1B9A', containerColor: '#F3E5F5', onColor: '#4A148C' },
    dark:  { primaryColor: '#CE93D8', containerColor: 'rgba(206,147,216,0.15)', onColor: '#CE93D8' },
  },
  memory:       { icon: Database,      label: 'Memory',
    tooltip: 'Persistent context the agent remembers across sessions',
    ecosystemHint: 'Facts · decisions · lessons — any agent can read these',
    light: { primaryColor: '#6A1B9A', containerColor: '#F3E5F5', onColor: '#4A148C' },
    dark:  { primaryColor: '#CE93D8', containerColor: 'rgba(206,147,216,0.15)', onColor: '#CE93D8' },
  },
  nodes:        { icon: Box,           label: 'Node',
    tooltip: 'A step in the workflow — agent, gateway, or sub-workflow',
    ecosystemHint: 'Each node is a standard Agent Skill (SKILL.md)',
    light: { primaryColor: '#1565C0', containerColor: '#E3F2FD', onColor: '#0D47A1' },
    dark:  { primaryColor: '#64B5F6', containerColor: 'rgba(100,181,246,0.15)', onColor: '#64B5F6' },
  },
  workflows:    { icon: GitBranch,     label: 'Workflow',
    tooltip: 'Agent workflows composed from skills wired together',
    ecosystemHint: 'Like Kiro Specs · composed Agent Skills',
    light: { primaryColor: '#283593', containerColor: '#E8EAF6', onColor: '#1A237E' },
    dark:  { primaryColor: '#7986CB', containerColor: 'rgba(121,134,203,0.15)', onColor: '#7986CB' },
  },
  customFiles:  { icon: FileText,      label: 'Custom Files',
    tooltip: 'Additional context files — drop anything the agent might need',
    light: { primaryColor: '#546E7A', containerColor: '#ECEFF1', onColor: '#37474F' },
    dark:  { primaryColor: '#B0BEC5', containerColor: 'rgba(176,190,197,0.15)', onColor: '#B0BEC5' },
  },
  output:       { icon: ArrowDownLeft, label: 'Output',
    tooltip: 'Data produced by a workflow node',
    light: { primaryColor: '#00695C', containerColor: '#E0F2F1', onColor: '#004D40' },
    dark:  { primaryColor: '#80CBC4', containerColor: 'rgba(128,203,196,0.15)', onColor: '#80CBC4' },
  },
  hooks:        { icon: Webhook,       label: 'Hooks',
    tooltip: 'Event-driven automation — runs when files change or tools execute',
    ecosystemHint: 'Kiro Hooks · Claude Code Hooks · event triggers',
    light: { primaryColor: '#E65100', containerColor: '#FFF3E0', onColor: '#BF360C' },
    dark:  { primaryColor: '#FFB74D', containerColor: 'rgba(255,183,77,0.15)', onColor: '#FFB74D' },
  },
}

// ---------------------------------------------------------------------------
// Resolved config — backward-compatible shape used by all components
// ---------------------------------------------------------------------------

export type CategoryConfig = Record<string, {
  icon: LucideIcon
  label: string
  tooltip?: string
  ecosystemHint?: string
  primaryColor: string
  containerColor: string
  onColor: string
}>

/** Get category config for a specific mode */
export function getCategoryConfig(mode: 'light' | 'dark'): CategoryConfig {
  const result: CategoryConfig = {}
  for (const [key, def] of Object.entries(CATEGORIES)) {
    const colors = mode === 'dark' ? def.dark : def.light
    result[key] = { icon: def.icon, label: def.label, tooltip: def.tooltip, ecosystemHint: def.ecosystemHint, ...colors }
  }
  return result
}

/** Default export — light mode for backward compat (static contexts like ProseMirror extensions) */
export const CATEGORY_CONFIG = getCategoryConfig('light')

export const NODE_TYPE_COLORS: Record<string, string> = {
  'step': '#1565C0',
  'router': '#F57F17',
  'sub-workflow': '#6A1B9A',
}

/** Theme-aware node type colors — uses MUI theme primary for step nodes */
export function getNodeTypeColor(nodeType: string, _mode?: 'light' | 'dark', themePrimary?: string): string {
  if (nodeType === 'step' && themePrimary) return themePrimary
  const vars: Record<string, string> = {
    step:            'var(--node-step)',
    router:          'var(--node-router)',
    'sub-workflow':  'var(--node-sub-workflow)',
  }
  return vars[nodeType] ?? 'var(--node-step)'
}

export const SIDEBAR_SECTIONS: { key: ResourceCategory; label: string }[] = [
  { key: 'instructions', label: 'Instructions' },
  { key: 'capabilities', label: 'Capabilities' },
  { key: 'skills', label: 'Skills' },
  { key: 'memory', label: 'Memory' },
  { key: 'hooks', label: 'Hooks' },
]

/** Strip semantic prefixes (-> edge, << data-flow) and pipe conditions */
function stripRefPrefix(raw: string): string {
  let s = raw.trim()
  if (s.startsWith('->')) s = s.slice(2).trim()
  else if (s.startsWith('<<')) s = s.slice(2).trim()
  // Strip pipe condition: "nodes/foo | some-condition" → "nodes/foo"
  const pipe = s.indexOf('|')
  if (pipe !== -1) s = s.slice(0, pipe).trim()
  return s
}

export function refCategory(raw: string): string {
  const cleaned = stripRefPrefix(raw)
  if (cleaned.startsWith('output.') || cleaned === 'output') return 'output'
  const slash = cleaned.indexOf('/')
  if (slash > 0) return cleaned.slice(0, slash)
  // Bare name with edge prefix → it's a node reference
  if (raw.trim().startsWith('->')) return 'nodes'
  return cleaned || 'unknown'
}

export function refName(raw: string): string {
  const cleaned = stripRefPrefix(raw)
  if (cleaned.startsWith('output.')) return cleaned.slice(7)
  const parts = cleaned.split('/')
  return parts.slice(1).join('/') || cleaned
}

// ---------------------------------------------------------------------------
// Field hints, placeholders, and suggestions for frontmatter UI
// ---------------------------------------------------------------------------

export interface FieldHint {
  description: string
  placeholder?: string
  suggestions?: string[]
}

/** Hints for frontmatter fields — keyed by field name */
export const FIELD_HINTS: Record<string, FieldHint> = {
  // ── Common fields ──
  name: {
    description: 'Unique identifier for this resource. Used in references like {{category/name}}.',
    placeholder: 'e.g. my-capability, review-gate',
  },
  description: {
    description: 'Brief summary of what this resource does. Shown in tooltips and search results.',
    placeholder: 'Describe the purpose of this resource…',
  },
  type: {
    description: 'Resource type determines behavior and available fields.',
  },

  // ── Node fields ──
  entry: {
    description: 'Mark as an entry point — workflow execution starts here. Multiple entry points are allowed.',
  },
  primary: {
    description: 'Mark as the primary file for this node. Only one file per node should be primary.',
  },
  inputs: {
    description: 'Data this node expects to receive. Can be any format — used for documentation and wiring.',
    suggestions: ['text', 'json', 'markdown', 'code', 'file', 'url', 'prompt', 'context', 'config', 'user-input', 'api-response', 'diff', 'csv', 'xml', 'html', 'image'],
  },
  outputs: {
    description: 'Data this node produces. Can be any format — downstream nodes can reference these.',
    suggestions: ['text', 'json', 'markdown', 'code', 'file', 'diff', 'report', 'summary', 'decision', 'approval', 'analysis', 'csv', 'yaml', 'html', 'diagram'],
  },

  // ── Capability fields ──
  command: {
    description: 'Shell command to execute when this capability is invoked (for script-type capabilities).',
    placeholder: 'e.g. python scripts/analyze.py',
  },
  mcp: {
    description: 'MCP server name that provides this capability.',
    placeholder: 'e.g. my-mcp-server',
  },
  package: {
    description: 'NPM/pip package that provides this capability.',
    placeholder: 'e.g. @company/tool-package',
  },
  builtin_mapping: {
    description: 'Maps to a built-in capability implementation.',
    placeholder: 'e.g. file_read, web_search',
  },
  parameters: {
    description: 'Key-value pairs defining the capability\'s input parameters and their descriptions.',
  },

  // ── Instruction fields ──
  domain: {
    description: 'Knowledge domain this instruction covers. Helps the agent select the right instruction.',
    placeholder: 'e.g. security, testing, architecture',
    suggestions: ['security', 'testing', 'architecture', 'debugging', 'code-review', 'documentation', 'api-design', 'data-analysis', 'devops', 'performance', 'accessibility', 'ux-design'],
  },

  // ── Runbook fields ──
  timeout: {
    description: 'Max seconds to wait for user response before timing out.',
    placeholder: 'e.g. 300',
  },

  // ── Memory fields ──
  editable: {
    description: 'Whether the agent can modify this memory during execution.',
  },

  // ── Narrative template ──
  narrativeTemplate: {
    description: 'Controls how this resource appears in the narrative scaffolding. Prefix/suffix wrap the reference.',
  },
  prefix: {
    description: 'Text inserted before the resource reference in narrative.',
    placeholder: 'e.g. Using capability:',
  },
  suffix: {
    description: 'Text inserted after the resource reference in narrative.',
    placeholder: 'e.g. for analysis',
  },

  // ── Context fields ──
  agent: {
    description: 'Agent identity to use for this node. References an agent defined in the workflow.',
    placeholder: 'e.g. code-reviewer, planner',
  },
  model: {
    description: 'LLM model to use for this node. Overrides the workflow default.',
    placeholder: 'e.g. gpt-4, claude-3, gemini-pro',
    suggestions: ['gpt-4', 'gpt-4o', 'gpt-4o-mini', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'gemini-pro', 'gemini-flash'],
  },
}

/** Common scope values for context inputs */
export const COMMON_SCOPES = ['full', 'metadata', 'summary', 'signature', 'headers', 'excerpt']

/** Common output format values */
export const COMMON_FORMATS = ['markdown', 'json', 'yaml', 'text', 'diff', 'csv', 'xml', 'html', 'code', 'diagram']
