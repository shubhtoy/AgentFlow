const fc = require('fast-check');
const {
  markdownFileArb,
  markdownWithFrontmatterArb,
  markdownWithoutFrontmatterArb,
  markdownWithRefsArb,
} = require('./markdown.gen.js');

describe('markdown.gen - markdown file generators', () => {
  it('markdownFileArb produces valid output shape', () => {
    fc.assert(
      fc.property(markdownFileArb, (file) => {
        expect(typeof file.content).toBe('string');
        expect(file.content.length).toBeGreaterThan(0);
        expect(typeof file.frontmatter).toBe('object');
        expect(typeof file.title).toBe('string');
        expect(file.title.length).toBeGreaterThan(0);
        expect(Array.isArray(file.refs)).toBe(true);
        expect(typeof file.hasFrontmatter).toBe('boolean');
      }),
      { numRuns: 100 },
    );
  });

  it('markdownWithoutFrontmatterArb has no frontmatter block', () => {
    fc.assert(
      fc.property(markdownWithoutFrontmatterArb, (file) => {
        expect(file.hasFrontmatter).toBe(false);
        expect(file.content.startsWith('---')).toBe(false);
        expect(Object.keys(file.frontmatter).length).toBe(0);
        // Should start with a title heading
        expect(file.content).toMatch(/^# .+/);
      }),
      { numRuns: 100 },
    );
  });

  it('markdownWithFrontmatterArb always has frontmatter delimiters', () => {
    fc.assert(
      fc.property(markdownWithFrontmatterArb, (file) => {
        expect(file.hasFrontmatter).toBe(true);
        expect(file.content.startsWith('---\n')).toBe(true);
        // Should have closing --- delimiter
        const secondDelim = file.content.indexOf('---', 4);
        expect(secondDelim).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('markdownWithFrontmatterArb supports empty frontmatter', () => {
    // Run enough times to see both empty and populated
    const results = [];
    fc.assert(
      fc.property(markdownWithFrontmatterArb, (file) => {
        results.push(Object.keys(file.frontmatter).length === 0);
      }),
      { numRuns: 200 },
    );
    // Should see at least one empty frontmatter case
    expect(results.some((isEmpty) => isEmpty)).toBe(true);
    // Should see at least one populated frontmatter case
    expect(results.some((isEmpty) => !isEmpty)).toBe(true);
  });

  it('markdownWithRefsArb always contains at least one ref', () => {
    fc.assert(
      fc.property(markdownWithRefsArb, (file) => {
        expect(file.refs.length).toBeGreaterThanOrEqual(1);
        // Every ref token should appear in the content
        for (const ref of file.refs) {
          expect(file.content).toContain(ref.token);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('embedded refs appear in the content string', () => {
    fc.assert(
      fc.property(markdownFileArb, (file) => {
        for (const ref of file.refs) {
          expect(file.content).toContain(ref.token);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('title appears as a heading in the content', () => {
    fc.assert(
      fc.property(markdownFileArb, (file) => {
        expect(file.content).toContain(`# ${file.title}`);
      }),
      { numRuns: 100 },
    );
  });

  it('frontmatter fields appear in content when hasFrontmatter is true', () => {
    fc.assert(
      fc.property(markdownWithFrontmatterArb, (file) => {
        if (Object.keys(file.frontmatter).length > 0) {
          for (const key of Object.keys(file.frontmatter)) {
            expect(file.content).toContain(`${key}:`);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
