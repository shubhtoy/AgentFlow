import fs from 'fs'
import path from 'path'

/**
 * Resolve the AgentFlow workspace root directory.
 * Priority: AGENTFLOW_ROOT > _AGENTFLOW_CLI_ROOT > walk-up search > cwd/.agentflow/
 */
export function resolveRoot(startDir?: string): string {
  if (process.env.AGENTFLOW_ROOT) return path.resolve(process.env.AGENTFLOW_ROOT)
  if (process.env._AGENTFLOW_CLI_ROOT) return path.resolve(process.env._AGENTFLOW_CLI_ROOT)

  let dir = path.resolve(startDir || process.cwd())
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, '.agentflow')
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate
    dir = path.dirname(dir)
  }
  return path.join(process.cwd(), '.agentflow')
}
