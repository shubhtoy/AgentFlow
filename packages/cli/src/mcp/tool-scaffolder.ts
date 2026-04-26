/**
 * Tool Scaffolder.
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { loadMcpConfig, saveMcpConfig } from './config-manager'

const AGENTFLOW_DIR = '.agentflow'
const CAPABILITIES_DIR = 'capabilities'

export function toFileName(name: string): string {
  return name.replace(/[_\s]+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()
}

export function convertParameters(inputSchema: Record<string, unknown>): Record<string, unknown> {
  if (!inputSchema?.properties) return {}
  const params: Record<string, unknown> = {}
  const requiredFields = Array.isArray(inputSchema.required) ? inputSchema.required : []
  for (const [name, schema] of Object.entries(inputSchema.properties as Record<string, Record<string, unknown>>)) {
    params[name] = {
      type: schema.type,
      description: schema.description || name,
      required: requiredFields.includes(name),
    }
  }
  return params
}

export function generateToolContent(serverName: string, tool: { name: string, description?: string, inputSchema?: Record<string, unknown> }, generatedAt: string): string {
  const fileName = toFileName(tool.name)
  const description = tool.description || ''
  const parameters = convertParameters(tool.inputSchema || {})

  const frontmatterData = {
    name: fileName,
    type: 'mcp',
    mcp: serverName,
    description,
    parameters,
    generated: true,
    generatedAt,
  }

  const body = `\n# ${description || fileName}\n\n${description}\n\n## MCP Server\nServer: \`${serverName}\`\n`
  return matter.stringify(body, frontmatterData)
}

export function scaffoldTools(
  rootDir: string,
  serverName: string,
  tools: { name: string, description?: string, inputSchema?: Record<string, unknown> }[],
  opts: { overwrite?: boolean } = {},
): string[] {
  const toolsDir = path.join(rootDir, AGENTFLOW_DIR, CAPABILITIES_DIR)
  if (!fs.existsSync(toolsDir)) fs.mkdirSync(toolsDir, { recursive: true })

  const generatedAt = new Date().toISOString()
  const generatedPaths: string[] = []
  const toolNames: string[] = []

  for (const tool of tools) {
    if (!tool?.name) continue
    const fileName = toFileName(tool.name)
    const filePath = path.join(toolsDir, `${fileName}.md`)
    const relativePath = path.join(AGENTFLOW_DIR, CAPABILITIES_DIR, `${fileName}.md`)

    toolNames.push(fileName)

    if (fs.existsSync(filePath) && !opts.overwrite) {
      console.warn(`Skipping existing tool file: ${relativePath}`)
      continue
    }

    fs.writeFileSync(filePath, generateToolContent(serverName, tool, generatedAt), 'utf-8')
    generatedPaths.push(relativePath)
  }

  const { servers } = loadMcpConfig(rootDir)
  if (servers[serverName]) {
    (servers[serverName] as Record<string, unknown>).discoveredTools = toolNames
    saveMcpConfig(rootDir, servers)
  }

  return generatedPaths
}
