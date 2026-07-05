/**
 * Standardized error codes used across all services.
 * Maps to HTTP status codes for API responses.
 */

export const ErrorCode = {
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
} as const

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode]

export interface ServiceError {
  code: string
  message: string
  statusCode: number
  details?: unknown
}

export interface ServiceResultOk<T> {
  success: true
  data: T
}

export interface ServiceResultFail {
  success: false
  error: ServiceError
}

export type ServiceResult<T> = ServiceResultOk<T> | ServiceResultFail

const STATUS_MAP: Record<string, number> = {
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
}

export { STATUS_MAP }

export function toServiceError(code: string, message: string, statusCode?: number, details?: unknown): ServiceError {
  return {
    code,
    message,
    statusCode: statusCode || STATUS_MAP[code] || 500,
    ...(details !== undefined && { details }),
  }
}

export function ok<T>(data: T): ServiceResultOk<T> {
  return { success: true, data }
}

export function fail(code: string, message: string, statusCode?: number, details?: unknown): ServiceResultFail {
  return { success: false, error: toServiceError(code, message, statusCode, details) }
}
