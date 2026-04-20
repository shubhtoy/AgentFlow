import { describe, it, expect } from 'vitest';

const {
  FRONTMATTER_SCHEMAS,
  getValidationSchema,
  getFormSchema,
  resolveSchemaKey,
} = require('../../packages/core/src/schemas/frontmatter-schemas');

describe('frontmatter-schemas', () => {
  const ALL_TYPES = ['agents', 'node', 'capability', 'instruction', 'runbook', 'memory'];

  describe('FRONTMATTER_SCHEMAS', () => {
    it('defines all resource types', () => {
      for (const t of ALL_TYPES) {
        expect(FRONTMATTER_SCHEMAS[t]).toBeDefined();
      }
    });

    it('every field has type and label', () => {
      for (const [type, schema] of Object.entries(FRONTMATTER_SCHEMAS)) {
        for (const [key, def] of Object.entries(schema)) {
          expect(def.type, `${type}.${key} missing type`).toBeDefined();
          expect(def.label, `${type}.${key} missing label`).toBeDefined();
        }
      }
    });

    it('every field with enum has valid type', () => {
      for (const [type, schema] of Object.entries(FRONTMATTER_SCHEMAS)) {
        for (const [key, def] of Object.entries(schema)) {
          if (def.enum) {
            expect(Array.isArray(def.enum), `${type}.${key} enum should be array`).toBe(true);
            expect(def.enum.length, `${type}.${key} enum should not be empty`).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  describe('getValidationSchema', () => {
    it('returns validation-relevant fields only', () => {
      const vs = getValidationSchema('node');
      expect(vs.name.type).toBe('string');
      expect(vs.name.required).toBe(true);
      expect(vs.type.enum).toContain('step');
      // Should NOT have UI fields
      expect(vs.name.label).toBeUndefined();
      expect(vs.name.formType).toBeUndefined();
    });

    it('returns null for unknown type', () => {
      expect(getValidationSchema('nonexistent')).toBeNull();
    });

    it('includes all fields from the schema', () => {
      for (const type of ALL_TYPES) {
        const vs = getValidationSchema(type);
        const schemaKeys = Object.keys(FRONTMATTER_SCHEMAS[type]);
        expect(Object.keys(vs).sort()).toEqual(schemaKeys.sort());
      }
    });
  });

  describe('getFormSchema', () => {
    it('returns array of form field definitions', () => {
      const fs = getFormSchema('node');
      expect(Array.isArray(fs)).toBe(true);
      expect(fs.length).toBeGreaterThan(0);
      const nameField = fs.find(f => f.key === 'name');
      expect(nameField.label).toBe('Name');
      expect(nameField.type).toBe('text');
      expect(nameField.required).toBe(true);
    });

    it('returns null for unknown type', () => {
      expect(getFormSchema('nonexistent')).toBeNull();
    });

    it('includes agents schema', () => {
      const fs = getFormSchema('agents');
      expect(fs).not.toBeNull();
      expect(fs.find(f => f.key === 'name')).toBeDefined();
      expect(fs.find(f => f.key === 'identity')).toBeDefined();
    });
  });

  describe('resolveSchemaKey', () => {
    it('maps old validator names to new schema keys', () => {
      expect(resolveSchemaKey('tool')).toBe('capability');
      expect(resolveSchemaKey('skill')).toBe('instruction');
      expect(resolveSchemaKey('template')).toBe('runbook');
      expect(resolveSchemaKey('interaction')).toBe('runbook');
      expect(resolveSchemaKey('step')).toBe('node');
      expect(resolveSchemaKey('router')).toBe('node');
      expect(resolveSchemaKey('sub-workflow')).toBe('node');
    });

    it('passes through canonical names', () => {
      expect(resolveSchemaKey('node')).toBe('node');
      expect(resolveSchemaKey('capability')).toBe('capability');
      expect(resolveSchemaKey('instruction')).toBe('instruction');
      expect(resolveSchemaKey('runbook')).toBe('runbook');
      expect(resolveSchemaKey('memory')).toBe('memory');
      expect(resolveSchemaKey('agents')).toBe('agents');
    });
  });

  describe('field coverage', () => {
    it('node schema has all fields used in library examples', () => {
      const keys = Object.keys(FRONTMATTER_SCHEMAS.node);
      for (const f of ['name', 'type', 'description', 'entry', 'primary', 'agent', 'model', 'context', 'outputs', 'workflow']) {
        expect(keys, `node missing ${f}`).toContain(f);
      }
    });

    it('capability schema has all fields used in library examples', () => {
      const keys = Object.keys(FRONTMATTER_SCHEMAS.capability);
      for (const f of ['name', 'type', 'description', 'command', 'mcp', 'package', 'parameters', 'builtin_mapping', 'outputs', 'narrativeTemplate']) {
        expect(keys, `capability missing ${f}`).toContain(f);
      }
    });

    it('instruction schema has scope and inclusion', () => {
      const keys = Object.keys(FRONTMATTER_SCHEMAS.instruction);
      expect(keys).toContain('scope');
      expect(keys).toContain('inclusion');
    });

    it('runbook schema unifies conditions and interactions', () => {
      const keys = Object.keys(FRONTMATTER_SCHEMAS.runbook);
      expect(keys).toContain('check');    // from old template schema
      expect(keys).toContain('timeout');  // from old interaction schema
      expect(FRONTMATTER_SCHEMAS.runbook.type.enum).toContain('condition');
      expect(FRONTMATTER_SCHEMAS.runbook.type.enum).toContain('approval');
    });
  });
});
