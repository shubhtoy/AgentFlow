/**
 * WorkflowService.
 */

import path from 'path'
import fs from 'fs'
import { ok, fail, ErrorCode } from '@agentflow/core/services/types'
import { validatePath } from '../svc-utils/validate-path'
import { atomicWrite } from '../svc-utils/file-io'
import { isReservedDir, RESOURCE_TYPE_MAP } from '@agentflow/core/taxonomy'
import type { ParsedFile } from '@agentflow/core/parser-core'

interface ServiceContext {
  rootDir: string
  logger: { error: (obj: unknown, msg: string) => void }
  brandConfig?: unknown
}

interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeNode[]
  isReservedDir?: boolean
  isArtifactDir?: boolean
  isNodeDir?: boolean
  resourceType?: string
  isPrimary?: boolean
}

interface Edit {
  path: string
  content: string
}

export function createWorkflowService(ctx: ServiceContext) {
  const { rootDir, logger } = ctx

  const getParser = () => require('../parser')

  function buildTree(dirPath: string, root: string): TreeNode {
    const { classifyResource, identifyPrimaryFile } = getParser()
    const ARTIFACT = new Set(['output'])
    const name = path.basename(dirPath)
    const relPath = path.relative(root, dirPath)
    const node: TreeNode = { name, path: relPath || '.', type: 'directory', children: [] }

    const depth = relPath.split(path.sep).filter(Boolean).length
    if (depth === 1 && isReservedDir(name)) node.isReservedDir = true
    if (ARTIFACT.has(name)) node.isArtifactDir = true

    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dirPath, { withFileTypes: true }) }
    catch { return node }

    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })

    const mdFiles = entries.filter(e => e.isFile() && e.name.endsWith('.md'))
    const subdirs = entries.filter(e =>
      e.isDirectory() && !e.name.startsWith('.') &&
      e.name !== 'node_modules' && e.name !== '_archive',
    )

    const isNodeDir = mdFiles.length > 0 && !node.isReservedDir &&
      !node.isArtifactDir && relPath !== '' && relPath !== '.'
    if (isNodeDir) node.isNodeDir = true

    let parsedFiles: (ParsedFile & { _basename: string, _isPrimary?: boolean })[] | null = null
    if (isNodeDir && mdFiles.length > 0) {
      try {
        const { parseMarkdownFile } = getParser()
        parsedFiles = mdFiles.map(f => {
          const fp = path.join(dirPath, f.name)
          const parsed = parseMarkdownFile(fp, 'metadata-only')
          return { ...parsed, _basename: f.name }
        })
        const primary = identifyPrimaryFile(parsedFiles)
        if (primary) primary._isPrimary = true
      } catch { parsedFiles = null }
    }

    for (const sub of subdirs) {
      node.children!.push(buildTree(path.join(dirPath, sub.name), root))
    }

    for (const f of mdFiles) {
      const filePath = path.join(dirPath, f.name)
      const fileRelPath = path.relative(root, filePath)
      const fileNode: TreeNode = { name: f.name, path: fileRelPath, type: 'file' }

      if (parsedFiles) {
        const parsed = parsedFiles.find(p => p._basename === f.name)
        if (parsed) {
          const rt = classifyResource(parsed, dirPath)
          if (rt) fileNode.resourceType = rt
          if (parsed._isPrimary) fileNode.isPrimary = true
        }
      } else if (node.isReservedDir) {
        const rt = RESOURCE_TYPE_MAP[name]
        if (rt) fileNode.resourceType = rt
      }

      node.children!.push(fileNode)
    }

    const otherFiles = entries.filter(e => e.isFile() && !e.name.endsWith('.md'))
    for (const f of otherFiles) {
      const fileRelPath = path.relative(root, path.join(dirPath, f.name))
      node.children!.push({ name: f.name, path: fileRelPath, type: 'file' })
    }

    return node
  }

  return {
    getData() {
      try {
        const { parseRoot } = getParser()
        return ok(parseRoot(rootDir))
      } catch (err: unknown) {
        logger.error({ err }, 'WorkflowService.getData failed')
        return fail(ErrorCode.UNKNOWN, (err as Error).message)
      }
    },

    save(edits: Edit[]) {
      try {
        for (const edit of edits) {
          const check = validatePath(edit.path, rootDir)
          if (!check.valid) {
            return fail(ErrorCode.PATH_TRAVERSAL, `Invalid path: ${edit.path} — ${check.error}`, 400)
          }
          atomicWrite(check.resolved, edit.content)
        }
        const { parseRoot } = getParser()
        return ok(parseRoot(rootDir))
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'success' in err && !(err as { success: boolean }).success) return err
        logger.error({ err }, 'WorkflowService.save failed')
        return fail(ErrorCode.FS_WRITE_ERROR, (err as Error).message)
      }
    },

    create(filePath: string, content: string) {
      try {
        const check = validatePath(filePath, rootDir)
        if (!check.valid) {
          return fail(ErrorCode.PATH_TRAVERSAL, `Invalid path: ${filePath} — ${check.error}`, 400)
        }
        fs.mkdirSync(path.dirname(check.resolved), { recursive: true })
        atomicWrite(check.resolved, content || '')
        const { parseRoot } = getParser()
        return ok(parseRoot(rootDir))
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'success' in err && !(err as { success: boolean }).success) return err
        logger.error({ err }, 'WorkflowService.create failed')
        return fail(ErrorCode.FS_WRITE_ERROR, (err as Error).message)
      }
    },

    delete(filePath: string) {
      try {
        const check = validatePath(filePath, rootDir)
        if (!check.valid) {
          return fail(ErrorCode.PATH_TRAVERSAL, `Invalid path: ${filePath} — ${check.error}`, 400)
        }
        if (fs.existsSync(check.resolved)) {
          fs.rmSync(check.resolved, { recursive: true })
        }
        const { parseRoot } = getParser()
        return ok(parseRoot(rootDir))
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'success' in err && !(err as { success: boolean }).success) return err
        logger.error({ err }, 'WorkflowService.delete failed')
        return fail(ErrorCode.FS_WRITE_ERROR, (err as Error).message)
      }
    },

    move(from: string, to: string) {
      try {
        const fromCheck = validatePath(from, rootDir)
        if (!fromCheck.valid) return fail(ErrorCode.PATH_TRAVERSAL, `Invalid source path: ${from} — ${fromCheck.error}`, 400)
        const toCheck = validatePath(to, rootDir)
        if (!toCheck.valid) return fail(ErrorCode.PATH_TRAVERSAL, `Invalid destination path: ${to} — ${toCheck.error}`, 400)
        if (!fs.existsSync(fromCheck.resolved)) return fail(ErrorCode.FILE_NOT_FOUND, `Source not found: ${from}`, 404)
        fs.mkdirSync(path.dirname(toCheck.resolved), { recursive: true })
        fs.renameSync(fromCheck.resolved, toCheck.resolved)
        return ok(buildTree(rootDir, rootDir))
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'success' in err && !(err as { success: boolean }).success) return err
        logger.error({ err }, 'WorkflowService.move failed')
        return fail(ErrorCode.FS_WRITE_ERROR, (err as Error).message)
      }
    },

    getTree() {
      try {
        return ok(buildTree(rootDir, rootDir))
      } catch (err: unknown) {
        logger.error({ err }, 'WorkflowService.getTree failed')
        return fail(ErrorCode.UNKNOWN, (err as Error).message)
      }
    },
  }
}
