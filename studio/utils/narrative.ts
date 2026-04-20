import type { NarrativeTemplate, ResourceCategory } from '@/lib/types'

/**
 * Default narrative scaffolding per resource type.
 * Used when a resource does not declare a narrativeTemplate in its frontmatter.
 */
export const DEFAULT_NARRATIVE: Record<ResourceCategory, NarrativeTemplate> = {
  capabilities: { prefix: 'Use',           suffix: 'to' },
  instructions: { prefix: 'Apply',         suffix: 'to' },
  runbooks:     { prefix: 'When',          suffix: '' },
  memory:       { prefix: 'Recall from',   suffix: '' },
  hooks:        { prefix: '',              suffix: '' },
  customFiles:  { prefix: '',              suffix: '' },
}

/**
 * Extracts narrative scaffolding for a resource.
 *
 * If the resource's frontmatter declares a `narrativeTemplate` with prefix/suffix,
 * those values are used. Otherwise, falls back to the DEFAULT_NARRATIVE for the
 * resource's category.
 *
 * @param resource - An object with frontmatter and category information
 * @returns The resolved { prefix, suffix } narrative template
 */
export function getNarrativeScaffolding(resource: {
  frontmatter: Record<string, unknown>
  category: ResourceCategory
}): NarrativeTemplate {
  const { frontmatter, category } = resource

  // Check for frontmatter-declared narrativeTemplate
  if (frontmatter?.narrativeTemplate != null) {
    const tmpl = frontmatter.narrativeTemplate
    if (typeof tmpl === 'object' && tmpl !== null) {
      const obj = tmpl as Record<string, unknown>
      const prefix = typeof obj.prefix === 'string' ? obj.prefix : ''
      const suffix = typeof obj.suffix === 'string' ? obj.suffix : ''
      return { prefix, suffix }
    }
  }

  // Fall back to default narrative for the resource category
  return DEFAULT_NARRATIVE[category] ?? { prefix: '', suffix: '' }
}
