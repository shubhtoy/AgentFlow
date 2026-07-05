/**
 * Frontmatter Schemas — single source of truth.
 *
 * Node type enum: step | sub-workflow.
 * Instruction: no scope/inclusion, has platforms. Skill & Condition are new.
 */

export type FieldType = 'string' | 'boolean' | 'integer' | 'string[]' | 'object' | 'object[]'
export type FormType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'boolean'
  | 'taglist'
  | 'group'
  | 'workflow-picker'
  | 'object-list'

export interface FieldDef {
  type: FieldType
  required?: boolean
  enum?: string[]
  requiredWhen?: { field: string; value: string }
  literal?: string
  label?: string
  section?: string
  formType?: FormType
  hint?: string
  conditional?: { field: string; value: string }
  children?: Record<string, FieldDef>
}

export type SchemaMap = Record<string, FieldDef>
export type FrontmatterSchemas = Record<string, SchemaMap>

export interface ValidationField {
  type: FieldType
  required?: boolean
  enum?: string[]
  requiredWhen?: { field: string; value: string }
  literal?: string
}

export interface FormField {
  key: string
  label: string
  type: FormType
  section?: string
  required?: boolean
  options?: string[]
  hintKey?: string
  conditional?: { field: string; value: string }
  children?: { key: string; label: string; type: FormType; hintKey?: string }[]
}

