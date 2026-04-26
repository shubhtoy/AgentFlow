// --- Semantic Reference Types ---

export type SemanticType = 'mention' | 'edge' | 'data_flow'

export interface Ref {
  raw: string
  semanticType: SemanticType
  category: string
  name: string
  condition?: string
  offset: number
  line: number
}

export type ResourceType = 'instruction' | 'capability' | 'skill' | 'memory' | 'hook' | 'node' | 'agents' | 'untyped' | null

// --- Parsed File ---

export interface ParsedFile {
  filePath: string
  relativePath: string
  frontmatter: Record<string, unknown>
  title: string
  content: string
  rawContent: string
  refs: Ref[]
  resourceType: ResourceType
}

// --- Node / Edge / Workflow ---

export interface NodeDef {
  id: string
  name: string
  description?: string
  nodeType: 'step' | 'router' | 'sub-workflow'
  entry: boolean
  entryInferred: boolean
  primaryFile: ParsedFile
  contextFiles: ParsedFile[]
  allRefs: Ref[]
  frontmatter: Record<string, unknown>
  subWorkflow?: WorkflowDef
}

export interface EdgeDef {
  from: string
  to: string
  condition?: string
  sourceRef: Ref
}

export interface WorkflowDef {
  id: string
  name: string
  description?: string
  dir: string
  descriptorFile?: ParsedFile
  nodes: Record<string, NodeDef>
  edges: EdgeDef[]
  entryPoints: string[]
}

// --- Top-level Graph ---

export interface WorkflowGraph {
  rootDir: string
  descriptorFile?: ParsedFile
  instructions: Record<string, ParsedFile & { scope: string }>
  capabilities: Record<string, ParsedFile & { scope: string }>
  skills: Record<string, ParsedFile & { scope: string }>
  memory: Record<string, ParsedFile>
  hooks: Record<string, unknown>
  customFiles: Record<string, ParsedFile>
  workflows: Record<string, WorkflowDef>
  allFiles: ParsedFile[]
}

// --- Directory Explorer ---

export interface TreeNode {
  name: string
  path: string
  type: 'directory' | 'file'
  resourceType?: ResourceType
  isPrimary?: boolean
  isNodeDir?: boolean
  isReservedDir?: boolean
  children?: TreeNode[]
  validationErrors?: number
}

// --- Validation ---

export interface ValidationResult {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

export interface ValidationIssue {
  type: string
  message: string
  filePath?: string
  ref?: string
  workflow?: string
  field?: string
  nodes?: string[]
  token?: string
  /** @deprecated Use filePath instead */
  source?: string
}

// --- Export ---

export interface ExportBundle {
  graph: { nodes: Record<string, unknown>; edges: unknown[] }
  resources: Record<string, Record<string, unknown>>
  metadata: { name: string; description?: string; exportedAt: string; agentflowVersion: string }
  entry_points: unknown[]
  errors: unknown[]
}

// --- Shared ---

export type ResourceCategory = 'instructions' | 'capabilities' | 'skills' | 'memory' | 'hooks' | 'customFiles'

// --- Library ---

export interface LibraryEntry {
  name: string
  type: string
  path: string
  description: string
  tags: string[]
}

// --- Structured Export ---

export type ExportFormat = 'raw' | 'parsed' | 'platform'

export interface ExportOptions {
  workflow: string
  format: ExportFormat
  platform?: string
  preview?: boolean
}


// --- Backward-compat aliases removed — use canonical types directly ---

// --- Theme ---
export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export type ThemePaletteId = 'default' | 'teal' | 'indigo' | 'amber' | 'rose'

// --- Editor Mode ---
export type EditorMode = 'edit' | 'preview'

// --- IO Contract ---
export interface IOContract {
  inputs: string[]
  outputs: string[]
}

export interface CompatibilityResult {
  compatible: boolean
  mismatches: string[]
}

// --- Narrative ---
export interface NarrativeTemplate {
  prefix: string
  suffix: string
}

// --- Notifications ---
export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface NotificationAction {
  label: string
  onClick: () => void
}

export interface AppNotification {
  id: string
  message: string
  type: NotificationType
  timestamp: number
  action?: NotificationAction
}

// --- Explorer ---
export interface ExplorerSection {
  key: ResourceCategory | 'workflows' | 'nodes'
  label: string
  tooltip?: string
  ecosystemHint?: string
  items: ExplorerItem[]
}

export interface ExplorerItem {
  id: string
  name: string
  type: 'resource' | 'node' | 'workflow'
  category?: ResourceCategory
  workflowId?: string
  referenced?: boolean
}

// --- Slash Command ---
export interface SlashCommand {
  id: string
  title: string
  description: string
  category: 'reference' | 'edge' | 'data-flow'
}

export interface ResourceItem {
  name: string
  category: ResourceCategory
  refSyntax: string
}
