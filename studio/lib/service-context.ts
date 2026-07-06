/**
 * Singleton service layer for Next.js API routes.
 * Uses static ESM imports so Next.js transpilePackages can process @agentflow/* .ts sources.
 */

import { getWorkspaceRoot } from '@/lib/runtime'
import { createLocalAdapter } from '@/lib/workspace/local-adapter'
import { createWorkflowService } from '@agentflow/cli/services/workflow-service'
import { createValidationService } from '@agentflow/cli/services/validation-service'
import { createTemplateService } from '@agentflow/cli/services/template-service'
import { createGitService } from '@agentflow/cli/services/git-service'
import { createScaffoldGenService } from '@agentflow/cli/services/scaffold-gen-service'
import { createMCPBridge } from '@agentflow/cli/services/mcp-bridge'
import { createImportService } from '@agentflow/cli/services/import-service'
import { HookRegistry } from '@agentflow/cli/services/hook-registry'
import { EventHookEngine } from '@agentflow/core/services/event-hook-engine'
import { createInstructionManager } from '@agentflow/cli/services/instruction-manager'
import { loadBrandConfig } from '@agentflow/cli/branding'

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

  const brandConfig = loadBrandConfig(ROOT_DIR)
  const ctx = { rootDir: ROOT_DIR, logger: consoleLogger, brandConfig }
  const mcpBridge = createMCPBridge(ctx)

  const hookRegistry = new HookRegistry(ROOT_DIR)
  hookRegistry.loadAll()
  const hookEngine = new EventHookEngine(
    hookRegistry as unknown as ConstructorParameters<typeof EventHookEngine>[0],
    { execute: async () => ({}) },
    consoleLogger,
  )
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
