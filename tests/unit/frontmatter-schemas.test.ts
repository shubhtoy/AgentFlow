import { describe, it, expect } from 'vitest';
import {
  FRONTMATTER_SCHEMAS,
  getValidationSchema,
  getFormSchema,
  resolveSchemaKey,
} from '../../packages/core/src/schemas/frontmatter-schemas.js';

const ALL_TYPES = ['agents', 'node', 'capability', 'instruction', 'skill', 'condition', 'memory'];

describe('FRONTMATTER_SCHEMAS', () => {
  it('defines agents, node, capability, instruction, skill, condition, memory', () => {
    for (const t of ALL_TYPES) {
      expect(FRONTMATTER_SCHEMAS[t], `missing schema for ${t}`).toBeDefined();
    }
  });

  it('does NOT define a runbook schema', () => {
    expect(FRONTMATTER_SCHEMAS['runbook']).toBeUndefined();
  });

  it('every field has type and label', () => {
    for (const [type, schema] of Object.entries(FRONTMATTER_SCHEMAS)) {
      for (const [key, def] of Object.entries(schema)) {
        expect(def.type, `${type}.${key} missing type`).toBeDefined();
        expect(def.label, `${type}.${key} missing label`).toBeDefined();
      }
    }
  });

  it('node type enum is [step, sub-workflow]', () => {
    expect(FRONTMATTER_SCHEMAS.node.type.enum).toEqual(['step', 'sub-workflow']);
  });
});

describe('getValidationSchema', () => {
  it('returns validation fields without UI properties', () => {
    const vs = getValidationSchema('node');
    expect(vs.name.type).toBe('string');
    expect(vs.name.required).toBe(true);
    expect(vs.type.enum).toContain('step');
    expect(vs.type.enum).toContain('sub-workflow');
    expect(vs.name.label).toBeUndefined();
    expect(vs.name.formType).toBeUndefined();
  });

  it('returns null for unknown type', () => {
    expect(getValidationSchema('nonexistent')).toBeNull();
    expect(getValidationSchema('runbook')).toBeNull();
  });

  it('returns schemas for all defined types', () => {
    for (const type of ALL_TYPES) {
      const vs = getValidationSchema(type);
      expect(vs, `getValidationSchema('${type}') returned null`).not.toBeNull();
      expect(Object.keys(vs).sort()).toEqual(Object.keys(FRONTMATTER_SCHEMAS[type]).sort());
    }
  });
});

describe('getFormSchema', () => {
  it('returns array of form field definitions', () => {
    const fs = getFormSchema('node');
    expect(Array.isArray(fs)).toBe(true);
    const nameField = fs.find(f => f.key === 'name');
    expect(nameField.label).toBe('Name');
    expect(nameField.type).toBe('text');
    expect(nameField.required).toBe(true);
  });

  it('returns null for unknown type', () => {
    expect(getFormSchema('nonexistent')).toBeNull();
    expect(getFormSchema('runbook')).toBeNull();
  });

  it('includes agents identity group', () => {
    const fs = getFormSchema('agents');
    expect(fs).not.toBeNull();
    expect(fs.find(f => f.key === 'identity')).toBeDefined();
  });
});

describe('resolveSchemaKey', () => {
  it('maps aliases to canonical keys', () => {
    expect(resolveSchemaKey('tool')).toBe('capability');
    expect(resolveSchemaKey('step')).toBe('node');
    expect(resolveSchemaKey('router')).toBe('node');
    expect(resolveSchemaKey('sub-workflow')).toBe('node');
  });

  it('passes through canonical names', () => {
    expect(resolveSchemaKey('node')).toBe('node');
    expect(resolveSchemaKey('capability')).toBe('capability');
    expect(resolveSchemaKey('instruction')).toBe('instruction');
    expect(resolveSchemaKey('skill')).toBe('skill');
    expect(resolveSchemaKey('memory')).toBe('memory');
    expect(resolveSchemaKey('agents')).toBe('agents');
  });
});
