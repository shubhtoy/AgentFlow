/**
 * Frontmatter schema validation.
 */

import { getValidationSchema } from '../schemas/frontmatter-schemas'
import type { ValidationField } from '../schemas/frontmatter-schemas'
import type { ValidationIssue } from './types'

const SCHEMA_TYPES = ['agents', 'node', 'capability', 'instruction', 'skill', 'condition', 'memory'] as const
export const SCHEMAS: Record<string, Record<string, ValidationField>> = {}
for (const type of SCHEMA_TYPES) {
  const s = getValidationSchema(type)
  if (s) SCHEMAS[type] = s
}

export function validateSchema(
  frontmatter: Record<string, unknown>,
  resourceType: string,
  filePath = '',
): ValidationIssue[] {
  const errors: ValidationIssue[] = []
  const schema = SCHEMAS[resourceType]
  if (!schema) return errors
  const fm = frontmatter || {}

  for (const [field, rules] of Object.entries(schema)) {
    const value = fm[field]

    if (rules.literal !== undefined) {
      if (value !== undefined && value !== rules.literal) {
        errors.push({
          type: 'schema',
          filePath,
          field,
          message: `Expected literal value "${rules.literal}" but got "${value}"`,
          resourceType,
        })
      }
      continue
    }

    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({ type: 'schema', filePath, field, message: `Missing required field "${field}"`, resourceType })
      continue
    }

    if (rules.requiredWhen) {
      const { field: depField, value: depValue } = rules.requiredWhen
      if (fm[depField] === depValue && (value === undefined || value === null || value === '')) {
        errors.push({
          type: 'schema',
          filePath,
          field,
          message: `Field "${field}" is required when "${depField}" is "${depValue}"`,
          resourceType,
        })
        continue
      }
    }

    if (value === undefined || value === null) continue

    if (rules.type === 'string' && typeof value !== 'string') {
      errors.push({
        type: 'schema',
        filePath,
        field,
        message: `Expected string for "${field}" but got ${typeof value}`,
        resourceType,
      })
    } else if (rules.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) {
      errors.push({
        type: 'schema',
        filePath,
        field,
        message: `Expected integer for "${field}" but got ${typeof value === 'number' ? 'non-integer number' : typeof value}`,
        resourceType,
      })
    } else if (rules.type === 'boolean' && typeof value !== 'boolean') {
      errors.push({
        type: 'schema',
        filePath,
        field,
        message: `Expected boolean for "${field}" but got ${typeof value}`,
        resourceType,
      })
    } else if (rules.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
      errors.push({
        type: 'schema',
        filePath,
        field,
        message: `Expected object for "${field}" but got ${Array.isArray(value) ? 'array' : typeof value}`,
        resourceType,
      })
    } else if (rules.type === 'object[]') {
      if (!Array.isArray(value)) {
        errors.push({
          type: 'schema',
          filePath,
          field,
          message: `Expected array of objects for "${field}" but got ${typeof value}`,
          resourceType,
        })
      } else if (value.some(v => typeof v !== 'object' || v === null || Array.isArray(v))) {
        errors.push({
          type: 'schema',
          filePath,
          field,
          message: `Expected all elements of "${field}" to be objects`,
          resourceType,
        })
      }
    } else if (rules.type === 'string[]') {
      if (!Array.isArray(value)) {
        errors.push({
          type: 'schema',
          filePath,
          field,
          message: `Expected array of strings for "${field}" but got ${typeof value}`,
          resourceType,
        })
      } else if (value.some(v => typeof v !== 'string')) {
        errors.push({
          type: 'schema',
          filePath,
          field,
          message: `Expected all elements of "${field}" to be strings`,
          resourceType,
        })
      }
    }

    if (rules.enum && value !== undefined && value !== null) {
      if (!rules.enum.includes(value as string)) {
        errors.push({
          type: 'schema',
          filePath,
          field,
          message: `Invalid value "${value}" for "${field}". Allowed: ${rules.enum.join(', ')}`,
          resourceType,
        })
      }
    }
  }

  return errors
}
