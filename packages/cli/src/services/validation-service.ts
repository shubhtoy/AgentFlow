/**
 * CLI ValidationService.
 */

import { ok, fail, ErrorCode } from '@agentflow/core/services/types'

interface ServiceContext {
  rootDir: string
  logger: { error: (obj: unknown, msg: string) => void }
}

interface ValidateOptions {
  strict?: boolean
}

export function createValidationService(ctx: ServiceContext) {
  const { rootDir, logger } = ctx

  return {
    validate(options: ValidateOptions = {}) {
      try {
        const { parseRoot } = require('../parser')
        const { validate } = require('@agentflow/core/validator')
        const graph = parseRoot(rootDir)
        const strict = options.strict === true
        return ok(validate(graph, { strict }))
      } catch (err: unknown) {
        logger.error({ err }, 'ValidationService.validate failed')
        return fail(ErrorCode.VALIDATION_FAILED, (err as Error).message)
      }
    },
  }
}
