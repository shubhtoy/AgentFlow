import { describe, it, expect } from 'vitest';
import { DEFAULT_NARRATIVE, getNarrativeScaffolding } from '../../packages/core/src/utils/narrative.js';

describe('DEFAULT_NARRATIVE', () => {
  it('defines entries for all resource categories', () => {
    for (const cat of ['capabilities', 'instructions', 'skills', 'memory', 'hooks', 'customFiles']) {
      expect(DEFAULT_NARRATIVE[cat]).toBeDefined();
      expect(typeof DEFAULT_NARRATIVE[cat].prefix).toBe('string');
      expect(typeof DEFAULT_NARRATIVE[cat].suffix).toBe('string');
    }
  });

  it('has no runbooks entry', () => {
    expect(DEFAULT_NARRATIVE['runbooks']).toBeUndefined();
  });

  it('has expected default values', () => {
    expect(DEFAULT_NARRATIVE.capabilities).toEqual({ prefix: 'Use', suffix: 'to' });
    expect(DEFAULT_NARRATIVE.instructions).toEqual({ prefix: 'Apply', suffix: 'to' });
    expect(DEFAULT_NARRATIVE.skills).toEqual({ prefix: 'Apply', suffix: '' });
    expect(DEFAULT_NARRATIVE.memory).toEqual({ prefix: 'Recall from', suffix: '' });
    expect(DEFAULT_NARRATIVE.hooks).toEqual({ prefix: '', suffix: '' });
  });
});

describe('getNarrativeScaffolding', () => {
  it('returns default when no frontmatter narrativeTemplate', () => {
    expect(getNarrativeScaffolding({ frontmatter: {}, category: 'capabilities' }))
      .toEqual({ prefix: 'Use', suffix: 'to' });
  });

  it('uses frontmatter narrativeTemplate when present', () => {
    expect(getNarrativeScaffolding({
      frontmatter: { narrativeTemplate: { prefix: 'Invoke', suffix: 'now' } },
      category: 'capabilities',
    })).toEqual({ prefix: 'Invoke', suffix: 'now' });
  });

  it('handles partial narrativeTemplate', () => {
    expect(getNarrativeScaffolding({
      frontmatter: { narrativeTemplate: { prefix: 'Run' } },
      category: 'instructions',
    })).toEqual({ prefix: 'Run', suffix: '' });
  });

  it('falls back to defaults for each category', () => {
    for (const cat of ['capabilities', 'instructions', 'skills', 'memory', 'hooks', 'customFiles']) {
      expect(getNarrativeScaffolding({ frontmatter: {}, category: cat }))
        .toEqual(DEFAULT_NARRATIVE[cat]);
    }
  });

  it('returns empty for unknown category', () => {
    expect(getNarrativeScaffolding({ frontmatter: {}, category: 'unknown' }))
      .toEqual({ prefix: '', suffix: '' });
  });

  it('ignores non-object narrativeTemplate', () => {
    expect(getNarrativeScaffolding({ frontmatter: { narrativeTemplate: 'string' }, category: 'capabilities' }))
      .toEqual(DEFAULT_NARRATIVE.capabilities);
    expect(getNarrativeScaffolding({ frontmatter: { narrativeTemplate: null }, category: 'instructions' }))
      .toEqual(DEFAULT_NARRATIVE.instructions);
  });

  it('handles non-string prefix/suffix', () => {
    expect(getNarrativeScaffolding({
      frontmatter: { narrativeTemplate: { prefix: 42, suffix: true } },
      category: 'capabilities',
    })).toEqual({ prefix: '', suffix: '' });
  });
});
