const fc = require('fast-check');
const {
  VALID_CATEGORIES,
  mentionRefArb,
  edgeRefArb,
  conditionalEdgeRefArb,
  dataFlowRefArb,
  anyRefArb,
} = require('./refs.gen.ts');

describe('refs.gen - ref generators', () => {
  it('mentionRefArb produces valid mention refs', () => {
    fc.assert(
      fc.property(mentionRefArb, (ref) => {
        expect(ref.semanticType).toBe('mention');
        expect(VALID_CATEGORIES).toContain(ref.category);
        expect(ref.name.length).toBeGreaterThan(0);
        expect(ref.token).toBe(`{{${ref.category}/${ref.name}}}`);
        expect(ref.condition).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it('edgeRefArb produces valid edge refs', () => {
    fc.assert(
      fc.property(edgeRefArb, (ref) => {
        expect(ref.semanticType).toBe('edge');
        expect(VALID_CATEGORIES).toContain(ref.category);
        expect(ref.name.length).toBeGreaterThan(0);
        expect(ref.token).toBe(`{{-> ${ref.category}/${ref.name}}}`);
        expect(ref.condition).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it('conditionalEdgeRefArb produces valid conditional edge refs', () => {
    fc.assert(
      fc.property(conditionalEdgeRefArb, (ref) => {
        expect(ref.semanticType).toBe('edge');
        expect(VALID_CATEGORIES).toContain(ref.category);
        expect(ref.name.length).toBeGreaterThan(0);
        expect(ref.condition).toBeDefined();
        expect(ref.condition).toMatch(/^templates\//);
        expect(ref.token).toBe(`{{-> ${ref.category}/${ref.name} | ${ref.condition}}}`);
      }),
      { numRuns: 100 },
    );
  });

  it('dataFlowRefArb produces valid data flow refs', () => {
    fc.assert(
      fc.property(dataFlowRefArb, (ref) => {
        expect(ref.semanticType).toBe('data_flow');
        expect(ref.category).toBe('output');
        expect(ref.name.length).toBeGreaterThan(0);
        expect(ref.token).toBe(`{{<< output.${ref.name}}}`);
        expect(ref.condition).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it('anyRefArb produces one of the 4 ref types', () => {
    const seenTypes = new Set();
    fc.assert(
      fc.property(anyRefArb, (ref) => {
        expect(['mention', 'edge', 'data_flow']).toContain(ref.semanticType);
        expect(ref.token).toBeDefined();
        expect(ref.name.length).toBeGreaterThan(0);
        seenTypes.add(ref.token.startsWith('{{->') ? (ref.condition ? 'conditional_edge' : 'edge') :
          ref.token.startsWith('{{<<') ? 'data_flow' : 'mention');
      }),
      { numRuns: 200 },
    );
    // With 200 runs, we should see all 4 types
    expect(seenTypes.size).toBe(4);
  });

  it('generated names contain only valid characters', () => {
    fc.assert(
      fc.property(anyRefArb, (ref) => {
        expect(ref.name).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
      }),
      { numRuns: 100 },
    );
  });
});
