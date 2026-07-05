import type { ParsedFile } from '@agentflow/core/parser-core'

export interface TransformContext {
  name: string
  targetPattern: string
  config: Record<string, unknown>
}

export function copy(file: ParsedFile, ctx: TransformContext): Record<string, string> {
  const target = ctx.targetPattern.replace('{name}', ctx.name)
  return { [target]: file.rawContent }
}
