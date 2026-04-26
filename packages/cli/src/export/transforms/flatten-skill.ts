import type { SkillEntry } from '@agentflow/core/parser-core'
import type { TransformContext } from './copy'

export function flattenSkill(
  skill: SkillEntry,
  ctx: TransformContext,
): Record<string, string> {
  const target = ctx.targetPattern.replace('{name}', ctx.name)
  return { [target]: skill.primaryFile.content }
}
