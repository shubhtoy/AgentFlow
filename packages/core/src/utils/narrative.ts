/**
 * Narrative scaffolding utilities.
 */

export interface NarrativeTemplate {
  prefix: string
  suffix: string
}

export const DEFAULT_NARRATIVE: Record<string, NarrativeTemplate> = {
  capabilities: { prefix: 'Use', suffix: 'to' },
  instructions: { prefix: 'Apply', suffix: 'to' },
  skills: { prefix: 'Apply', suffix: '' },
  memory: { prefix: 'Recall from', suffix: '' },
  hooks: { prefix: '', suffix: '' },
  customFiles: { prefix: '', suffix: '' },
}

export function getNarrativeScaffolding(opts: {
  frontmatter?: Record<string, unknown> | null
  category: string
}): NarrativeTemplate {
  const tmpl = opts.frontmatter?.narrativeTemplate
  if (tmpl != null && typeof tmpl === 'object' && !Array.isArray(tmpl)) {
    const t = tmpl as Record<string, unknown>
    return {
      prefix: typeof t.prefix === 'string' ? t.prefix : '',
      suffix: typeof t.suffix === 'string' ? t.suffix : '',
    }
  }
  return DEFAULT_NARRATIVE[opts.category] ?? { prefix: '', suffix: '' }
}
