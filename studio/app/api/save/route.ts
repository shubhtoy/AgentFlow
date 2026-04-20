export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, jsonBody, json, sendResult } from '@/lib/service-context'

const { saveSchema } = require('@agentflow/schemas')
const { fail, ErrorCode } = require('@agentflow/errors')

export async function POST(req: NextRequest) {
  const s = getServices()
  const body = await jsonBody(req)
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return sendResult(fail(ErrorCode.INVALID_INPUT, parsed.error.message, 400))
  }
  return sendResult(s.workflow.save(parsed.data.edits))
}
