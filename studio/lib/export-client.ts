/**
 * Client-side platform export — no server needed.
 *
 * Uses the same ExportPipeline / PlatformAdapter / transforms as the CLI.
 * Platform configs are bundled at build time (platform-configs.js).
 */

import type { WorkflowGraph } from './types'

export async function exportPlatformClientSide(
  platform: string,
  graph: WorkflowGraph,
  options: { workflowId?: string } = {}
): Promise<{ ok: true; data: { files: Record<string, string>; warnings: string[]; mappingReport: any; fidelityReport?: any } } | { ok: false; error: string }> {
  const { TransportRegistry } = require('@agentflow/transport/transport-registry')
  const { AdapterFactory } = require('@agentflow/transport/adapter-factory')
  const { ExportPipeline } = require('@agentflow/transport/export-pipeline')
  const platformConfigs = require('@agentflow/transport/platform-configs')

  const registry = new TransportRegistry()
  AdapterFactory.fromConfigs(platformConfigs).registerAll(registry)

  if (!registry.supports(platform)) {
    return { ok: false, error: `Unknown platform: ${platform}` }
  }

  const pipeline = new ExportPipeline(registry)
  return pipeline.export(platform, graph, options)
}
