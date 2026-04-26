/**
 * Singleton service layer for Next.js API routes.
 * Mirrors the Fastify createServiceLayer but initialized lazily.
 */

const path = require('path')
const { getWorkspaceRoot } = require('@/lib/runtime')
const { createLocalAdapter } = require('@/lib/workspace/local-adapter')

const ROOT_DIR = getWorkspaceRoot()
const _workspace = createLocalAdapter(ROOT_DIR)

const consoleLogger = {
  info: (...args: any[]) => console.log('[info]', ...args),
  error: (...args: any[]) => console.error('[error]', ...args),
  warn: (...args: any[]) => console.warn('[warn]', ...args),
  debug: () => {},
  child: () => consoleLogger,
}

let _services: any = null

export function getServices() {
  if (_services) return _services

  const { createWorkflowService } = require('@agentflow/cli/services/workflow-service')
  const { createValidationService } = require('@agentflow/cli/services/validation-service')
  const { createTemplateService } = require('@agentflow/cli/services/template-service')
  const { createGitService } = require('@agentflow/cli/services/git-service')
  const { createScaffoldGenService } = require('@agentflow/cli/services/scaffold-gen-service')
  const { createMCPBridge } = require('@agentflow/cli/services/mcp-bridge')
  const { exportForPlatform, toAgentSpec, listPlatforms } = require('@agentflow/cli/export')
  const { createImportService } = require('@agentflow/cli/services/import-service')
  const { HookRegistry } = require('@agentflow/cli/services/hook-registry')
  const { EventHookEngine } = require('@agentflow/core/services/event-hook-engine')
  const { createInstructionManager } = require('@agentflow/cli/services/instruction-manager')
  const { loadBrandConfig } = require('@agentflow/cli/branding')

  const brandConfig = loadBrandConfig(ROOT_DIR)
  const ctx = { rootDir: ROOT_DIR, logger: consoleLogger, brandConfig }
  const mcpBridge = createMCPBridge(ctx)

  const hookRegistry = new HookRegistry(ROOT_DIR)
  hookRegistry.loadAll()
  const hookEngine = new EventHookEngine(hookRegistry, { execute: async () => ({}) }, consoleLogger)
  const im = createInstructionManager(ctx)
  im.loadAll()

  _services = {
    workspace: _workspace,
    workflow: createWorkflowService(ctx),
    validation: createValidationService(ctx),
    template: createTemplateService(ctx),
    git: createGitService(ctx),
    scaffoldGen: createScaffoldGenService(ctx),
    mcpBridge,
    exportSvc: { exportForPlatform, toAgentSpec, listPlatforms },
    importSvc: createImportService(ctx),
    hookRegistry,
    hookEngine,
    instructionManager: im,
    brandConfig,
    rootDir: ROOT_DIR,
    logger: consoleLogger,
  }

  return _services
}

/** Helper: extract JSON body from NextRequest */
export async function jsonBody(req: Request) {
  try { return await req.json() } catch { return {} }
}

/** Helper: return JSON response */
export function json(data: any, status = 200) {
  return Response.json(data, { status })
}

/** Helper: handle ServiceResult pattern */
export function sendResult(result: any) {
  if (result.success) return json(result.data)
  const status = result.error?.statusCode || 500
  return json({ error: result.error.message, code: result.error.code }, status)
}
