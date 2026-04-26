import type { ParsedFile } from '@agentflow/core/parser-core'

export interface SplitOutputs {
  soul: string
  agents: string
  identity: string
}

export function splitIdentity(
  file: ParsedFile,
  outputs: SplitOutputs,
): Record<string, string> {
  const fm = file.frontmatter || {}
  const id = (fm.identity || {}) as Record<string, unknown>
  const result: Record<string, string> = {}

  // SOUL.md — personality + constraints
  const soulParts = []
  if (id.personality) soulParts.push(`# Soul\n\n${id.personality}`)
  if (id.constraints) soulParts.push(`## Constraints\n\n${id.constraints}`)
  result[outputs.soul] = soulParts.join('\n\n') || `# Soul\n\n${file.content}`

  // AGENTS.md — name + role + description
  const agentParts = [`# ${id.name || fm.name || 'Agent'}`]
  if (id.role) agentParts.push(`\n**Role:** ${id.role}`)
  if (fm.description) agentParts.push(`\n${fm.description}`)
  result[outputs.agents] = agentParts.join('\n')

  // IDENTITY.md — full content
  result[outputs.identity] = file.rawContent

  return result
}
