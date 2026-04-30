/**
 * Shared types and data-driven rule definitions for the validator.
 */

export type Severity = 'error' | 'warning' | 'info'

export interface RuleDef {
  id: string
  severity: Severity
  message: string
  category: string
}

export interface ValidationIssue {
  type: string
  message: string
  severity?: Severity
  filePath?: string
  field?: string
  resourceType?: string
  ref?: string
  workflow?: string
  nodes?: string[]
  token?: string
  server?: string
  dir?: string
  file?: string
}

export interface ValidationResult {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  valid: boolean
}

export const RULES: RuleDef[] = [
  {
    id: 'broken_ref',
    severity: 'error',
    message: 'Reference {{ref}} does not resolve to any file',
    category: 'references',
  },
  { id: 'broken_data_flow', severity: 'error', message: 'Data flow ref to non-existent node', category: 'references' },
  {
    id: 'missing_condition',
    severity: 'error',
    message: 'Missing condition template in conditional edge',
    category: 'references',
  },
  { id: 'no_entry_point', severity: 'error', message: 'Workflow has no entry point', category: 'structure' },
  {
    id: 'multiple_entry_points',
    severity: 'error',
    message: 'Workflow has multiple entry points',
    category: 'structure',
  },
  {
    id: 'infinite_sub_workflow',
    severity: 'error',
    message: 'Infinite sub-workflow loop detected',
    category: 'structure',
  },
  { id: 'malformed_variable', severity: 'error', message: 'Malformed variable token', category: 'variables' },
  { id: 'schema', severity: 'warning', message: 'Schema validation issue', category: 'schema' },
  { id: 'ambiguous_ref', severity: 'warning', message: 'Ambiguous ref matches multiple files', category: 'references' },
  { id: 'unreachable', severity: 'warning', message: 'Node may be unreachable', category: 'structure' },
  { id: 'unknown_category', severity: 'warning', message: 'Unknown category prefix in ref', category: 'taxonomy' },
  {
    id: 'router_non_conditional',
    severity: 'warning',
    message: 'Router node has non-conditional edge',
    category: 'structure',
  },
  {
    id: 'router_has_capabilities',
    severity: 'warning',
    message: 'Router node references capabilities',
    category: 'structure',
  },
  {
    id: 'router_has_instructions',
    severity: 'warning',
    message: 'Router node references instructions',
    category: 'structure',
  },
  {
    id: 'router_single_exit',
    severity: 'warning',
    message: 'Router node has fewer than 2 exits',
    category: 'structure',
  },
  { id: 'context_budget', severity: 'warning', message: 'Invalid context budget', category: 'context' },
  {
    id: 'context_input_broken',
    severity: 'warning',
    message: 'Context input ref could not be resolved',
    category: 'context',
  },
  {
    id: 'context_budget_high',
    severity: 'warning',
    message: 'Context budget exceeds recommended 8k',
    category: 'context',
  },
  { id: 'output_declaration', severity: 'warning', message: 'Output declaration missing name', category: 'schema' },
  {
    id: 'orphaned_sub_workflow',
    severity: 'warning',
    message: 'Sub-workflow node has no linked workflow',
    category: 'structure',
  },
  {
    id: 'missing_sub_workflow_target',
    severity: 'warning',
    message: 'Sub-workflow target does not exist',
    category: 'references',
  },
  {
    id: 'unresolved_workflow_ref',
    severity: 'warning',
    message: 'Workflow ref does not match any known workflow',
    category: 'references',
  },
  { id: 'missing_mcp_server', severity: 'warning', message: 'MCP tool references undeclared server', category: 'mcp' },
  { id: 'orphaned_mcp_tool', severity: 'warning', message: 'Orphaned MCP tool file', category: 'mcp' },
  {
    id: 'misplaced_resource',
    severity: 'warning',
    message: 'Resource inside workflow dir should be at top level',
    category: 'structure',
  },
  { id: 'identity', severity: 'warning', message: 'Identity validation issue', category: 'identity' },
  {
    id: 'missing_skill_description',
    severity: 'warning',
    message: 'Skill has no description (needed for progressive disclosure)',
    category: 'skills',
  },
  {
    id: 'inline_condition',
    severity: 'warning',
    message: 'Inline text condition — consider using an instructions/ reference for reusability',
    category: 'references',
  },
]

const RULE_MAP = new Map<string, RuleDef>(RULES.map(r => [r.id, r]))

export function getRuleSeverity(id: string): Severity {
  return RULE_MAP.get(id)?.severity ?? 'warning'
}
