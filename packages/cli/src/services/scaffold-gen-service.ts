/**
 * ScaffoldGenService.
 *
 * Generates .agentflow/ workspace scaffolds.
 * Categories: instructions/, capabilities/, skills/, memory/, hooks/.
 */

import fs from 'fs'
import path from 'path'
import { AgentScaffoldSchema } from '@agentflow/core/schemas/builder-schemas'
import { ok, fail, ErrorCode } from '@agentflow/core/services/types'
import type { ServiceResultFail } from '@agentflow/core/services/types'
import { atomicWrite } from '../svc-utils/file-io'

interface ServiceContext {
  rootDir: string
  logger: { error: (obj: unknown, msg: string) => void }
}

interface ScaffoldNode {
  id: string
  name: string
  description: string
  nodeType: string
  entry: boolean
  instructions: string
  tools: string[]
  skills: string[]
}

interface ScaffoldEdge {
  from: string
  to: string
  condition?: string
}

interface ScaffoldTool {
  name: string
  source: string
  mcpServer?: string
}

interface Scaffold {
  name: string
  description: string
  pattern: string
  identity: { name: string; role: string; personality?: string; constraints: string[] }
  nodes: ScaffoldNode[]
  edges: ScaffoldEdge[]
  tools: ScaffoldTool[]
  skills: string[]
  memory?: string[]
  _validated?: boolean
}

function toFrontmatter(obj: Record<string, unknown>): string {
  const lines = ['---']
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.join(', ')}]`)
    } else {
      lines.push(`${key}: ${value}`)
    }
  }
  lines.push('---')
  return lines.join('\n')
}

function generateRootAgentsMd(scaffold: Scaffold): string {
  const fm = toFrontmatter({
    type: 'agents',
    name: scaffold.name,
    description: scaffold.description,
  })

  const sections = [fm, '']
  sections.push('## Identity\n')
  sections.push(`Name: ${scaffold.identity.name}`)
  sections.push(`Role: ${scaffold.identity.role}`)
  if (scaffold.identity.personality) {
    sections.push(`Personality: ${scaffold.identity.personality}`)
  }
  if (scaffold.identity.constraints.length > 0) {
    sections.push('\nConstraints:')
    for (const c of scaffold.identity.constraints) sections.push(`- ${c}`)
  }

  sections.push(`\n## Workflows\n`)
  sections.push(`{{workflows/${scaffold.name}}}`)

  if (scaffold.tools.length > 0) {
    sections.push('\n## Capabilities\n')
    for (const t of scaffold.tools) sections.push(`{{capabilities/${t.name}}}`)
  }

  if (scaffold.skills.length > 0) {
    sections.push('\n## Instructions\n')
    for (const s of scaffold.skills) sections.push(`{{instructions/${s}}}`)
  }

  if (scaffold.memory && scaffold.memory.length > 0) {
    sections.push('\n## Memory\n')
    for (const m of scaffold.memory) sections.push(`{{memory/${m}}}`)
  }

  return sections.join('\n')
}

function generateWorkflowAgentsMd(scaffold: Scaffold): string {
  const fm = toFrontmatter({
    type: 'agents',
    name: scaffold.name,
    pattern: scaffold.pattern,
  })

  const sections = [fm, '']
  sections.push('## Nodes\n')
  for (const node of scaffold.nodes) {
    const entryTag = node.entry ? ' (entry)' : ''
    sections.push(`- **${node.name}**${entryTag} — ${node.description}`)
  }

  sections.push('\n## Edges\n')
  for (const edge of scaffold.edges) {
    const cond = edge.condition ? ` [${edge.condition}]` : ''
    sections.push(`- ${edge.from} → ${edge.to}${cond}`)
  }

  return sections.join('\n')
}

function generateNodeSkillMd(node: ScaffoldNode): string {
  const fm = toFrontmatter({
    name: node.name,
    type: node.nodeType,
    entry: node.entry,
    'context.max_tokens': 4096,
  })

  const sections = [fm, '']
  sections.push('## Instructions\n')
  sections.push(node.instructions)

  if (node.tools.length > 0) {
    sections.push('\n## Capabilities\n')
    for (const t of node.tools) sections.push(`{{capabilities/${t}}}`)
  }

  if (node.skills.length > 0) {
    sections.push('\n## Instructions\n')
    for (const s of node.skills) sections.push(`{{instructions/${s}}}`)
  }

  return sections.join('\n')
}

