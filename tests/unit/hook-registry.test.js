import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

const { HookRegistry, HookDefinitionSchema } = require('../../packages/cli/src/services/hook-registry');

let tmpDir;
let hooksDir;
let registry;

/** Helper: minimal valid hook data. */
function makeHook(overrides = {}) {
  return {
    name: 'test-hook',
    event: 'fileEdited',
    action: { type: 'log', target: 'console' },
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'af-hook-test-')));
  hooksDir = path.join(tmpDir, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  registry = new HookRegistry(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Schema validation ──

describe('HookDefinitionSchema', () => {
  it('accepts a minimal valid hook', () => {
    const result = HookDefinitionSchema.parse(makeHook());
    expect(result.name).toBe('test-hook');
    expect(result.enabled).toBe(true);
    expect(result.priority).toBe(100);
    expect(result.version).toBe('1.0.0');
  });

  it('rejects hook with empty name', () => {
    expect(() => HookDefinitionSchema.parse(makeHook({ name: '' }))).toThrow();
  });

  it('rejects hook with missing event', () => {
    expect(() => HookDefinitionSchema.parse({ name: 'x', action: { type: 'log', target: 'y' } })).toThrow();
  });

  it('rejects invalid action type', () => {
    expect(() => HookDefinitionSchema.parse(makeHook({ action: { type: 'invalid', target: 'x' } }))).toThrow();
  });

  it('rejects priority out of range', () => {
    expect(() => HookDefinitionSchema.parse(makeHook({ priority: 1001 }))).toThrow();
    expect(() => HookDefinitionSchema.parse(makeHook({ priority: -1 }))).toThrow();
  });

  it('accepts hook with condition', () => {
    const hook = makeHook({
      condition: { field: 'path', operator: 'endsWith', value: '.md' },
    });
    const result = HookDefinitionSchema.parse(hook);
    expect(result.condition.operator).toBe('endsWith');
  });
});

// ── loadAll ──

describe('HookRegistry.loadAll', () => {
  it('loads valid hook files from disk', () => {
    const hook = makeHook();
    fs.writeFileSync(path.join(hooksDir, 'test-hook.json'), JSON.stringify(hook));

    const hooks = registry.loadAll();
    expect(hooks).toHaveLength(1);
    expect(hooks[0].name).toBe('test-hook');
  });

  it('skips invalid JSON files with warning', () => {
    fs.writeFileSync(path.join(hooksDir, 'bad.json'), 'not json');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const hooks = registry.loadAll();
    expect(hooks).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('skips files that fail schema validation', () => {
    fs.writeFileSync(path.join(hooksDir, 'invalid.json'), JSON.stringify({ name: '' }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const hooks = registry.loadAll();
    expect(hooks).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('creates hooks directory if it does not exist', () => {
    fs.rmSync(hooksDir, { recursive: true });
    const hooks = registry.loadAll();
    expect(hooks).toHaveLength(0);
    expect(fs.existsSync(hooksDir)).toBe(true);
  });

  it('ignores non-json files', () => {
    fs.writeFileSync(path.join(hooksDir, 'readme.txt'), 'hello');
    fs.writeFileSync(path.join(hooksDir, 'test-hook.json'), JSON.stringify(makeHook()));

    const hooks = registry.loadAll();
    expect(hooks).toHaveLength(1);
  });
});

// ── addHook ──

describe('HookRegistry.addHook', () => {
  it('writes hook file and updates cache', () => {
    registry.loadAll();
    const result = registry.addHook(makeHook({ name: 'new-hook' }));

    expect(result.name).toBe('new-hook');
    expect(result.enabled).toBe(true);
    expect(fs.existsSync(path.join(hooksDir, 'new-hook.json'))).toBe(true);
    expect(registry.list()).toHaveLength(1);
  });

  it('applies defaults on add', () => {
    registry.loadAll();
    const result = registry.addHook(makeHook({ name: 'defaults-hook' }));
    expect(result.version).toBe('1.0.0');
    expect(result.priority).toBe(100);
  });

  it('rejects invalid hook data', () => {
    registry.loadAll();
    expect(() => registry.addHook({ name: '' })).toThrow();
  });
});

// ── removeHook ──

describe('HookRegistry.removeHook', () => {
  it('deletes file and removes from cache', () => {
    registry.loadAll();
    registry.addHook(makeHook({ name: 'to-remove' }));
    expect(registry.list()).toHaveLength(1);

    registry.removeHook('to-remove');
    expect(registry.list()).toHaveLength(0);
    expect(fs.existsSync(path.join(hooksDir, 'to-remove.json'))).toBe(false);
  });

  it('handles removing non-existent hook gracefully', () => {
    registry.loadAll();
    expect(() => registry.removeHook('ghost')).not.toThrow();
  });
});

// ── updateHook ──

describe('HookRegistry.updateHook', () => {
  it('merges changes and writes updated file', () => {
    registry.loadAll();
    registry.addHook(makeHook({ name: 'updatable' }));

    const updated = registry.updateHook('updatable', { enabled: false, priority: 50 });
    expect(updated.enabled).toBe(false);
    expect(updated.priority).toBe(50);
    expect(updated.name).toBe('updatable');

    // Verify persisted to disk
    const onDisk = JSON.parse(fs.readFileSync(path.join(hooksDir, 'updatable.json'), 'utf-8'));
    expect(onDisk.enabled).toBe(false);
  });

  it('throws when updating non-existent hook', () => {
    registry.loadAll();
    expect(() => registry.updateHook('nope', { enabled: false })).toThrow(/not found/i);
  });

  it('validates merged result', () => {
    registry.loadAll();
    registry.addHook(makeHook({ name: 'val-hook' }));
    expect(() => registry.updateHook('val-hook', { priority: 9999 })).toThrow();
  });
});

// ── getHooksForEvent ──

describe('HookRegistry.getHooksForEvent', () => {
  it('returns only enabled hooks matching the event', () => {
    registry.loadAll();
    registry.addHook(makeHook({ name: 'h1', event: 'fileEdited', enabled: true }));
    registry.addHook(makeHook({ name: 'h2', event: 'fileEdited', enabled: false }));
    registry.addHook(makeHook({ name: 'h3', event: 'fileCreated', enabled: true }));

    const result = registry.getHooksForEvent('fileEdited');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('h1');
  });

  it('returns empty array when no hooks match', () => {
    registry.loadAll();
    expect(registry.getHooksForEvent('unknown')).toEqual([]);
  });
});

// ── reload ──

describe('HookRegistry.reload', () => {
  it('picks up new files added to disk', () => {
    registry.loadAll();
    expect(registry.list()).toHaveLength(0);

    fs.writeFileSync(
      path.join(hooksDir, 'late-hook.json'),
      JSON.stringify(makeHook({ name: 'late-hook' })),
    );

    registry.reload();
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0].name).toBe('late-hook');
  });
});

// ── list ──

describe('HookRegistry.list', () => {
  it('returns all loaded hooks', () => {
    registry.loadAll();
    registry.addHook(makeHook({ name: 'a' }));
    registry.addHook(makeHook({ name: 'b' }));
    expect(registry.list()).toHaveLength(2);
  });
});
