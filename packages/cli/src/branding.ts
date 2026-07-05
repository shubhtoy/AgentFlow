/**
 * Branding.
 */

import fs from 'fs'
import path from 'path'
import { brandConfigSchema } from '@agentflow/core/schemas/brand-schemas'

export const DEFAULTS = Object.freeze({ name: 'AgentFlow', dir: '.agentflow', cli: 'agentflow' })

export function loadBrandConfig(rootDir?: string): Readonly<{ name: string; dir: string; cli: string }> {
  const config: Record<string, string> = { ...DEFAULTS }

  const baseDir = rootDir ? path.dirname(rootDir) : process.cwd()
  const configPath = path.join(baseDir, 'agentflow.config.json')
  try {
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      const parsed = brandConfigSchema.safeParse(raw)
      if (parsed.success) Object.assign(config, parsed.data)
      else console.warn(`[branding] Invalid config file at ${configPath}, using defaults`)
    }
  } catch (err: unknown) {
    console.warn(`[branding] Failed to read ${configPath}: ${(err as Error).message}`)
  }

  if (process.env.AGENTFLOW_BRAND_NAME) config.name = process.env.AGENTFLOW_BRAND_NAME
  if (process.env.AGENTFLOW_DIR) config.dir = process.env.AGENTFLOW_DIR
  if (process.env.AGENTFLOW_CLI) config.cli = process.env.AGENTFLOW_CLI

  const validated = brandConfigSchema.parse(config)
  return Object.freeze(validated) as Readonly<{ name: string; dir: string; cli: string }>
}
