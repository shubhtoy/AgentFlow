'use strict';

const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { atomicWrite } = require('../svc-utils/file-io');

/* ------------------------------------------------------------------ */
/*  Schema                                                             */
/* ------------------------------------------------------------------ */

const HookDefinitionSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().default('1.0.0'),
  description: z.string().optional(),
  event: z.string().min(1),
  condition: z.object({
    field: z.string(),
    operator: z.enum(['equals', 'contains', 'matches', 'startsWith', 'endsWith']),
    value: z.union([z.string(), z.number(), z.boolean()]),
  }).optional(),
  action: z.object({
    type: z.enum(['trigger-workflow', 'run-script', 'notify', 'log']),
    target: z.string(),
    params: z.record(z.string(), z.unknown()).default({}),
  }),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(1000).default(100),
});

/* ------------------------------------------------------------------ */
/*  HookRegistry                                                       */
/* ------------------------------------------------------------------ */

class HookRegistry {
  /**
   * @param {string} rootDir — the .agentflow workspace root
   */
  constructor(rootDir) {
    this._rootDir = rootDir;
    this._hooksDir = path.join(rootDir, 'hooks');
    /** @type {Map<string, z.infer<typeof HookDefinitionSchema>>} */
    this._cache = new Map();
  }

  /** Ensure hooks directory exists. */
  _ensureDir() {
    if (!fs.existsSync(this._hooksDir)) {
      fs.mkdirSync(this._hooksDir, { recursive: true });
    }
  }

  /** Path to a hook's JSON file. */
  _hookPath(name) {
    return path.join(this._hooksDir, `${name}.json`);
  }

  /** Load all hook JSON files from hooks/ directory. Skips invalid with console.warn. */
  loadAll() {
    this._cache.clear();
    this._ensureDir();

    const files = fs.readdirSync(this._hooksDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(this._hooksDir, file), 'utf-8');
        const parsed = JSON.parse(raw);
        const hook = HookDefinitionSchema.parse(parsed);
        this._cache.set(hook.name, hook);
      } catch (err) {
        console.warn(`Skipping invalid hook file ${file}: ${err.message}`);
      }
    }
    return [...this._cache.values()];
  }

  /** Reload hooks from disk. */
  reload() {
    return this.loadAll();
  }

  /** Get all enabled hooks that listen for a given event. */
  getHooksForEvent(eventName) {
    return [...this._cache.values()].filter(
      h => h.event === eventName && h.enabled,
    );
  }

  /** Add a new hook — validates, writes file, updates cache. */
  addHook(hook) {
    const validated = HookDefinitionSchema.parse(hook);
    this._ensureDir();
    atomicWrite(this._hookPath(validated.name), JSON.stringify(validated, null, 2));
    this._cache.set(validated.name, validated);
    return validated;
  }

  /** Remove a hook — deletes file, updates cache. */
  removeHook(hookName) {
    const filePath = this._hookPath(hookName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    this._cache.delete(hookName);
  }

  /** Update a hook — merges changes, validates result, writes file. */
  updateHook(hookName, changes) {
    const existing = this._cache.get(hookName);
    if (!existing) {
      throw new Error(`Hook not found: ${hookName}`);
    }
    const merged = { ...existing, ...changes, name: hookName };
    const validated = HookDefinitionSchema.parse(merged);
    atomicWrite(this._hookPath(hookName), JSON.stringify(validated, null, 2));
    this._cache.set(hookName, validated);
    return validated;
  }

  /** List all loaded hooks. */
  list() {
    return [...this._cache.values()];
  }
}

module.exports = { HookRegistry, HookDefinitionSchema };
