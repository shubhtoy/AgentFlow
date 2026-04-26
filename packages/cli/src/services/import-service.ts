/**
 * ImportService.
 */

import fs from 'fs'
import path from 'path'
import { ok, fail, ErrorCode } from '@agentflow/core/services/types'

interface ServiceContext {
  rootDir: string
  logger: { error: (obj: unknown, msg: string) => void }
}

interface ImportOptions {
  overwrite?: boolean
  dryRun?: boolean
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

function validateFileMap(fileMap: Record<string, string>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!fileMap || Object.keys(fileMap).length === 0) {
    errors.push('No files in import')
    return { valid: false, errors, warnings }
  }

  for (const p of Object.keys(fileMap)) {
    if (p.includes('..')) errors.push(`Path traversal detected: ${p}`)
    if (path.isAbsolute(p)) errors.push(`Absolute path not allowed: ${p}`)
  }

  const hasAgents = Object.keys(fileMap).some(p => p === 'AGENTS.md' || p.endsWith('/AGENTS.md'))
  if (!hasAgents) warnings.push('No AGENTS.md found — this may not be a complete workspace')

  for (const [p, content] of Object.entries(fileMap)) {
    if (!p.endsWith('.md')) continue
    if (content.startsWith('---') && content.indexOf('---', 3) === -1) {
      warnings.push(`Invalid frontmatter in ${p} — no closing ---`)
    }
  }

  for (const [p, content] of Object.entries(fileMap)) {
    if (content.length > 10240) {
      warnings.push(`Large file: ${p} (${Math.round(content.length / 1024)}KB)`)
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

function writeFileMap(
  fileMap: Record<string, string>,
  targetRoot: string,
  options: ImportOptions = {},
): { written: string[], skipped: string[] } {
  const written: string[] = []
  const skipped: string[] = []

  for (const [relPath, content] of Object.entries(fileMap)) {
    const fullPath = path.join(targetRoot, relPath)
    if (fs.existsSync(fullPath) && !options.overwrite) {
      skipped.push(relPath)
      continue
    }
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content, 'utf8')
    written.push(relPath)
  }

  return { written, skipped }
}

function parseImportJson(json: string | Record<string, unknown>): Record<string, string> | null {
  const data = typeof json === 'string' ? JSON.parse(json) : json
  if (data.v && data.f) return data.f as Record<string, string>
  if (data.files) return data.files as Record<string, string>
  return null
}

function stripPrefix(filePath: string): string {
  for (const prefix of ['.agentflow/', 'agentflow/']) {
    if (filePath.startsWith(prefix)) return filePath.slice(prefix.length)
  }
  return filePath
}

function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDirRecursive(srcPath, destPath)
    else fs.copyFileSync(srcPath, destPath)
  }
}

