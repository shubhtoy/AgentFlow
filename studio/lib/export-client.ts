/**
 * Client-side platform export — no server needed.
 */

import type { WorkflowGraph } from './types'

type ExportResult = { ok: true; data: { files: Record<string, string>; warnings: string[]; mappingReport: any; fidelityReport?: any } } | { ok: false; error: string }

export async function exportPlatformClientSide(
  platform: string,
  graph: WorkflowGraph,
  options: { workflowId?: string } = {}
): Promise<ExportResult> {
  try {
    const { TransportRegistry } = await import(/* webpackIgnore: true */ '@agentflow/transport/transport-registry')
    const { AdapterFactory } = await import(/* webpackIgnore: true */ '@agentflow/transport/adapter-factory')
    const { ExportPipeline } = await import(/* webpackIgnore: true */ '@agentflow/transport/export-pipeline')
    const platformConfigs = await import(/* webpackIgnore: true */ '@agentflow/transport/platform-configs')

    const registry = new TransportRegistry()
    AdapterFactory.fromConfigs(platformConfigs).registerAll(registry)

    if (!registry.supports(platform)) {
      return { ok: false as const, error: `Unknown platform: ${platform}` }
    }

    const pipeline = new ExportPipeline(registry)
    return pipeline.export(platform, graph, options) as Promise<ExportResult>
  } catch (err: any) {
    return { ok: false as const, error: err?.message || 'Export failed' }
  }
}
