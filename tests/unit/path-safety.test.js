import { describe, it, expect } from 'vitest';
import { isPathSafe, validateOutputPaths } from '../../packages/core/src/transport/utils.js';

describe('isPathSafe', () => {
  it('accepts relative paths', () => {
    expect(isPathSafe('foo/bar.md')).toBe(true);
    expect(isPathSafe('AGENTS.md')).toBe(true);
    expect(isPathSafe('.kiro/steering/x.md')).toBe(true);
  });

  it('rejects absolute paths', () => {
    expect(isPathSafe('/foo/bar')).toBe(false);
    expect(isPathSafe('/etc/passwd')).toBe(false);
  });

  it('rejects traversal', () => {
    expect(isPathSafe('../foo')).toBe(false);
    expect(isPathSafe('foo/../../bar')).toBe(false);
  });

  it('rejects null, undefined, empty string', () => {
    expect(isPathSafe(null)).toBe(false);
    expect(isPathSafe(undefined)).toBe(false);
    expect(isPathSafe('')).toBe(false);
  });
});

describe('validateOutputPaths', () => {
  it('returns safe:true for all-valid paths', () => {
    expect(validateOutputPaths({ 'foo/bar.md': 'x', 'AGENTS.md': 'y' })).toEqual({ safe: true });
  });

  it('returns safe:false with invalidPaths for bad paths', () => {
    expect(validateOutputPaths({ 'ok.md': 'x', '../bad': 'y', '/abs': 'z' }))
      .toEqual({ safe: false, invalidPaths: ['../bad', '/abs'] });
  });

  it('returns safe:true for empty object', () => {
    expect(validateOutputPaths({})).toEqual({ safe: true });
  });
});
