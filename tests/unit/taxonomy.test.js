import { describe, it, expect } from 'vitest';
import {
  TAXONOMY_REGISTRY, CANONICAL_CATEGORIES, RESERVED_DIRS,
  DIR_TO_CATEGORY, RESOURCE_TYPE_MAP, RESOURCE_TYPE_TO_CATEGORY,
  getCategory, getCategoryByDir, isReservedDir,
} from '../../packages/core/src/taxonomy.js';

describe('taxonomy registry', () => {
  it('CANONICAL_CATEGORIES is exactly the 5 categories', () => {
    expect(CANONICAL_CATEGORIES).toEqual(['instructions', 'capabilities', 'skills', 'memory', 'hooks']);
  });

  it('RESERVED_DIRS matches category dirs', () => {
    expect(RESERVED_DIRS).toEqual(['instructions', 'capabilities', 'skills', 'memory', 'hooks']);
  });

  it('DIR_TO_CATEGORY round-trips', () => {
    for (const cat of CANONICAL_CATEGORIES) {
      expect(DIR_TO_CATEGORY[TAXONOMY_REGISTRY[cat].dir]).toBe(cat);
    }
  });

  it('RESOURCE_TYPE_MAP maps dirs to lowercase labels', () => {
    expect(RESOURCE_TYPE_MAP['instructions']).toBe('instruction');
    expect(RESOURCE_TYPE_MAP['capabilities']).toBe('capability');
    expect(RESOURCE_TYPE_MAP['skills']).toBe('skill');
    expect(RESOURCE_TYPE_MAP['memory']).toBe('memory');
    expect(RESOURCE_TYPE_MAP['hooks']).toBe('hook');
  });

  it('RESOURCE_TYPE_TO_CATEGORY maps lowercase labels back to categories', () => {
    expect(RESOURCE_TYPE_TO_CATEGORY['instruction']).toBe('instructions');
    expect(RESOURCE_TYPE_TO_CATEGORY['capability']).toBe('capabilities');
    expect(RESOURCE_TYPE_TO_CATEGORY['skill']).toBe('skills');
  });
});

describe('getCategory', () => {
  it('returns entry for valid category', () => {
    expect(getCategory('instructions').label).toBe('Instruction');
    expect(getCategory('capabilities').label).toBe('Capability');
    expect(getCategory('skills').label).toBe('Skill');
    expect(getCategory('memory').label).toBe('Memory');
    expect(getCategory('hooks').label).toBe('Hook');
  });

  it('returns null for unknown category', () => {
    expect(getCategory('nonexistent')).toBeNull();
    expect(getCategory('runbooks')).toBeNull();
  });
});

describe('getCategoryByDir', () => {
  it('returns entry for valid dir name', () => {
    expect(getCategoryByDir('capabilities').label).toBe('Capability');
    expect(getCategoryByDir('skills').label).toBe('Skill');
  });

  it('returns null for unknown dir', () => {
    expect(getCategoryByDir('tools')).toBeNull();
    expect(getCategoryByDir('runbooks')).toBeNull();
  });
});

describe('isReservedDir', () => {
  it('recognizes all canonical dirs', () => {
    for (const dir of RESERVED_DIRS) {
      expect(isReservedDir(dir)).toBe(true);
    }
  });

  it('rejects non-reserved dirs', () => {
    expect(isReservedDir('tools')).toBe(false);
    expect(isReservedDir('runbooks')).toBe(false);
    expect(isReservedDir('custom')).toBe(false);
  });
});
