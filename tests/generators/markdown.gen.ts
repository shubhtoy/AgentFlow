const fc = require('fast-check');
const { anyRefArb, nameArb } = require('./refs.gen.js');

// --- Helpers ---

/** Arbitrary for a markdown title (1-5 words). */
const titleArb = fc
  .array(fc.stringMatching(/^[A-Z][a-z]{2,8}$/), { minLength: 1, maxLength: 5 })
  .map((words) => words.join(' '));

/** Arbitrary for a plain sentence (no ref tokens). */
const sentenceArb = fc
  .array(fc.stringMatching(/^[a-z]{2,10}$/), { minLength: 3, maxLength: 12 })
  .map((words) => words.join(' ') + '.');

/** Arbitrary for a paragraph (1-4 sentences). */
const paragraphArb = fc
  .array(sentenceArb, { minLength: 1, maxLength: 4 })
  .map((sentences) => sentences.join(' '));

// --- Frontmatter generators ---

/** Arbitrary for a single frontmatter value (string, number, or boolean). */
const fmValueArb = fc.oneof(
  nameArb,
  fc.integer({ min: 1, max: 1000 }),
  fc.boolean(),
);

/** Arbitrary for a non-empty frontmatter object with random fields. */
const frontmatterFieldsArb = fc
  .array(
    fc.record({ key: nameArb, value: fmValueArb }),
    { minLength: 1, maxLength: 5 },
  )
  .map((pairs) => {
    const obj = {};
    for (const { key, value } of pairs) {
      obj[key] = value;
    }
    return obj;
  });

/** Serialize a frontmatter object to YAML between --- delimiters. */
function serializeFrontmatter(fm) {
  const lines = Object.entries(fm).map(([k, v]) => {
    if (typeof v === 'string') return `${k}: ${v}`;
    return `${k}: ${v}`;
  });
  return `---\n${lines.join('\n')}\n---\n`;
}

// --- Core markdown file arbitraries ---

/**
 * Generate a markdown body with a title heading and paragraphs,
 * optionally embedding ref tokens at random positions.
 *
 * Returns { body, title, refs } where body is the markdown string
 * (without frontmatter), title is the heading text, and refs is
 * the list of embedded ref objects.
 */
function markdownBodyArb(refCount = { min: 0, max: 5 }) {
  return fc
    .record({
      title: titleArb,
      paragraphs: fc.array(paragraphArb, { minLength: 1, maxLength: 4 }),
      refs: fc.array(anyRefArb, { minLength: refCount.min, maxLength: refCount.max }),
    })
    .chain(({ title, paragraphs, refs }) => {
      if (refs.length === 0) {
        const body = `# ${title}\n\n${paragraphs.join('\n\n')}\n`;
        return fc.constant({ body, title, refs: [] });
      }
      // Distribute refs across paragraphs
      return fc
        .array(
          fc.integer({ min: 0, max: paragraphs.length - 1 }),
          { minLength: refs.length, maxLength: refs.length },
        )
        .map((indices) => {
          // Clone paragraphs so we can append refs
          const paras = [...paragraphs];
          for (let i = 0; i < refs.length; i++) {
            const idx = indices[i];
            paras[idx] = `${paras[idx]} ${refs[i].token}`;
          }
          const body = `# ${title}\n\n${paras.join('\n\n')}\n`;
          return { body, title, refs };
        });
    });
}

/**
 * markdownWithoutFrontmatterArb
 *
 * Generates a markdown file string with NO frontmatter block.
 * Output: { content, frontmatter: {}, title, refs, hasFrontmatter: false }
 */
const markdownWithoutFrontmatterArb = markdownBodyArb().map(({ body, title, refs }) => ({
  content: body,
  frontmatter: {},
  title,
  refs,
  hasFrontmatter: false,
}));

/**
 * markdownWithFrontmatterArb
 *
 * Generates a markdown file string WITH frontmatter (may be empty or populated).
 * Output: { content, frontmatter, title, refs, hasFrontmatter: true }
 */
const markdownWithFrontmatterArb = fc
  .record({
    fmType: fc.constantFrom('empty', 'populated'),
    body: markdownBodyArb(),
    fields: frontmatterFieldsArb,
  })
  .map(({ fmType, body, fields }) => {
    const fm = fmType === 'empty' ? {} : fields;
    const fmBlock = fmType === 'empty' ? '---\n---\n' : serializeFrontmatter(fm);
    return {
      content: fmBlock + body.body,
      frontmatter: fm,
      title: body.title,
      refs: body.refs,
      hasFrontmatter: true,
    };
  });

/**
 * markdownWithRefsArb
 *
 * Generates a markdown file that always contains at least 1 embedded ref.
 * May or may not have frontmatter.
 * Output: { content, frontmatter, title, refs, hasFrontmatter }
 */
const markdownWithRefsArb = fc
  .record({
    withFm: fc.boolean(),
    fmFields: frontmatterFieldsArb,
    body: markdownBodyArb({ min: 1, max: 6 }),
  })
  .map(({ withFm, fmFields, body }) => {
    if (!withFm) {
      return {
        content: body.body,
        frontmatter: {},
        title: body.title,
        refs: body.refs,
        hasFrontmatter: false,
      };
    }
    const fmBlock = serializeFrontmatter(fmFields);
    return {
      content: fmBlock + body.body,
      frontmatter: fmFields,
      title: body.title,
      refs: body.refs,
      hasFrontmatter: true,
    };
  });

/**
 * markdownFileArb
 *
 * General-purpose arbitrary: generates any valid markdown file content.
 * Randomly chooses between no frontmatter, empty frontmatter, and populated frontmatter.
 * May or may not contain refs.
 * Output: { content, frontmatter, title, refs, hasFrontmatter }
 */
const markdownFileArb = fc.oneof(
  markdownWithoutFrontmatterArb,
  markdownWithFrontmatterArb,
  markdownWithRefsArb,
);

module.exports = {
  markdownFileArb,
  markdownWithFrontmatterArb,
  markdownWithoutFrontmatterArb,
  markdownWithRefsArb,
  // Also export building blocks for composition in other generators
  titleArb,
  paragraphArb,
  sentenceArb,
  frontmatterFieldsArb,
  serializeFrontmatter,
};
