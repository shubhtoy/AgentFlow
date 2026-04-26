/**
 * Standalone client-side token counter using js-tiktoken.
 * Uses o200k_base encoding (GPT-4o / Claude 3.5+).
 */

import { encodingForModel } from 'js-tiktoken'
import { getWorkspace } from '@/lib/workspace'

let _enc: ReturnType<typeof encodingForModel> | null = null
function enc() {
  if (!_enc) _enc = encodingForModel('gpt-4o')
  return _enc
}

/** Count tokens in a string */
export function countTokens(text: string): number {
  return enc().encode(text).length
}

/** Count tokens for a specific workflow's files + shared resources */
export async function countWorkflowTokens(workflowId: string): Promise<{
  total: number
  files: { path: string; tokens: number }[]
}> {
  const ws = getWorkspace()
  if (!ws) return { total: 0, files: [] }

  let allFiles: { path: string; content: string }[]
  try {
    allFiles = await ws.readAll()
  } catch {
    return { total: 0, files: [] }
  }

  const encoder = enc()
  const prefix = workflowId + '/'
  const sharedPrefixes = ['instructions/', 'capabilities/', 'skills/', 'memory/']

  let total = 0
  const files: { path: string; tokens: number }[] = []

  for (const f of allFiles) {
    if (f.path.startsWith(prefix) || sharedPrefixes.some(p => f.path.startsWith(p))) {
      const tokens = encoder.encode(f.content).length
      total += tokens
      files.push({ path: f.path, tokens })
    }
  }

  files.sort((a, b) => b.tokens - a.tokens)
  return { total, files }
}
