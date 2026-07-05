import { concatenate } from './concatenate'
import { copy } from './copy'
import { flattenSkill } from './flatten-skill'
import { mergeMcpConfig } from './merge-mcp-config'
import { rename } from './rename'
import { splitIdentity } from './split-identity'
import { toMdc } from './to-mdc'
import { toSkillDir } from './to-skill-dir'

export { copy, rename, toMdc, concatenate, flattenSkill, splitIdentity, mergeMcpConfig, toSkillDir }
export type { TransformContext } from './copy'
export type { McpCapability } from './merge-mcp-config'
export type { SplitOutputs } from './split-identity'

export type FileMap = Record<string, string>

export type TransformFn = (...args: unknown[]) => FileMap

export const TRANSFORM_REGISTRY: Record<string, TransformFn> = {
  copy: copy as unknown as TransformFn,
  rename: rename as unknown as TransformFn,
  'to-mdc': toMdc as unknown as TransformFn,
  concatenate: concatenate as unknown as TransformFn,
  'flatten-skill': flattenSkill as unknown as TransformFn,
  'split-identity': splitIdentity as unknown as TransformFn,
  'merge-mcp-config': mergeMcpConfig as unknown as TransformFn,
  'to-skill-dir': toSkillDir as unknown as TransformFn,
}
