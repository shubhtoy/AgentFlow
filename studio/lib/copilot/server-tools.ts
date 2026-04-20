/**
 * Server-side tools for the AgentFlow workspace assistant.
 * All tools are sandboxed to the .agentflow/ directory.
 */

import { defineTool } from '@copilotkit/runtime/v2'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { glob } from 'glob'

import { getWorkspaceRoot } from '@/lib/runtime'

// ── Path safety ──

function getAgentflowRoot(): string {
  return getWorkspaceRoot()
}

function safePath(relativePath: string): string | null {
  const root = getAgentflowRoot()
  // Normalize and resolve
  const resolved = path.resolve(root, relativePath)
  // Must be inside root — no traversal
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    return null
  }
  return resolved
}

// ── Tools ──

export const readWorkspaceFile = defineTool({
  name: 'readWorkspaceFile',
  description: 'Read a file from the .agentflow/ workspace. Path is relative to .agentflow/ root.',
  parameters: z.object({
    path: z.string().describe('File path relative to .agentflow/ (e.g. "build-feature/AGENTS.md")'),
  }),
  execute: async ({ path: filePath }) => {
    const resolved = safePath(filePath)
    if (!resolved) return { error: 'Invalid path — must be inside .agentflow/' }
    if (!fs.existsSync(resolved)) return { error: `File not found: ${filePath}` }
    const stat = fs.statSync(resolved)
    if (stat.isDirectory()) return { error: `${filePath} is a directory, not a file. Use listWorkspaceDirectory instead.` }
    if (stat.size > 100_000) return { error: `File too large (${stat.size} bytes). Max 100KB.` }
    const content = fs.readFileSync(resolved, 'utf-8')
    return { path: filePath, content, size: stat.size }
  },
})

export const listWorkspaceDirectory = defineTool({
  name: 'listWorkspaceDirectory',
  description: 'List files and directories inside .agentflow/. Path is relative to .agentflow/ root. Use empty string or "." for the root.',
  parameters: z.object({
    path: z.string().describe('Directory path relative to .agentflow/ (e.g. "build-feature" or ".")'),
  }),
  execute: async ({ path: dirPath }) => {
    const normalized = dirPath === '.' || dirPath === '' ? '' : dirPath
    const resolved = normalized ? safePath(normalized) : getAgentflowRoot()
    if (!resolved) return { error: 'Invalid path — must be inside .agentflow/' }
    if (!fs.existsSync(resolved)) return { error: `Directory not found: ${dirPath}` }
    if (!fs.statSync(resolved).isDirectory()) return { error: `${dirPath} is a file, not a directory. Use readWorkspaceFile instead.` }
    const entries = fs.readdirSync(resolved, { withFileTypes: true })
      .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'output')
      .map(e => ({ name: e.name, type: e.isDirectory() ? 'directory' : 'file' }))
    return { path: dirPath || '.', entries }
  },
})

export const searchWorkspace = defineTool({
  name: 'searchWorkspace',
  description: 'Search for text patterns across all files in .agentflow/. Returns matching lines with file paths.',
  parameters: z.object({
    query: z.string().describe('Text or regex pattern to search for'),
    filePattern: z.string().optional().describe('Glob pattern to filter files (e.g. "**/*.md"). Defaults to all .md files.'),
  }),
  execute: async ({ query, filePattern }) => {
    const root = getAgentflowRoot()
    if (!fs.existsSync(root)) return { error: '.agentflow/ directory not found' }
    const pattern = filePattern || '**/*.md'
    const files = await glob(pattern, { cwd: root, nodir: true, ignore: ['**/output/**', '**/node_modules/**'] })
    const results: { file: string; line: number; text: string }[] = []
    const regex = new RegExp(query, 'gi')
    for (const file of files.slice(0, 200)) {
      const fullPath = path.join(root, file)
      if (!fullPath.startsWith(root)) continue
      try {
        const content = fs.readFileSync(fullPath, 'utf-8')
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            results.push({ file, line: i + 1, text: lines[i].trim() })
            if (results.length >= 50) break
          }
          regex.lastIndex = 0
        }
        if (results.length >= 50) break
      } catch {}
    }
    return { query, filesSearched: files.length, matches: results }
  },
})

export const serverTools = [readWorkspaceFile, listWorkspaceDirectory, searchWorkspace]
