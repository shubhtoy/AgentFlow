'use strict';

const path = require('path');
const fs = require('fs');
const { ok, fail, ErrorCode } = require('./types');

/**
 * Create a TemplateService bound to a service context.
 * @param {{ rootDir: string, logger: object, brandConfig: object }} ctx
 * @returns {object} TemplateService
 */
function createTemplateService(ctx) {
  const { rootDir, logger } = ctx;

  return {
    /**
     * GET /api/library — return the library index.
     */
    getLibrary() {
      try {
        const { index } = require('../library');
        const libraryDir = path.resolve('library');
        if (!fs.existsSync(libraryDir)) {
          return ok({ entries: [] });
        }
        const result = index(libraryDir);
        return ok(result);
      } catch (err) {
        logger.error({ err }, 'TemplateService.getLibrary failed');
        return fail(ErrorCode.UNKNOWN, err.message);
      }
    },

    /**
     * POST /api/library/add — add a library item to the workspace.
     * @param {string} type — resource type (e.g. 'skill', 'tool')
     * @param {string} name — resource name
     */
    addFromLibrary(type, name) {
      try {
        const { index, add } = require('../library');
        const libraryDir = path.resolve('library');
        if (!fs.existsSync(libraryDir)) {
          return fail(ErrorCode.FILE_NOT_FOUND, 'Library directory not found', 400);
        }
        const registry = index(libraryDir);
        add(registry, type, name, rootDir);
        const { parseRoot } = require('../parser');
        return ok(parseRoot(rootDir));
      } catch (err) {
        logger.error({ err }, 'TemplateService.addFromLibrary failed');
        return fail(ErrorCode.INVALID_INPUT, err.message, 400);
      }
    },
  };
}

module.exports = { createTemplateService };
