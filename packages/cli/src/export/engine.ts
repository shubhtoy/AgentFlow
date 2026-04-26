import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import type { ParsedGraph, ParsedFile, SkillEntry } from '@agentflow/core/parser-core'
import { TRANSFORM_REGISTRY, type FileMap, type TransformContext } from './transforms'
import { mergeMcpConfig, type McpCapability } from './transforms/merge-mcp-config'
import { concatenate } from './transforms/concatenate'
import { splitIdentity } from './transforms/split-identity'
import { flattenSkill } from './transforms/flatten-skill'
import { toSkillDir } from './transforms/to-skill-dir'

// ── Types ──────────────────────────────────────────────────────────────

export interface PlatformConfig {
  id: string
  name: string
  website?: string
  version?: string
  serializer?: string
  agentsmd?: boolean
  paths?: Record<string, string | null>
  mapping: Record<string, unknown>
  mcp?: {
    configPath?: string | null
    format?: string | null
    schema?: unknown
  }
}

// ── Config loading ─────────────────────────────────────────────────────

const CONFIGS_DIR = path.resolve(__dirname, '../../../../configs/platforms')

let configCache: Map<string, PlatformConfig> | null = null

export function loadPlatformConfigs(): Map<string, PlatformConfig> {
  if (configCache) return configCache
  configCache = new Map()
  if (!fs.existsSync(CONFIGS_DIR)) return configCache
  const files = fs.readdirSync(CONFIGS_DIR).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
  for (const file of files) {
    const raw = fs.readFileSync(path.join(CONFIGS_DIR, file), 'utf-8')
    const config = yaml.load(raw) as PlatformConfig
    if (config?.id) configCache.set(config.id, config)
  }
  return configCache
}

export function getPlatformConfig(platformId: string): PlatformConfig | null {
  return loadPlatformConfigs().get(platformId) || null
}

export function listPlatforms(): string[] {
  return [...loadPlatformConfigs().keys()]
}

// ── Export engine ──────────────────────────────────────────────────────

export function exportForPlatform(
  graph: ParsedGraph,
  platformId: string,
): FileMap {
  const config = getPlatformConfig(platformId)
  if (!config) throw new Error(`Unknown platform: ${platformId}`)

  // Agent Spec uses its own dedicated transform
  if (config.serializer === 'tsagentspec') return {}

  const result: FileMap = {}
  const mapping = config.mapping

  // Identity
  if (mapping.identity && graph.descriptorFile) {
    const rule = mapping.identity as Record<string, unknown>
    Object.assign(result, applyTransform(
      rule.transform as string,
      graph.descriptorFile,
      { name: 'identity', targetPattern: (rule.target as string) || '', config: rule },
    ))
  }

  // Split identity (OpenClaw)
  if (mapping.identity && (mapping.identity as Record<string, unknown>).transform === 'split-identity') {
    if (graph.descriptorFile) {
      const rule = mapping.identity as Record<string, unknown>
      const outputs = (rule.outputs || {}) as Record<string, string>
      Object.assign(result, splitIdentity(graph.descriptorFile, {
        soul: outputs.soul || 'SOUL.md',
        agents: outputs.agents || 'AGENTS.md',
        identity: outputs.identity || 'IDENTITY.md',
      }))
    }
  }

  // Instructions
  if (mapping.instructions) {
    const rule = mapping.instructions as Record<string, unknown>
    if (rule.transform === 'concatenate') {
      const files = Object.values(graph.instructions)
      const identityFiles = graph.descriptorFile ? [graph.descriptorFile] : []
      Object.assign(result, concatenate(
        [...identityFiles, ...files],
        (rule.target as string) || 'CONVENTIONS.md',
      ))
    } else if (rule.target && rule.transform) {
      for (const [name, file] of Object.entries(graph.instructions)) {
        Object.assign(result, applyTransform(
          rule.transform as string,
          file,
          { name, targetPattern: rule.target as string, config: rule },
        ))
      }
    }
  }

  // Skills
  if (mapping.skills) {
    const rule = mapping.skills as Record<string, unknown>
    if (rule.target && rule.transform) {
      for (const [name, skill] of Object.entries(graph.skills)) {
        if (rule.transform === 'flatten-skill') {
          Object.assign(result, flattenSkill(skill, {
            name,
            targetPattern: rule.target as string,
            config: rule,
          }))
        } else if (rule.transform === 'to-skill-dir') {
          Object.assign(result, toSkillDir(skill, {
            name,
            targetPattern: rule.target as string,
            config: rule,
          }))
        } else if (rule.transform === 'copy-dir') {
          result[`${(rule.target as string).replace('{name}', name)}/SKILL.md`] =
            skill.primaryFile.rawContent
        } else {
          Object.assign(result, applyTransform(
            rule.transform as string,
            skill.primaryFile,
            { name, targetPattern: rule.target as string, config: rule },
          ))
        }
      }
    }
  }

  // Capabilities — MCP
  const capMapping = mapping.capabilities as Record<string, unknown> | undefined
  if (capMapping) {
    const mcpRule = capMapping.mcp as Record<string, unknown> | undefined
    if (mcpRule?.target && mcpRule.transform === 'merge-mcp-config') {
      const mcpCaps: McpCapability[] = []
      for (const [name, cap] of Object.entries(graph.capabilities)) {
        if (cap.toolType === 'mcp' || cap.mcp) {
          mcpCaps.push({
            name,
            mcp: cap.mcp || '',
            command: cap.command,
          })
        }
      }
      if (mcpCaps.length) {
        const format = config.mcp?.format || 'mcp-standard'
        const merged = mergeMcpConfig(mcpCaps, format)
        if (merged.content) {
          result[mcpRule.target as string] = merged.content
        }
      }
    }
  }

  return result
}

// ── Helpers ────────────────────────────────────────────────────────────

function applyTransform(
  transformName: string,
  file: ParsedFile | SkillEntry,
  ctx: TransformContext,
): FileMap {
  const fn = TRANSFORM_REGISTRY[transformName]
  if (!fn) return {}
  return fn(file, ctx) as FileMap
}
