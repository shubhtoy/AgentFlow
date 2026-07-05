import { parseRef, extractRefs, REF_PATTERNS } from '../../packages/cli/src/parser';

describe('REF_PATTERNS', () => {
  it('exports 4 patterns in the correct order', () => {
    expect(REF_PATTERNS).toHaveLength(4);
    expect(REF_PATTERNS[0].type).toBe('conditional_edge');
    expect(REF_PATTERNS[1].type).toBe('edge');
    expect(REF_PATTERNS[2].type).toBe('data_flow');
    expect(REF_PATTERNS[3].type).toBe('mention');
  });
});

describe('parseRef', () => {
  it('parses a mention ref', () => {
    const ref = parseRef('tools/search', 'mention', ['tools/search']);
    expect(ref).toEqual({
      raw: 'tools/search',
      semanticType: 'mention',
      category: 'tools',
      name: 'search',
    });
  });

  it('parses an edge ref', () => {
    const ref = parseRef('nodes/analyze', 'edge', ['nodes/analyze']);
    expect(ref).toEqual({
      raw: 'nodes/analyze',
      semanticType: 'edge',
      category: 'nodes',
      name: 'analyze',
    });
  });

  it('parses a conditional edge ref', () => {
    const ref = parseRef(
      '-> nodes/fix | templates/needs-fix',
      'conditional_edge',
      ['nodes/fix', 'templates/needs-fix']
    );
    expect(ref).toEqual({
      raw: '-> nodes/fix | templates/needs-fix',
      semanticType: 'edge',
      category: 'nodes',
      name: 'fix',
      condition: 'templates/needs-fix',
    });
  });

  it('parses a data flow ref', () => {
    const ref = parseRef('output.analyze', 'data_flow', ['output.analyze']);
    expect(ref).toEqual({
      raw: 'output.analyze',
      semanticType: 'data_flow',
      category: 'output',
      name: 'analyze',
    });
  });

  it('handles mention ref with no slash (category only)', () => {
    const ref = parseRef('readme', 'mention', ['readme']);
    expect(ref).toEqual({
      raw: 'readme',
      semanticType: 'mention',
      category: null,
      name: 'readme',
    });
  });

  it('conditional edge semanticType is edge, not conditional_edge', () => {
    const ref = parseRef(
      '-> nodes/a | templates/b',
      'conditional_edge',
      ['nodes/a', 'templates/b']
    );
    expect(ref.semanticType).toBe('edge');
  });
});

describe('extractRefs', () => {
  it('returns empty array for empty content', () => {
    expect(extractRefs('')).toEqual([]);
    expect(extractRefs(null)).toEqual([]);
    expect(extractRefs(undefined)).toEqual([]);
  });

  it('extracts a single mention ref', () => {
    const refs = extractRefs('Use {{tools/search}} here');
    expect(refs).toHaveLength(1);
    expect(refs[0].semanticType).toBe('mention');
    expect(refs[0].category).toBe('tools');
    expect(refs[0].name).toBe('search');
    expect(refs[0].offset).toBe(4);
    expect(refs[0].line).toBe(1);
  });

  it('extracts a single edge ref', () => {
    const refs = extractRefs('Go to {{-> nodes/next}}');
    expect(refs).toHaveLength(1);
    expect(refs[0].semanticType).toBe('edge');
    expect(refs[0].category).toBe('nodes');
    expect(refs[0].name).toBe('next');
  });

  it('extracts a conditional edge ref without double-matching as plain edge', () => {
    const refs = extractRefs('Route {{-> nodes/fix | templates/check}}');
    expect(refs).toHaveLength(1);
    expect(refs[0].semanticType).toBe('edge');
    expect(refs[0].category).toBe('nodes');
    expect(refs[0].name).toBe('fix');
    expect(refs[0].condition).toBe('templates/check');
  });

  it('extracts a data flow ref', () => {
    const refs = extractRefs('Using {{<< output.analyze}} data');
    expect(refs).toHaveLength(1);
    expect(refs[0].semanticType).toBe('data_flow');
    expect(refs[0].category).toBe('output');
    expect(refs[0].name).toBe('analyze');
  });

  it('extracts multiple refs of different types', () => {
    const content = [
      'Use {{tools/search}} to find things.',
      'Then go to {{-> nodes/analyze}}.',
      'Check {{<< output.search}} for results.',
      'Route via {{-> nodes/fix | templates/needs-fix}}.',
    ].join('\n');

    const refs = extractRefs(content);
    expect(refs).toHaveLength(4);

    // Sorted by offset
    expect(refs[0].semanticType).toBe('mention');
    expect(refs[0].category).toBe('tools');
    expect(refs[0].line).toBe(1);

    expect(refs[1].semanticType).toBe('edge');
    expect(refs[1].category).toBe('nodes');
    expect(refs[1].name).toBe('analyze');
    expect(refs[1].line).toBe(2);

    expect(refs[2].semanticType).toBe('data_flow');
    expect(refs[2].name).toBe('search');
    expect(refs[2].line).toBe(3);

    expect(refs[3].semanticType).toBe('edge');
    expect(refs[3].condition).toBe('templates/needs-fix');
    expect(refs[3].line).toBe(4);
  });

  it('calculates correct line numbers', () => {
    const content = 'line1\nline2 {{tools/a}}\nline3\nline4 {{-> nodes/b}}';
    const refs = extractRefs(content);
    expect(refs).toHaveLength(2);
    expect(refs[0].line).toBe(2);
    expect(refs[1].line).toBe(4);
  });

  it('does not double-match conditional edge as plain edge', () => {
    const content = '{{-> nodes/a | templates/b}} and {{-> nodes/c}}';
    const refs = extractRefs(content);
    expect(refs).toHaveLength(2);
    // First is conditional edge
    expect(refs[0].condition).toBe('templates/b');
    // Second is plain edge
    expect(refs[1].name).toBe('c');
    expect(refs[1].condition).toBeUndefined();
  });

  it('handles content with no refs', () => {
    const refs = extractRefs('Just plain markdown with no refs at all.');
    expect(refs).toEqual([]);
  });

  it('handles refs with extra whitespace', () => {
    const refs = extractRefs('{{->   nodes/target  }}');
    expect(refs).toHaveLength(1);
    expect(refs[0].semanticType).toBe('edge');
    expect(refs[0].name).toBe('target');
  });
});
