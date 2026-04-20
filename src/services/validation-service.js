'use strict';

const { ok, fail, ErrorCode } = require('./types');

/**
 * Create a ValidationService bound to a service context.
 * @param {{ rootDir: string, logger: object, brandConfig: object }} ctx
 * @returns {object} ValidationService
 */
function createValidationService(ctx) {
  const { rootDir, logger } = ctx;

  return {
    /**
     * POST /api/validate — validate the workspace graph.
     * @param {{ strict?: boolean }} [options]
     */
    validate(options = {}) {
      try {
        const { parseRoot } = require('../parser');
        const { validate } = require('../validator');
        const graph = parseRoot(rootDir);
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
