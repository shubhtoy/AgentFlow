import type { ParsedFile } from '@agentflow/core/parser-core'
import type { TransformContext } from './copy'

export function toMdc(
  file: ParsedFile,
  ctx: TransformContext,
): Record<string, string> {
  const target = ctx.targetPattern.replace('{name}', ctx.name)
  const fm = file.frontmatter || {}
  const configFm = (ctx.config.frontmatter || {}) as Record<string, string>

  const description = resolveFmValue(configFm.description, fm) || fm.description || ctx.name
  const globs = resolveFmValue(configFm.globs, fm) || ''
  const alwaysApply = resolveFmValue(configFm.alwaysApply, fm) ?? false

  const lines = [
    '---',
    `description: ${description}`,
  ]
  if (globs) lines.push(`globs: ${globs}`)
  lines.push(`alwaysApply: ${alwaysApply}`)
  lines.push('---')
  lines.push('')
  lines.push(file.content)

  return { [target]: lines.join('\n') }
}

function resolveFmValue(
  pattern: string | undefined,
  fm: Record<string, unknown>,
): unknown {
  if (!pattern || typeof pattern !== 'string') return undefined
  if (!pattern.startsWith('from:')) return pattern
  const path = pattern.slice(5).split('.')
  let val: unknown = fm
  for (const key of path) {
    if (val == null || typeof val !== 'object') return undefined
    val = (val as Record<string, unknown>)[key]
  }
  return val
}
