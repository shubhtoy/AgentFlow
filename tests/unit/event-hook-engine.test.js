'use strict';

const {
  EventHookEngine,
  evaluateCondition,
  BUILT_IN_EVENTS,
  isSafeRegex,
} = require('../../src/services/event-hook-engine');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeRegistry(hooks = []) {
  return { getHooksForEvent: vi.fn(() => [...hooks]) };
}

function makeExecutor(result = 'ok') {
  return { execute: vi.fn(async () => result) };
}

function makeHook(overrides = {}) {
  return {
    name: 'test-hook',
    event: 'fileEdited',
    enabled: true,
    priority: 100,
    action: { type: 'log', target: 'console', params: {} },
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  evaluateCondition — all operators                                  */
/* ------------------------------------------------------------------ */

describe('evaluateCondition', () => {
  it('equals — exact match', () => {
    expect(evaluateCondition('hello', 'equals', 'hello')).toBe(true);
    expect(evaluateCondition('hello', 'equals', 'world')).toBe(false);
  });

  it('contains — substring', () => {
    expect(evaluateCondition('hello world', 'contains', 'world')).toBe(true);
    expect(evaluateCondition('hello', 'contains', 'xyz')).toBe(false);
  });

  it('startsWith', () => {
    expect(evaluateCondition('/src/app.js', 'startsWith', '/src')).toBe(true);
    expect(evaluateCondition('/src/app.js', 'startsWith', '/lib')).toBe(false);
  });

  it('endsWith', () => {
    expect(evaluateCondition('file.md', 'endsWith', '.md')).toBe(true);
    expect(evaluateCondition('file.md', 'endsWith', '.js')).toBe(false);
  });

  it('matches — valid regex', () => {
    expect(evaluateCondition('src/utils.js', 'matches', '\\.js$')).toBe(true);
    expect(evaluateCondition('src/utils.ts', 'matches', '\\.js$')).toBe(false);
  });

  // Edge cases
  it('returns false for null fieldValue', () => {
    expect(evaluateCondition(null, 'equals', 'x')).toBe(false);
  });

  it('returns false for undefined fieldValue', () => {
    expect(evaluateCondition(undefined, 'contains', 'x')).toBe(false);
  });

  it('returns false for empty string with contains non-empty', () => {
    expect(evaluateCondition('', 'contains', 'x')).toBe(false);
  });

  it('equals works with empty strings', () => {
    expect(evaluateCondition('', 'equals', '')).toBe(true);
  });

  it('coerces numbers to strings', () => {
    expect(evaluateCondition(42, 'equals', '42')).toBe(true);
    expect(evaluateCondition('42', 'equals', 42)).toBe(true);
  });

  it('returns false for unknown operator', () => {
    expect(evaluateCondition('a', 'nope', 'a')).toBe(false);
  });

  it('matches — invalid regex returns false', () => {
    expect(evaluateCondition('test', 'matches', '[')).toBe(false);
  });

  it('matches — regex special chars in value are safe', () => {
    expect(evaluateCondition('file (1).txt', 'matches', 'file \\(1\\)\\.txt')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  ReDoS guard                                                        */
/* ------------------------------------------------------------------ */

describe('isSafeRegex', () => {
  it('rejects patterns longer than 512 chars', () => {
    expect(isSafeRegex('a'.repeat(513))).toBe(false);
  });

  it('accepts normal patterns', () => {
    expect(isSafeRegex('\\.(js|ts)$')).toBe(true);
  });

  it('matches returns false for overly long regex', () => {
    expect(evaluateCondition('test', 'matches', 'a'.repeat(600))).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  EventHookEngine — construction & event types                       */
/* ------------------------------------------------------------------ */

describe('EventHookEngine', () => {
  it('registers all built-in events on construction', () => {
    const engine = new EventHookEngine(makeRegistry(), makeExecutor(), makeLogger());
    const types = engine.listEventTypes();
    for (const name of Object.keys(BUILT_IN_EVENTS)) {
      expect(types).toContain(name);
    }
  });

  it('registerEventType adds custom events', () => {
    const engine = new EventHookEngine(makeRegistry(), makeExecutor(), makeLogger());
    engine.registerEventType('custom', { fields: ['a'] });
    expect(engine.listEventTypes()).toContain('custom');
  });

  it('emit warns on unknown event type', async () => {
    const logger = makeLogger();
    const engine = new EventHookEngine(makeRegistry(), makeExecutor(), logger);
    await engine.emit('unknownEvent', {});
    expect(logger.warn).toHaveBeenCalledWith('Unknown event type: unknownEvent');
  });
});

/* ------------------------------------------------------------------ */
/*  evaluateAndFireHooks — priority ordering & condition evaluation     */
/* ------------------------------------------------------------------ */

describe('evaluateAndFireHooks', () => {
  it('fires hooks sorted by priority (lower first)', async () => {
    const order = [];
    const executor = {
      execute: vi.fn(async (action) => { order.push(action.target); return 'ok'; }),
    };
    const hooks = [
      makeHook({ name: 'low', priority: 200, action: { type: 'log', target: 'low', params: {} } }),
      makeHook({ name: 'high', priority: 10, action: { type: 'log', target: 'high', params: {} } }),
      makeHook({ name: 'mid', priority: 100, action: { type: 'log', target: 'mid', params: {} } }),
    ];
    const engine = new EventHookEngine(makeRegistry(hooks), executor, makeLogger());
    const results = await engine.emit('fileEdited', { path: 'a.js' });

    expect(order).toEqual(['high', 'mid', 'low']);
    expect(results).toHaveLength(3);
    expect(results.every(r => r.fired)).toBe(true);
  });

  it('skips disabled hooks', async () => {
    const hooks = [makeHook({ enabled: false })];
    const engine = new EventHookEngine(makeRegistry(hooks), makeExecutor(), makeLogger());
    const results = await engine.emit('fileEdited', {});

    expect(results[0].fired).toBe(false);
    expect(results[0].reason).toBe('disabled');
  });

  it('skips hooks whose condition is not met', async () => {
    const hooks = [
      makeHook({ condition: { field: 'path', operator: 'endsWith', value: '.md' } }),
    ];
    const engine = new EventHookEngine(makeRegistry(hooks), makeExecutor(), makeLogger());
    const results = await engine.emit('fileEdited', { path: 'file.js' });

    expect(results[0].fired).toBe(false);
    expect(results[0].reason).toBe('condition-not-met');
  });

  it('fires hooks whose condition is met', async () => {
    const hooks = [
      makeHook({ condition: { field: 'path', operator: 'endsWith', value: '.md' } }),
    ];
    const engine = new EventHookEngine(makeRegistry(hooks), makeExecutor(), makeLogger());
    const results = await engine.emit('fileEdited', { path: 'README.md' });

    expect(results[0].fired).toBe(true);
  });

  it('fires hooks with no condition', async () => {
    const hooks = [makeHook()];
    const engine = new EventHookEngine(makeRegistry(hooks), makeExecutor(), makeLogger());
    const results = await engine.emit('fileEdited', { path: 'a.js' });

    expect(results[0].fired).toBe(true);
  });

  it('captures action executor errors', async () => {
    const executor = { execute: vi.fn(async () => { throw new Error('boom'); }) };
    const hooks = [makeHook()];
    const engine = new EventHookEngine(makeRegistry(hooks), executor, makeLogger());
    const results = await engine.emit('fileEdited', {});

    expect(results[0].fired).toBe(true);
    expect(results[0].error).toBe('boom');
  });

  it('returns empty array when no hooks match event', async () => {
    const engine = new EventHookEngine(makeRegistry([]), makeExecutor(), makeLogger());
    const results = await engine.emit('fileEdited', {});
    expect(results).toEqual([]);
  });

  it('uses default priority 100 when not specified', async () => {
    const order = [];
    const executor = {
      execute: vi.fn(async (action) => { order.push(action.target); return 'ok'; }),
    };
    const hooks = [
      makeHook({ name: 'a', priority: undefined, action: { type: 'log', target: 'a', params: {} } }),
      makeHook({ name: 'b', priority: 50, action: { type: 'log', target: 'b', params: {} } }),
    ];
    const engine = new EventHookEngine(makeRegistry(hooks), executor, makeLogger());
    await engine.emit('fileEdited', {});

    expect(order).toEqual(['b', 'a']);
  });
});
