'use strict';

/**
 * Frontmatter Schemas — Single source of truth.
 *
 * Every resource type's frontmatter fields are defined here once.
 * Consumed by: validator.js, FrontmatterForm.tsx, knowledge-index, exporters.
 *
 * Each field carries both validation metadata and UI metadata:
 *   type          — data type for validation (string, boolean, integer, string[], object, object[])
 *   required      — field is required (default false)
 *   enum          — allowed values
 *   requiredWhen  — conditional requirement { field, value }
 *   literal       — exact value match
 *   label         — human-readable label for UI
 *   section       — UI grouping
 *   formType      — UI control (text, textarea, select, boolean, taglist, group, workflow-picker)
 *   hint          — tooltip text
 *   conditional   — show in form only when { field, value }
 *   children      — nested fields for group formType
 *
 * Unknown frontmatter fields pass through untouched — schemas define what gets
 * special treatment, not what's allowed.
 */

const FRONTMATTER_SCHEMAS = {
  /* ── Workspace / Workflow identity ─────────────────────────────────── */
  agents: {
    type:        { type: 'string', literal: 'agents', label: 'Type', formType: 'text', section: 'Identity' },
    name:        { type: 'string', required: true, label: 'Name', formType: 'text', section: 'Identity' },
    description: { type: 'string', label: 'Description', formType: 'textarea', section: 'Identity' },
    identity:    { type: 'object', label: 'Identity', formType: 'group', section: 'Identity', children: {
      name:        { type: 'string', label: 'Agent Name', formType: 'text' },
      role:        { type: 'string', label: 'Role', formType: 'textarea' },
      personality: { type: 'string', label: 'Personality', formType: 'text' },
      constraints: { type: 'string[]', label: 'Constraints', formType: 'taglist' },
    }},
  },

  /* ── Node (step / router / sub-workflow) ───────────────────────────── */
  node: {
    name:        { type: 'string', required: true, label: 'Name', formType: 'text', section: 'Identity' },
    type:        { type: 'string', required: true, enum: ['step', 'router', 'sub-workflow'], label: 'Type', formType: 'select', section: 'Identity' },
    description: { type: 'string', label: 'Description', formType: 'textarea', section: 'Identity' },
    workflow:    { type: 'string', requiredWhen: { field: 'type', value: 'sub-workflow' }, label: 'Linked Workflow', formType: 'workflow-picker', section: 'Identity' },
    entry:       { type: 'boolean', label: 'Entry Point', formType: 'boolean', section: 'Behavior' },
    primary:     { type: 'boolean', label: 'Primary File', formType: 'boolean', section: 'Behavior' },
    agent:       { type: 'string', label: 'Agent Persona', formType: 'text', section: 'Behavior', hint: 'Override the default agent identity for this node' },
    model:       { type: 'string', label: 'Preferred Model', formType: 'text', section: 'Behavior', hint: 'e.g. claude-sonnet-4-20250514, gpt-4o' },
    context:     { type: 'object', label: 'Context Budget', formType: 'group', section: 'Context', children: {
      max_tokens: { type: 'integer', label: 'Max Tokens', formType: 'text', hint: 'Token budget for this node\'s context window' },
      inputs:     { type: 'object[]', label: 'Inputs (YAML)', formType: 'textarea', hint: 'External inputs: [{ref, scope}]' },
      exclude:    { type: 'string[]', label: 'Exclude (YAML)', formType: 'textarea', hint: 'Patterns to exclude from context' },
    }},
    outputs:     { type: 'object[]', label: 'Outputs', formType: 'object-list', section: 'Data Flow', children: {
      name:        { type: 'string', label: 'Name', formType: 'text' },
      format:      { type: 'string', label: 'Format', formType: 'text' },
      description: { type: 'string', label: 'Description', formType: 'text' },
    }},
  },

  /* ── Capability (tool) ─────────────────────────────────────────────── */
  capability: {
    name:             { type: 'string', required: true, label: 'Name', formType: 'text', section: 'Identity' },
    type:             { type: 'string', enum: ['builtin', 'script', 'mcp', 'package'], label: 'Type', formType: 'select', section: 'Identity' },
    description:      { type: 'string', label: 'Description', formType: 'textarea', section: 'Identity' },
    outputs:          { type: 'object[]', label: 'Outputs', formType: 'object-list', section: 'Data Flow', children: {
      name:        { type: 'string', label: 'Name', formType: 'text' },
      format:      { type: 'string', label: 'Format', formType: 'text' },
      description: { type: 'string', label: 'Description', formType: 'text' },
    }},
    parameters:       { type: 'object', label: 'Parameters (YAML)', formType: 'textarea', section: 'Configuration', hint: 'JSON Schema for tool parameters' },
    command:          { type: 'string', requiredWhen: { field: 'type', value: 'script' }, label: 'Command', formType: 'text', section: 'Configuration', conditional: { field: 'type', value: 'script' } },
    mcp:              { type: 'string', requiredWhen: { field: 'type', value: 'mcp' }, label: 'MCP Server', formType: 'text', section: 'Configuration', conditional: { field: 'type', value: 'mcp' } },
    package:          { type: 'string', requiredWhen: { field: 'type', value: 'package' }, label: 'Package', formType: 'text', section: 'Configuration', conditional: { field: 'type', value: 'package' } },
    builtin_mapping:  { type: 'string', label: 'Builtin Mapping', formType: 'text', section: 'Configuration', conditional: { field: 'type', value: 'builtin' } },
    narrativeTemplate: { type: 'object', label: 'Narrative Template', formType: 'group', section: 'Narrative', children: {
      prefix: { type: 'string', label: 'Prefix', formType: 'text' },
      suffix: { type: 'string', label: 'Suffix', formType: 'text' },
    }},
  },

  /* ── Instruction ───────────────────────────────────────────────────── */
  instruction: {
    name:        { type: 'string', required: true, label: 'Name', formType: 'text', section: 'Identity' },
    description: { type: 'string', label: 'Description', formType: 'textarea', section: 'Identity' },
    domain:      { type: 'string', label: 'Domain', formType: 'text', section: 'Identity' },
    scope:       { type: 'string', enum: ['global', 'workflow', 'node'], label: 'Scope', formType: 'select', section: 'Behavior', hint: 'global = always loaded, workflow = loaded for the workflow, node = on-demand' },
    inclusion:   { type: 'string', enum: ['auto', 'manual'], label: 'Inclusion', formType: 'select', section: 'Behavior', hint: 'auto = included automatically, manual = only when referenced' },
    max_tokens:  { type: 'integer', label: 'Max Tokens', formType: 'text', section: 'Context' },
    tags:        { type: 'string[]', label: 'Tags', formType: 'taglist', section: 'Identity' },
    narrativeTemplate: { type: 'object', label: 'Narrative Template', formType: 'group', section: 'Narrative', children: {
      prefix: { type: 'string', label: 'Prefix', formType: 'text' },
      suffix: { type: 'string', label: 'Suffix', formType: 'text' },
    }},
  },

  /* ── Runbook (condition or interaction) ─────────────────────────────── */
  runbook: {
    name:        { type: 'string', required: true, label: 'Name', formType: 'text', section: 'Identity' },
    type:        { type: 'string', required: true, enum: ['condition', 'approval', 'freeform', 'choice', 'confirm'], label: 'Type', formType: 'select', section: 'Identity' },
    description: { type: 'string', label: 'Description', formType: 'textarea', section: 'Identity' },
    check:       { type: 'string', requiredWhen: { field: 'type', value: 'condition' }, label: 'Check Expression', formType: 'text', section: 'Configuration', conditional: { field: 'type', value: 'condition' }, hint: 'The condition to evaluate' },
    timeout:     { type: 'integer', label: 'Timeout (seconds)', formType: 'text', section: 'Configuration', hint: 'Timeout for interaction responses' },
    narrativeTemplate: { type: 'object', label: 'Narrative Template', formType: 'group', section: 'Narrative', children: {
      prefix: { type: 'string', label: 'Prefix', formType: 'text' },
      suffix: { type: 'string', label: 'Suffix', formType: 'text' },
    }},
  },

  /* ── Memory ────────────────────────────────────────────────────────── */
  memory: {
    name:        { type: 'string', required: true, label: 'Name', formType: 'text', section: 'Identity' },
    description: { type: 'string', label: 'Description', formType: 'textarea', section: 'Identity' },
    editable:    { type: 'boolean', label: 'Editable', formType: 'boolean', section: 'Behavior' },
    narrativeTemplate: { type: 'object', label: 'Narrative Template', formType: 'group', section: 'Narrative', children: {
      prefix: { type: 'string', label: 'Prefix', formType: 'text' },
      suffix: { type: 'string', label: 'Suffix', formType: 'text' },
    }},
  },
};

