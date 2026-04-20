'use strict';

const { ok, fail, ErrorCode } = require('./types');

/**
 * Create a ValidationService.
 * Pure version: validates a pre-parsed graph. No filesystem access.
 *
 * For server-side usage with parseRoot, wrap this in CLI:
 *   const graph = parseRoot(rootDir);
 *   const result = validationSvc.validate(graph, { strict });
 *
 * @param {{ logger: object }} ctx
 * @returns {object} ValidationService
 */
function createValidationService(ctx) {
  const { logger } = ctx;

  return {
    /**
     * Validate a parsed workflow graph.
     * @param {object} graph - Pre-parsed workflow graph
     * @param {{ strict?: boolean }} [options]
     */
    validate(graph, options = {}) {
      try {
        const { validate } = require('../validator');
        const strict = options.strict === true;
        const result = validate(graph, { strict });
        return ok(result);
      } catch (err) {
        logger.error({ err }, 'ValidationService.validate failed');
        return fail(ErrorCode.VALIDATION_FAILED, err.message);
      }
    },
  };
}

module.exports = { createValidationService };
