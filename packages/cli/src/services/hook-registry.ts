/**
 * HookRegistry.
 */

import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { atomicWrite } from '../svc-utils/file-io'

export const HookDefinitionSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().default('1.0.0'),
  description: z.string().optional(),
  event: z.string().min(1),
  condition: z
    .object({
      field: z.string(),
      operator: z.enum(['equals', 'contains', 'matches', 'startsWith', 'endsWith']),
      value: z.union([z.string(), z.number(), z.boolean()]),
    })
    .optional(),
  action: z.object({
    type: z.enum(['trigger-workflow', 'run-script', 'notify', 'log']),
    target: z.string(),
    params: z.record(z.string(), z.unknown()).default({}),
  }),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(1000).default(100),
})

export type HookDefinition = z.infer<typeof HookDefinitionSchema>

export class HookRegistry {
  private _rootDir: string
  private _hooksDir: string
  private _cache: Map<string, HookDefinition>

  constructor(rootDir: string) {
    this._rootDir = rootDir
    this._hooksDir = path.join(rootDir, 'hooks')
    this._cache = new Map()
  }

  private _ensureDir(): void {
    if (!fs.existsSync(this._hooksDir)) {
      fs.mkdirSync(this._hooksDir, { recursive: true })
    }
  }

  private _hookPath(name: string): string {
    return path.join(this._hooksDir, `${name}.json`)
  }

  loadAll(): HookDefinition[] {
    this._cache.clear()
    this._ensureDir()
    const files = fs.readdirSync(this._hooksDir).filter(f => f.endsWith('.json'))
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(this._hooksDir, file), 'utf-8')
        const hook = HookDefinitionSchema.parse(JSON.parse(raw))
        this._cache.set(hook.name, hook)
      } catch (err: unknown) {
        console.warn(`Skipping invalid hook file ${file}: ${(err as Error).message}`)
      }
    }
    return [...this._cache.values()]
  }

  reload(): HookDefinition[] {
    return this.loadAll()
  }

  getHooksForEvent(eventName: string): HookDefinition[] {
    return [...this._cache.values()].filter(h => h.event === eventName && h.enabled)
  }

  addHook(hook: unknown): HookDefinition {
    const validated = HookDefinitionSchema.parse(hook)
    this._ensureDir()
    atomicWrite(this._hookPath(validated.name), JSON.stringify(validated, null, 2))
    this._cache.set(validated.name, validated)
    return validated
  }

  removeHook(hookName: string): void {
    const filePath = this._hookPath(hookName)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    this._cache.delete(hookName)
  }

  updateHook(hookName: string, changes: Partial<HookDefinition>): HookDefinition {
    const existing = this._cache.get(hookName)
    if (!existing) throw new Error(`Hook not found: ${hookName}`)
    const merged = { ...existing, ...changes, name: hookName }
    const validated = HookDefinitionSchema.parse(merged)
    atomicWrite(this._hookPath(hookName), JSON.stringify(validated, null, 2))
    this._cache.set(hookName, validated)
    return validated
  }

  list(): HookDefinition[] {
    return [...this._cache.values()]
  }
}
