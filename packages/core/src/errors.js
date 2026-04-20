'use strict';

/**
 * Standardized error codes used across all services.
 * Maps to HTTP status codes for API responses.
 */
const ErrorCode = Object.freeze({
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PATH_TRAVERSAL: 'PATH_TRAVERSAL',
  INVALID_INPUT: 'INVALID_INPUT',
  FS_WRITE_ERROR: 'FS_WRITE_ERROR',
  CONCURRENT_EDIT: 'CONCURRENT_EDIT',
  MCP_SERVER_UNAVAILABLE: 'MCP_SERVER_UNAVAILABLE',
  LLM_PROVIDER_ERROR: 'LLM_PROVIDER_ERROR',
  SCAFFOLD_INVALID: 'SCAFFOLD_INVALID',
  GIT_SYNC_ERROR: 'GIT_SYNC_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  UNKNOWN: 'UNKNOWN',
});

/** Default HTTP status codes per error code. */
const STATUS_MAP = {
  [ErrorCode.VALIDATION_FAILED]: 422,
  [ErrorCode.FILE_NOT_FOUND]: 404,
  [ErrorCode.PATH_TRAVERSAL]: 403,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.FS_WRITE_ERROR]: 500,
  [ErrorCode.CONCURRENT_EDIT]: 409,
  [ErrorCode.MCP_SERVER_UNAVAILABLE]: 503,
  [ErrorCode.LLM_PROVIDER_ERROR]: 502,
  [ErrorCode.SCAFFOLD_INVALID]: 422,
  [ErrorCode.GIT_SYNC_ERROR]: 500,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.UNKNOWN]: 500,
};

/**
 * Create a ServiceError object.
 * @param {string} code — ErrorCode value
 * @param {string} message — Human-readable message
 * @param {number} [statusCode] — HTTP status (auto-resolved from code if omitted)
 * @param {unknown} [details] — Optional structured details (e.g. Zod issues)
 * @returns {{ code: string, message: string, statusCode: number, details?: unknown }}
 */
function toServiceError(code, message, statusCode, details) {
  return {
    code,
    message,
    statusCode: statusCode || STATUS_MAP[code] || 500,
    ...(details !== undefined && { details }),
  };
}

/**
 * Wrap a value as a successful ServiceResult.
 * @template T
 * @param {T} data
 * @returns {{ success: true, data: T }}
 */
function ok(data) {
  return { success: true, data };
}

/**
 * Wrap an error as a failed ServiceResult.
 * @param {string} code — ErrorCode value
 * @param {string} message
 * @param {number} [statusCode]
 * @param {unknown} [details]
 * @returns {{ success: false, error: ServiceError }}
 */
function fail(code, message, statusCode, details) {
  return { success: false, error: toServiceError(code, message, statusCode, details) };
}

module.exports = { ErrorCode, STATUS_MAP, toServiceError, ok, fail };