export const FRONTMATTER_SCHEMAS: FrontmatterSchemas = {
  /* ── Agents (identity) ─────────────────────────────────────────────── */
  agents: {
    type: { type: 'string', literal: 'agents', label: 'Type', formType: 'text', section: 'Identity' },
    name: { type: 'string', required: true, label: 'Name', formType: 'text', section: 'Identity' },
    description: { type: 'string', label: 'Description', formType: 'textarea', section: 'Identity' },
    identity: {
      type: 'object',
      label: 'Identity',
      formType: 'group',
      section: 'Identity',
      children: {
        name: { type: 'string', label: 'Agent Name', formType: 'text' },
        role: { type: 'string', label: 'Role', formType: 'textarea' },
        personality: { type: 'string', label: 'Personality', formType: 'text' },
        constraints: { type: 'string[]', label: 'Constraints', formType: 'taglist' },
      },
    },
  },

  /* ── Node (step | sub-workflow) ────────────────────────────────────── */
  node: {
    name: { type: 'string', required: true, label: 'Name', formType: 'text', section: 'Identity' },
    type: {
      type: 'string',
      required: true,
      enum: ['step', 'sub-workflow'],
      label: 'Type',
      formType: 'select',
      section: 'Identity',
    },
    description: { type: 'string', label: 'Description', formType: 'textarea', section: 'Identity' },
    workflow: {
      type: 'string',
      requiredWhen: { field: 'type', value: 'sub-workflow' },
      label: 'Linked Workflow',
      formType: 'workflow-picker',
      section: 'Identity',
    },
    entry: { type: 'boolean', label: 'Entry Point', formType: 'boolean', section: 'Behavior' },
    agent: {
      type: 'string',
      label: 'Agent Persona',
      formType: 'text',
      section: 'Behavior',
      hint: 'Override the default agent identity for this node',
    },
    model: {
      type: 'string',
      label: 'Preferred Model',
      formType: 'text',
      section: 'Behavior',
      hint: 'e.g. claude-sonnet-4-20250514, gpt-4o',
    },
    context: {
      type: 'object',
      label: 'Context Budget',
      formType: 'group',
      section: 'Context',
      children: {
        max_tokens: {
          type: 'integer',
          label: 'Max Tokens',
          formType: 'text',
          hint: "Token budget for this node's context window",
        },
        inputs: {
          type: 'string[]',
          label: 'Inputs (YAML)',
          formType: 'textarea',
          hint: 'External inputs: [\"output.node-name\"] or [{ref, scope}]',
        },
        exclude: {
          type: 'string[]',
          label: 'Exclude (YAML)',
          formType: 'textarea',
          hint: 'Patterns to exclude from context',
        },
      },
    },
    outputs: {
      type: 'object[]',
      label: 'Outputs',
      formType: 'object-list',
      section: 'Data Flow',
      children: {
        name: { type: 'string', label: 'Name', formType: 'text' },
        format: { type: 'string', label: 'Format', formType: 'text' },
        description: { type: 'string', label: 'Description', formType: 'text' },
      },
    },
  },

  /* ── Capability (tool) ─────────────────────────────────────────────── */
  capability: {
    name: { type: 'string', required: true, label: 'Name', formType: 'text', section: 'Identity' },
    type: {
      type: 'string',
      enum: ['builtin', 'script', 'mcp', 'package'],
      label: 'Type',
      formType: 'select',
      section: 'Identity',
    },
    description: { type: 'string', label: 'Description', formType: 'textarea', section: 'Identity' },
    outputs: {
      type: 'object[]',
      label: 'Outputs',
      formType: 'object-list',
      section: 'Data Flow',
      children: {
        name: { type: 'string', label: 'Name', formType: 'text' },
        format: { type: 'string', label: 'Format', formType: 'text' },
        description: { type: 'string', label: 'Description', formType: 'text' },
      },
    },
    parameters: {
      type: 'object',
      label: 'Parameters (YAML)',
      formType: 'textarea',
      section: 'Configuration',
      hint: 'JSON Schema for tool parameters',
    },
    command: {
      type: 'string',
      requiredWhen: { field: 'type', value: 'script' },
      label: 'Command',
      formType: 'text',
      section: 'Configuration',
      conditional: { field: 'type', value: 'script' },
    },
    mcp: {
      type: 'string',
      requiredWhen: { field: 'type', value: 'mcp' },
      label: 'MCP Server',
      formType: 'text',
      section: 'Configuration',
      conditional: { field: 'type', value: 'mcp' },
    },
    package: {
      type: 'string',
      requiredWhen: { field: 'type', value: 'package' },
      label: 'Package',
      formType: 'text',
      section: 'Configuration',
      conditional: { field: 'type', value: 'package' },
    },
    builtin_mapping: {
      type: 'string',
      label: 'Builtin Mapping',
      formType: 'text',
      section: 'Configuration',
      conditional: { field: 'type', value: 'builtin' },
    },
    narrativeTemplate: {
      type: 'object',
      label: 'Narrative Template',
      formType: 'group',
      section: 'Narrative',
      children: {
        prefix: { type: 'string', label: 'Prefix', formType: 'text' },
        suffix: { type: 'string', label: 'Suffix', formType: 'text' },
      },
    },
  },

  /* ── Instruction ───────────────────────────────────────────────────── */
  instruction: {
    name: { type: 'string', required: true, label: 'Name', formType: 'text', section: 'Identity' },
    description: { type: 'string', label: 'Description', formType: 'textarea', section: 'Identity' },
    domain: { type: 'string', label: 'Domain', formType: 'text', section: 'Identity' },
    tags: { type: 'string[]', label: 'Tags', formType: 'taglist', section: 'Identity' },
    max_tokens: { type: 'integer', label: 'Max Tokens', formType: 'text', section: 'Context' },
    platforms: {
      type: 'object',
      label: 'Platform Hints',
      formType: 'textarea',
      section: 'Configuration',
      hint: 'Opaque platform-specific hints (read by exporters)',
    },
    narrativeTemplate: {
      type: 'object',
      label: 'Narrative Template',
      formType: 'group',
      section: 'Narrative',
      children: {
        prefix: { type: 'string', label: 'Prefix', formType: 'text' },
        suffix: { type: 'string', label: 'Suffix', formType: 'text' },
      },
    },
  },

  /* ── Skill ─────────────────────────────────────────────────────────── */
  skill: {
    name: { type: 'string', required: true, label: 'Name', formType: 'text', section: 'Identity' },
    description: { type: 'string', required: true, label: 'Description', formType: 'textarea', section: 'Identity' },
    'allowed-tools': {
      type: 'string',
      label: 'Allowed Tools',
      formType: 'text',
      section: 'Configuration',
      hint: 'Agent Skills spec field',
    },
    tags: { type: 'string[]', label: 'Tags', formType: 'taglist', section: 'Identity' },
  },

  /* ── Condition ─────────────────────────────────────────────────────── */
  condition: {
    name: { type: 'string', required: true, label: 'Name', formType: 'text', section: 'Identity' },
    description: { type: 'string', label: 'Description', formType: 'textarea', section: 'Identity' },
    check: {
      type: 'string',
      label: 'Check Expression',
      formType: 'text',
      section: 'Configuration',
      hint: 'The condition to evaluate',
    },
  },

  /* ── Memory ────────────────────────────────────────────────────────── */
  memory: {
    name: { type: 'string', required: true, label: 'Name', formType: 'text', section: 'Identity' },
    description: { type: 'string', label: 'Description', formType: 'textarea', section: 'Identity' },
    editable: { type: 'boolean', label: 'Editable', formType: 'boolean', section: 'Behavior' },
    narrativeTemplate: {
      type: 'object',
      label: 'Narrative Template',
      formType: 'group',
      section: 'Narrative',
      children: {
        prefix: { type: 'string', label: 'Prefix', formType: 'text' },
        suffix: { type: 'string', label: 'Suffix', formType: 'text' },
      },
    },
  },
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

export function getValidationSchema(resourceType: string): Record<string, ValidationField> | null {
  const schema = FRONTMATTER_SCHEMAS[resourceType]
  if (!schema) return null
  const out: Record<string, ValidationField> = {}
  for (const [key, def] of Object.entries(schema)) {
    const v: ValidationField = { type: def.type }
    if (def.required) v.required = true
    if (def.enum) v.enum = def.enum
    if (def.requiredWhen) v.requiredWhen = def.requiredWhen
    if (def.literal !== undefined) v.literal = def.literal
    out[key] = v
  }
  return out
}

export function getFormSchema(resourceType: string): FormField[] | null {
  const schema = FRONTMATTER_SCHEMAS[resourceType]
  if (!schema) return null
  return Object.entries(schema)
    .filter(([, def]) => def.formType && def.label)
    .map(([key, def]) => {
      const field: FormField = { key, label: def.label!, type: def.formType!, section: def.section }
      if (def.required) field.required = true
      if (def.enum) field.options = def.enum
      if (def.hint) field.hintKey = key
      if (def.conditional) field.conditional = def.conditional
      if (def.children) {
        field.children = Object.entries(def.children).map(([ck, cd]) => {
          const child: { key: string; label: string; type: FormType; hintKey?: string } = {
            key: ck,
            label: cd.label!,
            type: cd.formType!,
          }
          if (cd.hint) child.hintKey = ck
          return child
        })
      }
      return field
    })
}

const SCHEMA_ALIASES: Record<string, string> = {
  tool: 'capability',
  step: 'node',
  router: 'node',
  'sub-workflow': 'node',
}

export function resolveSchemaKey(resourceType: string): string {
  return SCHEMA_ALIASES[resourceType] || resourceType
}
