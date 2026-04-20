export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, jsonBody, json } from '@/lib/service-context'

const { builderCreateSchema } = require('@agentflow/core/schemas')

export async function POST(req: NextRequest) {
  const s = getServices()
  const body = await jsonBody(req)
  const parsed = builderCreateSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: parsed.error.issues }, 400)
  }

  const { scaffold, targetDir } = parsed.data

  // Validate scaffold first
  const validationResult = s.scaffoldGen.validateScaffold(scaffold)
  if (!validationResult.success) {
    return json(
      { error: validationResult.error.message, details: validationResult.error.details },
      validationResult.error.statusCode || 422
    )
  }

  // Generate workspace
  const dir = targetDir || s.rootDir
  const result = await s.scaffoldGen.generateWorkspace(validationResult.data, dir)
  if (!result.success) {
    return json(
      { error: result.error.message, details: result.error.details },
      result.error.statusCode || 500
    )
  }

  return json({ ok: true, graph: result.data })
}
