/**
 * RepoScanner.
 */

import fs from 'fs'
import path from 'path'
import { glob } from 'glob'
import { parseMarkdownContent } from '@agentflow/core/parser-core'
import { RESERVED_DIRS } from '@agentflow/core/taxonomy'

export const DEFAULT_MAX_DEPTH = 5
export { RESERVED_DIRS }

interface ResourceEntry {
  name: string
  path: string
  resourceType: string
  hasFrontmatter: boolean
  frontmatterFields: string[]
}

interface WorkflowEntry {
  name: string
  path: string
  nodeCount: number
  hasDescriptor: boolean
  entryPoints: string[]
}

interface ScanResult {
  repoDir: string
  agentflowPaths: string[]
  resources: Record<string, ResourceEntry[]>
  workflows: WorkflowEntry[]
  stats: { totalFiles: number, totalWorkflows: number, totalResources: number, scanDurationMs: number }
  warnings: { path: string, message: string, severity: string }[]
}

function parseMarkdownFile(filePath: string, mode: 'metadata-only' | 'full' = 'metadata-only') {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return parseMarkdownContent(raw, filePath, mode)
  } catch { return null }
}

export function findAgentflowDirs(rootDir: string, maxDepth: number): string[] {
  const results: string[] = []
  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) }
    catch { return }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const fullPath = path.join(dir, entry.name)
      if (entry.name === '.agentflow') results.push(path.relative(rootDir, fullPath).replace(/\\/g, '/'))
      else walk(fullPath, depth + 1)
    }
  }
  walk(rootDir, 1)
  return results
}

export function scanReservedDir(dirPath: string, rootDir: string, resourceType: string): ResourceEntry[] {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return []
  const mdFiles = glob.sync('**/*.md', { cwd: dirPath, nodir: true })
  const resources: ResourceEntry[] = []
  for (const relFile of mdFiles) {
    const absFile = path.join(dirPath, relFile)
    const parsed = parseMarkdownFile(absFile)
    if (!parsed) continue
    const fm = parsed.frontmatter || {}
    resources.push({
      name: (fm.name as string) || path.basename(relFile, '.md'),
      path: path.relative(rootDir, absFile).replace(/\\/g, '/'),
      resourceType,
      hasFrontmatter: Object.keys(fm).length > 0,
      frontmatterFields: Object.keys(fm),
    })
  }
  return resources
}

export function detectWorkflow(dirPath: string): { isWorkflow: boolean, descriptorPath: string | null } {
  const agentsPath = path.join(dirPath, 'AGENTS.md')
  if (fs.existsSync(agentsPath)) return { isWorkflow: true, descriptorPath: agentsPath }
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dirPath, { withFileTypes: true }) }
  catch { return { isWorkflow: false, descriptorPath: null } }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const filePath = path.join(dirPath, entry.name)
    const parsed = parseMarkdownFile(filePath)
    if (parsed?.frontmatter?.type === 'agents') return { isWorkflow: true, descriptorPath: filePath }
  }
  return { isWorkflow: false, descriptorPath: null }
}

export function scanWorkflowDir(dirPath: string, rootDir: string): WorkflowEntry {
  const name = path.basename(dirPath)
  const relPath = path.relative(rootDir, dirPath).replace(/\\/g, '/')
  let nodeCount = 0
  const entryPoints: string[] = []

  const detection = detectWorkflow(dirPath)
  if (detection.isWorkflow && detection.descriptorPath) {
    const parsed = parseMarkdownFile(detection.descriptorPath)
    if (parsed?.frontmatter) {
      if (parsed.frontmatter.entry) entryPoints.push(parsed.frontmatter.entry as string)
      else if (Array.isArray(parsed.frontmatter.entryPoints)) entryPoints.push(...parsed.frontmatter.entryPoints)
    }
  }

  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dirPath, { withFileTypes: true }) }
  catch { entries = [] }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'output') continue
    try {
      const subFiles = fs.readdirSync(path.join(dirPath, entry.name))
      if (subFiles.some(f => f.endsWith('.md'))) nodeCount++
    } catch { /* skip */ }
  }

  return { name, path: relPath, nodeCount, hasDescriptor: detection.isWorkflow, entryPoints }
}

