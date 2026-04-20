export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, jsonBody, json } from '@/lib/service-context'
import { parseClientFiles } from '@/lib/parse-client-files'

export async function POST(req: NextRequest) {
  const s = getServices()
  const body = await jsonBody(req)
  const { preview, workflow, format, files: clientFiles } = body

  try {
    const { parseRoot } = require('@agentflow/parser')
    const graph = clientFiles?.length ? parseClientFiles(clientFiles) : parseRoot(s.rootDir)

    let exportFiles: Record<string, string>

    if (format === 'raw' || format === 'parsed') {
      const { exportRaw, exportParsed } = require('@agentflow/structured-exporter')
      let wfId = workflow
      if (!wfId) {
        const wfIds = Object.keys(graph.workflows || {})
        if (wfIds.length === 0) return json({ error: 'No workflows found' }, 400)
        if (wfIds.length === 1) wfId = wfIds[0]
        // When multiple workflows and no wfId, export all (workspace scope)
      }
      if (wfId && !graph.workflows?.[wfId]) return json({ error: `Workflow "${wfId}" not found` }, 400)
      exportFiles = format === 'parsed' ? exportParsed(graph, wfId) : exportRaw(graph, wfId)
    } else {
      const { defaultExport } = require('@agentflow/transport/default-export')
      const result = defaultExport(graph, { workflowId: workflow })
      if (!result.ok) return json({ error: result.error || 'Export failed' }, 500)
      exportFiles = result.data.files
    }

    if (preview) return json({ files: exportFiles })

    const JSZip = require('jszip')
    const zip = new JSZip()
    for (const [filePath, content] of Object.entries(exportFiles)) {
      zip.file(filePath, content as string)
    }
    const buf = await zip.generateAsync({ type: 'nodebuffer' })
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${workflow || 'export'}.zip"`,
      },
    })
  } catch (err: any) {
    return json({ error: err.message || 'Export failed' }, 500)
  }
}
