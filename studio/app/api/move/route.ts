export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, jsonBody, sendResult } from '@/lib/service-context'

const { moveSchema } = require('@agentflow/core/schemas')
const { fail, ErrorCode } = require('@agentflow/core/errors')

export async function POST(req: NextRequest) {
  const s = getServices()
  const body = await jsonBody(req)
  const parsed = moveSchema.safeParse(body)
  if (!parsed.success) {
    return sendResult(fail(ErrorCode.INVALID_INPUT, parsed.error.message, 400))
  }
  return sendResult(s.workflow.move(parsed.data.from, parsed.data.to))
}
