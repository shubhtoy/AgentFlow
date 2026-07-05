import type { ParsedFile } from '@agentflow/core/parser-core'
import type { TransformContext } from './copy'

export function rename(file: ParsedFile, ctx: TransformContext): Record<string, string> {
  const target = ctx.targetPattern.replace('{name}', ctx.name)
  return { [target]: file.rawContent }
}
