'use strict';

const DEFAULT_NARRATIVE = {
  capabilities: { prefix: 'Use',         suffix: 'to' },
  instructions: { prefix: 'Apply',       suffix: 'to' },
  runbooks:     { prefix: 'When',        suffix: '' },
  memory:       { prefix: 'Recall from', suffix: '' },
  hooks:        { prefix: '',            suffix: '' },
  customFiles:  { prefix: '',            suffix: '' },
};

function getNarrativeScaffolding({ frontmatter, category }) {
  if (frontmatter?.narrativeTemplate != null) {
    const tmpl = frontmatter.narrativeTemplate;
    if (typeof tmpl === 'object' && tmpl !== null) {
      return {
        prefix: typeof tmpl.prefix === 'string' ? tmpl.prefix : '',
        suffix: typeof tmpl.suffix === 'string' ? tmpl.suffix : '',
      };
    }
  }
  return DEFAULT_NARRATIVE[category] ?? { prefix: '', suffix: '' };
}

module.exports = { DEFAULT_NARRATIVE, getNarrativeScaffolding };
