import type { ParsedFile, SkillEntry } from '@agentflow/core/parser-core'
import type { TransformContext } from './copy'

export function toSkillDir(source: ParsedFile | SkillEntry, ctx: TransformContext): Record<string, string> {
  const basePath = ctx.targetPattern.replace('{name}', ctx.name)
  const result: Record<string, string> = {}

  if ('primaryFile' in source) {
    // SkillEntry — copy full directory structure
    result[`${basePath}/SKILL.md`] = source.primaryFile.rawContent
  } else {
    // ParsedFile — wrap as SKILL.md
    result[`${basePath}/SKILL.md`] = source.rawContent
  }

  return result
}