export function createImportService(ctx: ServiceContext) {
  const { rootDir, logger } = ctx

  return {
    async importFromZip(buffer: Buffer, targetRoot?: string, options: ImportOptions = {}) {
      try {
        const JSZip = require('jszip')
        const zip = await JSZip.loadAsync(buffer)
        const fileMap: Record<string, string> = {}

        for (const [zipPath, entry] of Object.entries(zip.files)) {
          if ((entry as { dir: boolean }).dir) continue
          const content = await (entry as { async: (t: string) => Promise<string> }).async('string')
          const relPath = stripPrefix(zipPath)
          if (relPath) fileMap[relPath] = content
        }

        const validation = validateFileMap(fileMap)
        if (!validation.valid) return fail(ErrorCode.INVALID_INPUT, validation.errors.join('; '), 400)
        if (options.dryRun) return ok({ filesWritten: Object.keys(fileMap), skipped: [], warnings: validation.warnings, dryRun: true })

        const { written, skipped } = writeFileMap(fileMap, targetRoot || rootDir, options)
        return ok({ filesWritten: written, skipped, warnings: validation.warnings })
      } catch (err: unknown) {
        logger.error({ err }, 'ImportService.importFromZip failed')
        return fail(ErrorCode.UNKNOWN, (err as Error).message)
      }
    },

    async importFromUrl(url: string, targetRoot?: string, options: ImportOptions = {}) {
      try {
        const resp = await fetch(url)
        if (!resp.ok) return fail(ErrorCode.UNKNOWN, `Failed to fetch URL: ${resp.status}`, 400)
        const json = await resp.text()
        const fileMap = parseImportJson(json)
        if (!fileMap) return fail(ErrorCode.INVALID_INPUT, 'Unrecognized import format', 400)

        const validation = validateFileMap(fileMap)
        if (!validation.valid) return fail(ErrorCode.INVALID_INPUT, validation.errors.join('; '), 400)
        if (options.dryRun) return ok({ filesWritten: Object.keys(fileMap), skipped: [], warnings: validation.warnings, dryRun: true })

        const { written, skipped } = writeFileMap(fileMap, targetRoot || rootDir, options)
        return ok({ filesWritten: written, skipped, warnings: validation.warnings })
      } catch (err: unknown) {
        logger.error({ err }, 'ImportService.importFromUrl failed')
        return fail(ErrorCode.UNKNOWN, (err as Error).message)
      }
    },

    importFromClipboard(jsonString: string, targetRoot?: string, options: ImportOptions = {}) {
      try {
        const fileMap = parseImportJson(jsonString)
        if (!fileMap) return fail(ErrorCode.INVALID_INPUT, 'Unrecognized import format', 400)

        const validation = validateFileMap(fileMap)
        if (!validation.valid) return fail(ErrorCode.INVALID_INPUT, validation.errors.join('; '), 400)
        if (options.dryRun) return ok({ filesWritten: Object.keys(fileMap), skipped: [], warnings: validation.warnings, dryRun: true })

        const { written, skipped } = writeFileMap(fileMap, targetRoot || rootDir, options)
        return ok({ filesWritten: written, skipped, warnings: validation.warnings })
      } catch (err: unknown) {
        logger.error({ err }, 'ImportService.importFromClipboard failed')
        return fail(ErrorCode.UNKNOWN, (err as Error).message)
      }
    },

    importFromLibrary(type: string, name: string, targetRoot?: string) {
      try {
        const libraryDir = path.join(__dirname, '..', '..', 'library')
        const registryPath = path.join(libraryDir, 'registry.json')
        if (!fs.existsSync(registryPath)) return fail(ErrorCode.FILE_NOT_FOUND, 'Library registry not found', 404)

        const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
        const entry = registry.entries.find((e: { type: string, name: string }) => e.type === type && e.name === name)
        if (!entry) {
          const available = registry.entries.filter((e: { type: string }) => e.type === type).map((e: { name: string }) => e.name)
          return fail(ErrorCode.FILE_NOT_FOUND, `"${name}" not found. Available ${type}s: ${available.join(', ')}`, 404)
        }

        const sourcePath = path.join(libraryDir, entry.path)
        const target = targetRoot || rootDir

        if (fs.statSync(sourcePath).isDirectory()) {
          const destDir = path.join(target, path.basename(entry.path))
          copyDirRecursive(sourcePath, destDir)
          return ok({ filesWritten: [path.basename(entry.path)], skipped: [], warnings: [] })
        }

        const categoryDir = path.join(target, `${type}s`)
        fs.mkdirSync(categoryDir, { recursive: true })
        fs.copyFileSync(sourcePath, path.join(categoryDir, path.basename(entry.path)))
        return ok({ filesWritten: [`${type}s/${path.basename(entry.path)}`], skipped: [], warnings: [] })
      } catch (err: unknown) {
        logger.error({ err }, 'ImportService.importFromLibrary failed')
        return fail(ErrorCode.UNKNOWN, (err as Error).message)
      }
    },

    validateFileMap,
  }
}
