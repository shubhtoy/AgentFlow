const fc = require('fast-check');
const {
  validToolFmArb, invalidToolFmArb,
  validSkillFmArb, invalidSkillFmArb,
  validTemplateFmArb, invalidTemplateFmArb,
  validInteractionFmArb, invalidInteractionFmArb,
  validMemoryFmArb, invalidMemoryFmArb,
  validNodeFmArb, invalidNodeFmArb,
  validAgentsFmArb, invalidAgentsFmArb,
  validFrontmatterArb, invalidFrontmatterArb, anyFrontmatterArb,
  TOOL_TYPES, INTERACTION_TYPES, NODE_TYPES,
} = require('./frontmatter.gen.js');

describe('frontmatter generators', () => {
  // --- Structure checks ---

  test('valid generators produce { frontmatter, resourceType, isValid: true }', () => {
    fc.assert(
      fc.property(validFrontmatterArb, (result) => {
        expect(result).toHaveProperty('frontmatter');
        expect(result).toHaveProperty('resourceType');
        expect(result.isValid).toBe(true);
        expect(result.violations).toBeUndefined();
        expect(typeof result.frontmatter).toBe('object');
      }),
      { numRuns: 200 },
    );
  });

  test('invalid generators produce { frontmatter, resourceType, isValid: false, violations }', () => {
    fc.assert(
      fc.property(invalidFrontmatterArb, (result) => {
        expect(result).toHaveProperty('frontmatter');
        expect(result).toHaveProperty('resourceType');
        expect(result.isValid).toBe(false);
        expect(Array.isArray(result.violations)).toBe(true);
        expect(result.violations.length).toBeGreaterThan(0);
        for (const v of result.violations) {
          expect(v).toHaveProperty('field');
          expect(v).toHaveProperty('reason');
        }
      }),
      { numRuns: 200 },
    );
  });

  // --- Tool ---

  test('valid tool frontmatter has required name field', () => {
    fc.assert(
      fc.property(validToolFmArb, ({ frontmatter }) => {
        expect(typeof frontmatter.name).toBe('string');
        if (frontmatter.type === 'script') expect(typeof frontmatter.command).toBe('string');
        if (frontmatter.type === 'mcp') expect(typeof frontmatter.mcp).toBe('string');
        if (frontmatter.type === 'package') expect(typeof frontmatter.package).toBe('string');
      }),
      { numRuns: 100 },
    );
  });

  test('valid tool type is a known enum value', () => {
    fc.assert(
      fc.property(validToolFmArb, ({ frontmatter }) => {
        if (frontmatter.type !== undefined) {
          expect(TOOL_TYPES).toContain(frontmatter.type);
        }
      }),
      { numRuns: 100 },
    );
  });

  // --- Skill ---

  test('valid skill frontmatter has only optional fields with correct types', () => {
    fc.assert(
      fc.property(validSkillFmArb, ({ frontmatter }) => {
        if (frontmatter.name !== undefined) expect(typeof frontmatter.name).toBe('string');
        if (frontmatter.description !== undefined) expect(typeof frontmatter.description).toBe('string');
        if (frontmatter.domain !== undefined) expect(typeof frontmatter.domain).toBe('string');
        if (frontmatter.max_tokens !== undefined) expect(typeof frontmatter.max_tokens).toBe('number');
        if (frontmatter.tags !== undefined) expect(Array.isArray(frontmatter.tags)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // --- Template ---

  test('valid template frontmatter has required name and check', () => {
    fc.assert(
      fc.property(validTemplateFmArb, ({ frontmatter }) => {
        expect(typeof frontmatter.name).toBe('string');
        expect(typeof frontmatter.check).toBe('string');
      }),
      { numRuns: 100 },
    );
  });

  // --- Interaction ---

  test('valid interaction frontmatter has required name and type', () => {
    fc.assert(
      fc.property(validInteractionFmArb, ({ frontmatter }) => {
        expect(typeof frontmatter.name).toBe('string');
        expect(INTERACTION_TYPES).toContain(frontmatter.type);
      }),
      { numRuns: 100 },
    );
  });

  // --- Memory ---

  test('valid memory frontmatter has only optional fields with correct types', () => {
    fc.assert(
      fc.property(validMemoryFmArb, ({ frontmatter }) => {
        if (frontmatter.name !== undefined) expect(typeof frontmatter.name).toBe('string');
        if (frontmatter.description !== undefined) expect(typeof frontmatter.description).toBe('string');
        if (frontmatter.editable !== undefined) expect(typeof frontmatter.editable).toBe('boolean');
      }),
      { numRuns: 100 },
    );
  });

  // --- Node ---

  test('valid node frontmatter has only optional fields with correct types', () => {
    fc.assert(
      fc.property(validNodeFmArb, ({ frontmatter }) => {
        if (frontmatter.name !== undefined) expect(typeof frontmatter.name).toBe('string');
        if (frontmatter.type !== undefined) expect(NODE_TYPES).toContain(frontmatter.type);
        if (frontmatter.entry !== undefined) expect(typeof frontmatter.entry).toBe('boolean');
        if (frontmatter.primary !== undefined) expect(typeof frontmatter.primary).toBe('boolean');
      }),
      { numRuns: 100 },
    );
  });

  // --- Agents ---

  test('valid agents frontmatter always has type: agents', () => {
    fc.assert(
      fc.property(validAgentsFmArb, ({ frontmatter }) => {
        expect(frontmatter.type).toBe('agents');
      }),
      { numRuns: 100 },
    );
  });

  // --- anyFrontmatterArb ---

  test('anyFrontmatterArb produces both valid and invalid results', () => {
    const results = fc.sample(anyFrontmatterArb, 100);
    const hasValid = results.some((r) => r.isValid);
    const hasInvalid = results.some((r) => !r.isValid);
    expect(hasValid).toBe(true);
    expect(hasInvalid).toBe(true);
  });

  // --- Resource type coverage ---

  test('combined generators cover all resource types', () => {
    const results = fc.sample(anyFrontmatterArb, 300);
    const types = new Set(results.map((r) => r.resourceType));
    expect(types).toContain('tool');
    expect(types).toContain('skill');
    expect(types).toContain('template');
    expect(types).toContain('interaction');
    expect(types).toContain('memory');
    expect(types).toContain('node');
    expect(types).toContain('agents');
  });
});
