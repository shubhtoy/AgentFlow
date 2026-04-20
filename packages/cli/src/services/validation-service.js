'use strict';

const { ok, fail, ErrorCode } = require('@agentflow/core/services/types');

/**
 * CLI ValidationService — wraps core's validate with filesystem parseRoot.
 */
function createValidationService(ctx) {
  const { rootDir, logger } = ctx;

  return {
    validate(options = {}) {
      try {
        const { parseRoot } = require('../parser');
        const { validate } = require('@agentflow/core/validator');
        const graph = parseRoot(rootDir);
        const strict = options.strict === true;
        return ok(validate(graph, { strict }));
      } catch (err) {
        logger.error({ err }, 'ValidationService.validate failed');
        return fail(ErrorCode.VALIDATION_FAILED, err.message);
      }
    },
  };
}

module.exports = { createValidationService };
