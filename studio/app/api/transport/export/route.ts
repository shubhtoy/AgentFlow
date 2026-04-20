export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, jsonBody, json } from '@/lib/service-context'
import { parseClientFiles } from '@/lib/parse-client-files'

export async function POST(req: NextRequest) {
  const path = require('path')
  const { TransportRegistry } = require('@agentflow/core/transport/transport-registry')
  const { AdapterFactory } = require('@agentflow/core/transport/adapter-factory')
  const { ExportPipeline } = require('@agentflow/core/transport/export-pipeline')
  const { parseRoot } = require('@agentflow/cli/parser')

  const s = getServices()
  const body = await jsonBody(req)
  const { platform, preview, workflow, files: clientFiles } = body

  if (!platform) return json({ error: 'platform is required' }, 400)

  const registry = new TransportRegistry()
  const platformsDir = path.resolve(process.cwd(), '..', 'src', 'transport', 'platforms')
  const factory = new AdapterFactory(platformsDir)
  factory.registerAll(registry)

  if (!registry.supports(platform)) return json({ error: `Unknown platform: ${platform}` }, 400)

  const graph = clientFiles?.length ? parseClientFiles(clientFiles) : parseRoot(s.rootDir)
  const pipeline = new ExportPipeline(registry)
  const result = await pipeline.export(platform, graph, { workflowId: workflow })

  if (!result.ok) return json({ error: result.error }, 500)

  if (preview) {
    return json({
      files: result.data.files,
      warnings: result.data.warnings,
      mappingReport: result.data.mappingReport,
      fidelityReport: result.data.fidelityReport,
    })
  }

  const JSZip = require('jszip')
  const zip = new JSZip()
  for (const [filePath, content] of Object.entries(result.data.files)) {
    zip.file(filePath, content as string)
  }
  const buf = await zip.generateAsync({ type: 'nodebuffer' })
  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${workflow || 'export'}-${platform}.zip"`,
    },
  })
}
