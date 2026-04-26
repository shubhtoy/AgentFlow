/**
 * TemplateService.
 */

import path from 'path'
import fs from 'fs'
import { ok, fail, ErrorCode } from '@agentflow/core/services/types'

interface ServiceContext {
  rootDir: string
  logger: { error: (obj: unknown, msg: string) => void }
  brandConfig?: unknown
}

export function createTemplateService(ctx: ServiceContext) {
  const { rootDir, logger } = ctx

  return {
    getLibrary() {
      try {
        const { index } = require('../library')
        const libraryDir = path.resolve('library')
        if (!fs.existsSync(libraryDir)) return ok({ entries: [] })
        return ok(index(libraryDir))
      } catch (err: unknown) {
        logger.error({ err }, 'TemplateService.getLibrary failed')
        return fail(ErrorCode.UNKNOWN, (err as Error).message)
      }
    },

    addFromLibrary(type: string, name: string) {
      try {
        const { index, add } = require('../library')
        const libraryDir = path.resolve('library')
        if (!fs.existsSync(libraryDir)) {
          return fail(ErrorCode.FILE_NOT_FOUND, 'Library directory not found', 400)
        }
        const registry = index(libraryDir)
        add(registry, type, name, rootDir)
        const { parseRoot } = require('../parser')
        return ok(parseRoot(rootDir))
      } catch (err: unknown) {
        logger.error({ err }, 'TemplateService.addFromLibrary failed')
        return fail(ErrorCode.INVALID_INPUT, (err as Error).message, 400)
      }
    },
  }
}
