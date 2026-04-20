import { describe, it, expect } from 'vitest'
import { DEFAULT_NARRATIVE, getNarrativeScaffolding } from '../../src/utils/narrative.js'

describe('DEFAULT_NARRATIVE', () => {
  it('defines entries for all resource categories', () => {
    const categories = ['capabilities', 'instructions', 'runbooks', 'memory', 'hooks', 'customFiles']
    for (const cat of categories) {
      expect(DEFAULT_NARRATIVE[cat]).toBeDefined()
      expect(typeof DEFAULT_NARRATIVE[cat].prefix).toBe('string')
      expect(typeof DEFAULT_NARRATIVE[cat].suffix).toBe('string')
    }
  })

  it('has expected default values', () => {
    expect(DEFAULT_NARRATIVE.capabilities).toEqual({ prefix: 'Use', suffix: 'to' })
    expect(DEFAULT_NARRATIVE.instructions).toEqual({ prefix: 'Apply', suffix: 'to' })
    expect(DEFAULT_NARRATIVE.runbooks).toEqual({ prefix: 'When', suffix: '' })
    expect(DEFAULT_NARRATIVE.memory).toEqual({ prefix: 'Recall from', suffix: '' })
    expect(DEFAULT_NARRATIVE.hooks).toEqual({ prefix: '', suffix: '' })
  })
})

describe('getNarrativeScaffolding', () => {
  it('returns default narrative when frontmatter has no narrativeTemplate', () => {
    const result = getNarrativeScaffolding({
      frontmatter: {},
      category: 'capabilities',
    })
    expect(result).toEqual({ prefix: 'Use', suffix: 'to' })
  })

  it('returns frontmatter narrativeTemplate when declared', () => {
    const result = getNarrativeScaffolding({
      frontmatter: {
        narrativeTemplate: { prefix: 'Invoke', suffix: 'now' },
      },
      category: 'capabilities',
    })
    expect(result).toEqual({ prefix: 'Invoke', suffix: 'now' })
  })

  it('handles narrativeTemplate with only prefix', () => {
    const result = getNarrativeScaffolding({
      frontmatter: {
        narrativeTemplate: { prefix: 'Run' },
      },
      category: 'instructions',
    })
    expect(result).toEqual({ prefix: 'Run', suffix: '' })
  })

  it('handles narrativeTemplate with only suffix', () => {
    const result = getNarrativeScaffolding({
      frontmatter: {
        narrativeTemplate: { suffix: 'for analysis' },
      },
      category: 'memory',
    })
    expect(result).toEqual({ prefix: '', suffix: 'for analysis' })
  })

  it('falls back to default for each category', () => {
    const categories = ['capabilities', 'instructions', 'runbooks', 'memory', 'hooks', 'customFiles']
    for (const cat of categories) {
      const result = getNarrativeScaffolding({ frontmatter: {}, category: cat })
      expect(result).toEqual(DEFAULT_NARRATIVE[cat])
    }
  })

  it('returns empty prefix/suffix for unknown category with no frontmatter template', () => {
    const result = getNarrativeScaffolding({
      frontmatter: {},
      category: 'unknown_category',
    })
    expect(result).toEqual({ prefix: '', suffix: '' })
  })

  it('ignores non-object narrativeTemplate values', () => {
    const result = getNarrativeScaffolding({
      frontmatter: { narrativeTemplate: 'just a string' },
      category: 'capabilities',
    })
    expect(result).toEqual(DEFAULT_NARRATIVE.capabilities)
  })

  it('ignores null narrativeTemplate', () => {
    const result = getNarrativeScaffolding({
      frontmatter: { narrativeTemplate: null },
      category: 'instructions',
    })
    expect(result).toEqual(DEFAULT_NARRATIVE.instructions)
  })

  it('handles non-string prefix/suffix in narrativeTemplate', () => {
    const result = getNarrativeScaffolding({
      frontmatter: {
        narrativeTemplate: { prefix: 42, suffix: true },
      },
      category: 'capabilities',
    })
    expect(result).toEqual({ prefix: '', suffix: '' })
  })
})