export function scan(rootDir: string, maxDepth: number = DEFAULT_MAX_DEPTH): ScanResult {
  const startTime = Date.now()
  const warnings: ScanResult['warnings'] = []
  const agentflowPaths = findAgentflowDirs(rootDir, maxDepth)

  if (agentflowPaths.length === 0) {
    warnings.push({ path: rootDir, message: 'No .agentflow directory found', severity: 'warning' })
    return {
      repoDir: rootDir, agentflowPaths: [],
      resources: Object.fromEntries(RESERVED_DIRS.map(d => [d, []])),
      workflows: [],
      stats: { totalFiles: 0, totalWorkflows: 0, totalResources: 0, scanDurationMs: Date.now() - startTime },
      warnings,
    }
  }

  const allResources: Record<string, ResourceEntry[]> = Object.fromEntries(RESERVED_DIRS.map(d => [d, []]))
  const allWorkflows: WorkflowEntry[] = []

  for (const afPath of agentflowPaths) {
    const fullPath = path.join(rootDir, afPath)
    for (const reservedDir of RESERVED_DIRS) {
      allResources[reservedDir].push(...scanReservedDir(path.join(fullPath, reservedDir), rootDir, reservedDir))
    }

    let subEntries: fs.Dirent[]
    try { subEntries = fs.readdirSync(fullPath, { withFileTypes: true }) }
    catch { subEntries = [] }
    for (const entry of subEntries) {
      if (!entry.isDirectory() || RESERVED_DIRS.includes(entry.name) || entry.name === 'output') continue
      const detection = detectWorkflow(path.join(fullPath, entry.name))
      if (detection.isWorkflow) allWorkflows.push(scanWorkflowDir(path.join(fullPath, entry.name), rootDir))
    }
  }

  const totalResources = RESERVED_DIRS.reduce((sum, dir) => sum + allResources[dir].length, 0)
  return {
    repoDir: rootDir, agentflowPaths, resources: allResources, workflows: allWorkflows,
    stats: {
      totalFiles: totalResources + allWorkflows.reduce((s, w) => s + w.nodeCount, 0),
      totalWorkflows: allWorkflows.length, totalResources, scanDurationMs: Date.now() - startTime,
    },
    warnings,
  }
}

let _cachedResult: ScanResult | null = null

export function scanIncremental(rootDir: string, changedFiles: string[]): ScanResult {
  if (!_cachedResult || _cachedResult.repoDir !== rootDir) {
    _cachedResult = scan(rootDir)
    return _cachedResult
  }

  const cached = _cachedResult
  const changedSet = new Set(changedFiles.map(f => f.replace(/\\/g, '/')))
  const updatedResources = Object.fromEntries(RESERVED_DIRS.map(d => [d, [...(cached.resources[d] || [])]]))
  const updatedWorkflows = [...cached.workflows]

  for (const changedFile of changedSet) {
    for (const afPath of cached.agentflowPaths) {
      for (const reservedDir of RESERVED_DIRS) {
        const prefix = afPath + '/' + reservedDir + '/'
        if (changedFile.startsWith(prefix)) {
          updatedResources[reservedDir] = updatedResources[reservedDir].filter(r => r.path !== changedFile)
          const absFile = path.join(rootDir, changedFile)
          if (fs.existsSync(absFile)) {
            const parsed = parseMarkdownFile(absFile)
            if (parsed) {
              const fm = parsed.frontmatter || {}
              updatedResources[reservedDir].push({
                name: (fm.name as string) || path.basename(changedFile, '.md'),
                path: changedFile, resourceType: reservedDir,
                hasFrontmatter: Object.keys(fm).length > 0, frontmatterFields: Object.keys(fm),
              })
            }
          }
        }
      }

      for (let i = updatedWorkflows.length - 1; i >= 0; i--) {
        const wf = updatedWorkflows[i]
        if (changedFile.startsWith(wf.path + '/') || changedFile === wf.path) {
          const wfAbsPath = path.join(rootDir, wf.path)
          if (fs.existsSync(wfAbsPath) && fs.statSync(wfAbsPath).isDirectory()) {
            updatedWorkflows[i] = scanWorkflowDir(wfAbsPath, rootDir)
          } else {
            updatedWorkflows.splice(i, 1)
          }
        }
      }
    }
  }

  const totalResources = RESERVED_DIRS.reduce((sum, dir) => sum + updatedResources[dir].length, 0)
  const result: ScanResult = {
    repoDir: rootDir, agentflowPaths: cached.agentflowPaths,
    resources: updatedResources, workflows: updatedWorkflows,
    stats: {
      totalFiles: totalResources + updatedWorkflows.reduce((s, w) => s + w.nodeCount, 0),
      totalWorkflows: updatedWorkflows.length, totalResources, scanDurationMs: 0,
    },
    warnings: cached.warnings,
  }
  _cachedResult = result
  return result
}

export function clearCache(): void {
  _cachedResult = null
}
