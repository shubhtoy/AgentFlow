'use strict';

// Re-export from errors.js for convenience
const { ok, fail, ErrorCode, toServiceError } = require('../errors');

module.exports = { ok, fail, ErrorCode, toServiceError };
