export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, jsonBody, sendResult } from '@/lib/service-context'

const { createSchema } = require('@agentflow/schemas')
const { fail, ErrorCode } = require('@agentflow/errors')

export async function POST(req: NextRequest) {
  const s = getServices()
  const body = await jsonBody(req)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return sendResult(fail(ErrorCode.INVALID_INPUT, parsed.error.message, 400))
  }
  return sendResult(s.workflow.create(parsed.data.path, parsed.data.content))
}
