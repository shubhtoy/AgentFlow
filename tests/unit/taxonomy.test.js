import { describe, it, expect } from 'vitest';
import {
  TAXONOMY_REGISTRY, CANONICAL_CATEGORIES, RESERVED_DIRS,
  DIR_TO_CATEGORY, RESOURCE_TYPE_MAP,
  getCategory, getCategoryByDir, isReservedDir, inferScope,
} from '../../src/taxonomy.js';

describe('taxonomy registry', () => {
  it('has exactly 5 canonical categories', () => {
    expect(CANONICAL_CATEGORIES).toEqual(['instructions', 'capabilities', 'runbooks', 'memory', 'hooks']);
  });

  it('RESERVED_DIRS matches category dirs', () => {
    expect(RESERVED_DIRS).toEqual(['instructions', 'capabilities', 'runbooks', 'memory', 'hooks']);
  });

  it('DIR_TO_CATEGORY round-trips', () => {
    for (const cat of CANONICAL_CATEGORIES) {
      const dir = TAXONOMY_REGISTRY[cat].dir;
      expect(DIR_TO_CATEGORY[dir]).toBe(cat);
    }
  });

  it('RESOURCE_TYPE_MAP maps dirs to resourceTypes', () => {
    expect(RESOURCE_TYPE_MAP['instructions']).toBe('instruction');
    expect(RESOURCE_TYPE_MAP['capabilities']).toBe('capability');
    expect(RESOURCE_TYPE_MAP['runbooks']).toBe('runbook');
    expect(RESOURCE_TYPE_MAP['memory']).toBe('memory');
    expect(RESOURCE_TYPE_MAP['hooks']).toBe('hook');
  });

  it('getCategory returns entry or null', () => {
    expect(getCategory('instructions').label).toBe('Instruction');
    expect(getCategory('nonexistent')).toBeNull();
  });

  it('getCategoryByDir returns entry or null', () => {
    expect(getCategoryByDir('capabilities').label).toBe('Capability');
    expect(getCategoryByDir('tools')).toBeNull();
  });

  it('isReservedDir recognizes canonical dirs only', () => {
    expect(isReservedDir('instructions')).toBe(true);
    expect(isReservedDir('hooks')).toBe(true);
    expect(isReservedDir('tools')).toBe(false);
    expect(isReservedDir('skills')).toBe(false);
  });
});

describe('inferScope', () => {
  it('returns null for categories without scopes', () => {
    expect(inferScope({}, 'memory')).toBeNull();
    expect(inferScope({}, 'hooks')).toBeNull();
  });

  it('explicit scope in frontmatter wins', () => {
    expect(inferScope({ scope: 'global' }, 'instructions')).toBe('global');
    expect(inferScope({ scope: 'config' }, 'capabilities')).toBe('config');
    expect(inferScope({ scope: 'condition' }, 'runbooks')).toBe('condition');
  });

  it('ignores invalid explicit scope', () => {
    expect(inferScope({ scope: 'bogus' }, 'instructions')).toBe('workflow');
  });

  it('instructions: inclusion → global, default → workflow', () => {
    expect(inferScope({}, 'instructions')).toBe('workflow');
    expect(inferScope({ inclusion: 'auto' }, 'instructions')).toBe('global');
    expect(inferScope({ inclusion: 'manual' }, 'instructions')).toBe('global');
  });

  it('capabilities: tool subtypes → descriptor', () => {
    for (const t of ['builtin', 'script', 'mcp', 'package']) {
      expect(inferScope({ type: t }, 'capabilities')).toBe('descriptor');
    }
    expect(inferScope({}, 'capabilities')).toBe('descriptor');
  });

  it('runbooks: condition type → condition, default → interaction', () => {
    expect(inferScope({ type: 'condition' }, 'runbooks')).toBe('condition');
    expect(inferScope({ type: 'approval' }, 'runbooks')).toBe('interaction');
    expect(inferScope({}, 'runbooks')).toBe('interaction');
  });

  it('returns null for unknown category', () => {
    expect(inferScope({}, 'nonexistent')).toBeNull();
  });
});