export function createScaffoldGenService(ctx: ServiceContext) {
  const { logger } = ctx

  return {
    validateScaffold(scaffold: unknown) {
      const zodResult = AgentScaffoldSchema.safeParse(scaffold)
      if (!zodResult.success) {
        return fail(ErrorCode.SCAFFOLD_INVALID, 'Schema validation failed', 422, zodResult.error.issues)
      }

      const s = zodResult.data as Scaffold
      const errors: string[] = []

      const entryNodes = s.nodes.filter(n => n.entry)
      if (entryNodes.length !== 1) {
        errors.push(`Expected exactly 1 entry node, found ${entryNodes.length}`)
      }

      const nodeIds = new Set(s.nodes.map(n => n.id))
      for (const edge of s.edges) {
        if (!nodeIds.has(edge.from)) errors.push(`Edge references unknown node: ${edge.from}`)
        if (!nodeIds.has(edge.to)) errors.push(`Edge references unknown node: ${edge.to}`)
      }

      for (const tool of s.tools) {
        if (tool.source === 'mcp' && !tool.mcpServer) {
          errors.push(`MCP tool "${tool.name}" must have mcpServer field`)
        }
      }

      if (errors.length > 0) {
        return fail(ErrorCode.SCAFFOLD_INVALID, 'Scaffold validation failed', 422, errors)
      }

      return ok({ ...s, _validated: true })
    },

    async generateWorkspace(scaffold: Scaffold, targetDir: string) {
      const agentflowDir = path.join(targetDir, '.agentflow')

      try {
        fs.mkdirSync(agentflowDir, { recursive: true })

        // Standard directory structure
        const dirs = ['instructions', 'capabilities', 'skills', 'memory', 'hooks']
        for (const dir of dirs) {
          fs.mkdirSync(path.join(agentflowDir, dir), { recursive: true })
        }

        // Root AGENTS.md
        atomicWrite(path.join(agentflowDir, 'AGENTS.md'), generateRootAgentsMd(scaffold))

        // Workflow directory + AGENTS.md
        const wfDir = path.join(agentflowDir, scaffold.name)
        fs.mkdirSync(wfDir, { recursive: true })
        atomicWrite(path.join(wfDir, 'AGENTS.md'), generateWorkflowAgentsMd(scaffold))

        // Node directories + SKILL.md
        for (const node of scaffold.nodes) {
          const nodeDir = path.join(wfDir, node.id)
          fs.mkdirSync(nodeDir, { recursive: true })
          atomicWrite(path.join(nodeDir, 'SKILL.md'), generateNodeSkillMd(node))
        }

        // Copy library resources
        const libraryDir = path.resolve(targetDir, 'library')
        const categories = ['capabilities', 'instructions', 'memory']
        for (const cat of categories) {
          const srcDir = path.join(libraryDir, cat)
          const destDir = path.join(agentflowDir, cat)
          if (!fs.existsSync(srcDir)) continue

          let itemsToCopy: string[] = []
          if (cat === 'capabilities') {
            itemsToCopy = scaffold.tools.filter(t => t.source === 'library').map(t => t.name)
          } else if (cat === 'instructions') {
            itemsToCopy = scaffold.skills
          } else if (cat === 'memory') {
            itemsToCopy = scaffold.memory || []
          }

          if (itemsToCopy.length === 0) continue
          fs.mkdirSync(destDir, { recursive: true })

          for (const name of itemsToCopy) {
            const srcFile = path.join(srcDir, `${name}.md`)
            if (fs.existsSync(srcFile)) {
              fs.copyFileSync(srcFile, path.join(destDir, `${name}.md`))
            }
          }
        }

        // Roundtrip verification
        try {
          const { parseRoot } = await import('../parser')
          const { createValidationService } = await import('./validation-service')
          const graph = await parseRoot(agentflowDir)
          const validationSvc = createValidationService({ rootDir: agentflowDir, logger })
          const validationResult = validationSvc.validate()

          if (!validationResult.success) {
            fs.rmSync(agentflowDir, { recursive: true, force: true })
            return fail(
              ErrorCode.SCAFFOLD_INVALID,
              'Roundtrip verification failed',
              422,
              (validationResult as ServiceResultFail).error,
            )
          }

          return ok(graph)
        } catch (err: unknown) {
          fs.rmSync(agentflowDir, { recursive: true, force: true })
          return fail(ErrorCode.SCAFFOLD_INVALID, `Roundtrip verification error: ${(err as Error).message}`, 422)
        }
      } catch (err: unknown) {
        try {
          fs.rmSync(agentflowDir, { recursive: true, force: true })
        } catch {
          /* ignore */
        }
        logger.error({ err }, 'ScaffoldGenService.generateWorkspace failed')
        return fail(ErrorCode.FS_WRITE_ERROR, (err as Error).message)
      }
    },
  }
}
