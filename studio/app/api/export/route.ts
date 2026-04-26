export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { parseFromFiles } from '@agentflow/core/parser-core'
import { toAgentSpec, exportForPlatform, listPlatforms } from '@agentflow/cli/export'

/** GET /api/export — list available platform IDs */
export async function GET() {
  try {
    return NextResponse.json({ platforms: listPlatforms() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/** POST /api/export — export workspace files for a platform */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { files, format } = body as {
      files: Record<string, string>
      format: string
      workflowId?: string
    }

    if (!files || !format) {
      return NextResponse.json(
        { error: 'Missing required fields: files, format' },
        { status: 400 },
      )
    }

    const graph = parseFromFiles(files)

    let result: Record<string, string>
    if (format === 'agent-spec') {
      result = { 'agent-spec.json': JSON.stringify(toAgentSpec(graph), null, 2) }
    } else {
      result = exportForPlatform(graph, format)
    }

    return NextResponse.json({ files: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
