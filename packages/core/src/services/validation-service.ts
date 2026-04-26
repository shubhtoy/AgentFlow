import { ok, fail, ErrorCode } from './types'
import type { ServiceResult } from './types'
import { validate as coreValidate } from '../validator'
import type { ParsedGraph } from '../parser-core'

interface Logger {
  error(obj: unknown, msg: string): void;
}

interface ValidationOptions {
  strict?: boolean;
}

interface ValidationService {
  validate(graph: unknown, options?: ValidationOptions): ServiceResult<unknown>;
}

/**
 * Create a ValidationService.
 * Pure version: validates a pre-parsed graph. No filesystem access.
 */
export function createValidationService(ctx: { logger: Logger }): ValidationService {
  const { logger } = ctx;

  return {
    validate(graph: unknown, options: ValidationOptions = {}) {
      try {
        const strict = options.strict === true
        const result = coreValidate(graph as ParsedGraph, { strict })
        return ok(result);
      } catch (err: unknown) {
        logger.error({ err }, 'ValidationService.validate failed');
        return fail(ErrorCode.VALIDATION_FAILED, (err as Error).message);
      }
    },
  };
}