/* ── Helpers ──────────────────────────────────────────────────────────── */

/**
 * Get the validation-relevant subset of a schema (for validator.js).
 * Returns { fieldName: { type, required, enum, requiredWhen, literal } }
 */
function getValidationSchema(resourceType) {
  const schema = FRONTMATTER_SCHEMAS[resourceType];
  if (!schema) return null;
  const out = {};
  for (const [key, def] of Object.entries(schema)) {
    const v = { type: def.type };
    if (def.required) v.required = true;
    if (def.enum) v.enum = def.enum;
    if (def.requiredWhen) v.requiredWhen = def.requiredWhen;
    if (def.literal !== undefined) v.literal = def.literal;
    out[key] = v;
  }
  return out;
}

/**
 * Get the form-relevant subset of a schema (for FrontmatterForm.tsx).
 * Returns array of { key, label, type (formType), section, ... }
 */
function getFormSchema(resourceType) {
  const schema = FRONTMATTER_SCHEMAS[resourceType];
  if (!schema) return null;
  return Object.entries(schema)
    .filter(([, def]) => def.formType && def.label)
    .map(([key, def]) => {
      const field = { key, label: def.label, type: def.formType, section: def.section };
      if (def.required) field.required = true;
      if (def.enum) field.options = def.enum;
      if (def.hint) field.hintKey = key;
      if (def.conditional) field.conditional = def.conditional;
      if (def.children) {
        field.children = Object.entries(def.children).map(([ck, cd]) => {
          const child = { key: ck, label: cd.label, type: cd.formType };
          if (cd.hint) child.hintKey = ck;
          return child;
        });
      }
      return field;
    });
}

/**
 * Map a resource type from taxonomy to schema key.
 * Handles aliases: tool→capability, skill→instruction, template→runbook, interaction→runbook
 */
function resolveSchemaKey(resourceType) {
  const ALIASES = {
    tool: 'capability',
    skill: 'instruction',
    template: 'runbook',
    interaction: 'runbook',
    step: 'node',
    router: 'node',
    'sub-workflow': 'node',
  };
  return ALIASES[resourceType] || resourceType;
}

module.exports = {
  FRONTMATTER_SCHEMAS,
  getValidationSchema,
  getFormSchema,
  resolveSchemaKey,
};
