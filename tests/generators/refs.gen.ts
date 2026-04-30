const fc = require('fast-check');

// Valid categories from the design doc
const VALID_CATEGORIES = ['tools', 'skills', 'nodes', 'templates', 'interactions', 'memory'];

/**
 * Arbitrary for a valid category string.
 */
const categoryArb = fc.constantFrom(...VALID_CATEGORIES);

/**
 * Arbitrary for a valid name string (alphanumeric, hyphens, underscores, at least 1 char).
 */
const nameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,19}$/);

/**
 * Mention ref: {{category/name}}
 * Semantic type: mention
 */
const mentionRefArb = fc.record({
  category: categoryArb,
  name: nameArb,
}).map(({ category, name }) => ({
  token: `{{${category}/${name}}}`,
  semanticType: 'mention',
  category,
  name,
}));

/**
 * Edge ref: {{-> category/name}}
 * Semantic type: edge
 */
const edgeRefArb = fc.record({
  category: categoryArb,
  name: nameArb,
}).map(({ category, name }) => ({
  token: `{{-> ${category}/${name}}}`,
  semanticType: 'edge',
  category,
  name,
}));

/**
 * Conditional edge ref: {{-> category/name | templates/condName}}
 * Semantic type: edge
 */
const conditionalEdgeRefArb = fc.record({
  category: categoryArb,
  name: nameArb,
  conditionName: nameArb,
}).map(({ category, name, conditionName }) => ({
  token: `{{-> ${category}/${name} | templates/${conditionName}}}`,
  semanticType: 'edge',
  category,
  name,
  condition: `templates/${conditionName}`,
}));

/**
 * Data flow ref: {{<< output.nodeName}}
 * Semantic type: data_flow
 */
const dataFlowRefArb = nameArb.map((name) => ({
  token: `{{<< output.${name}}}`,
  semanticType: 'data_flow',
  category: 'output',
  name,
}));

/**
 * Combined arbitrary that produces any of the 4 ref types.
 */
const anyRefArb = fc.oneof(
  mentionRefArb,
  edgeRefArb,
  conditionalEdgeRefArb,
  dataFlowRefArb,
);

module.exports = {
  VALID_CATEGORIES,
  categoryArb,
  nameArb,
  mentionRefArb,
  edgeRefArb,
  conditionalEdgeRefArb,
  dataFlowRefArb,
  anyRefArb,
};
