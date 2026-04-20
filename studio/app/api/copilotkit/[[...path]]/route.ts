import {
  CopilotRuntime,
  createCopilotEndpoint,
  InMemoryAgentRunner,
} from '@copilotkit/runtime/v2'
import { LangGraphAgent } from '@copilotkit/runtime/langgraph'
import { handle } from 'hono/vercel'
import nodePath from 'path'
import { getMode, getWorkspaceRoot } from '@/lib/runtime'

// ── MCP servers from .agentflow/mcp.json ──

function getMcpServers() {
  try {
    const { loadMcpConfig, resolveEnvTokens } = require('@agentflow/mcp/config-manager')
    const rootDir = nodePath.dirname(getWorkspaceRoot())
    const { servers } = loadMcpConfig(rootDir)
    const entries: any[] = []
    for (const [, cfg] of Object.entries<any>(servers)) {
      if (cfg.disabled || !cfg.url) continue
      const resolved = resolveEnvTokens(cfg.env || {})
      const headers: Record<string, string> = {}
      for (const [k, v] of Object.entries(resolved)) {
        if (!v || typeof v !== 'string') continue
        const kl = k.toLowerCase()
        if (kl.includes('token') || kl.includes('key') || kl.includes('secret') || kl.includes('auth'))
          headers['Authorization'] = headers['Authorization'] || `Bearer ${v}`
        if (kl.includes('api_key') || kl.includes('apikey'))
          headers['X-API-Key'] = v as string
      }
      const isSSE = cfg.url.includes('/sse')
      entries.push({
        type: isSSE ? 'sse' as const : 'http' as const,
        url: cfg.url,
        ...(isSSE && Object.keys(headers).length > 0 ? { headers } : {}),
        ...(!isSSE && Object.keys(headers).length > 0 ? { options: { requestInit: { headers } } } : {}),
      })
    }
    return entries
  } catch { return [] }
}

const PRECONFIGURED_MCPS = [
  { type: 'sse' as const, url: 'https://gitmcp.io/shubhtoy/agentflow/sse' },
]

const LANGGRAPH_URL = process.env.LANGGRAPH_DEPLOYMENT_URL

const agents: Record<string, any> = {}
if (LANGGRAPH_URL) {
  const agent = new LangGraphAgent({
    deploymentUrl: LANGGRAPH_URL,
    graphId: process.env.LANGGRAPH_GRAPH_ID || 'agent',
  })
  agents.default = agent
}

const runtime = new CopilotRuntime({
  agents,
  runner: new InMemoryAgentRunner(),
  mcpApps: { servers: [...PRECONFIGURED_MCPS, ...getMcpServers()] },
})

const app = createCopilotEndpoint({ runtime, basePath: '/api/copilotkit' })
export const GET = handle(app)
export const POST = handle(app)
