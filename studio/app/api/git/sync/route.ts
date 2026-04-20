export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServices, jsonBody, sendResult } from '@/lib/service-context'

const { fail, ErrorCode } = require('@agentflow/core/errors')

export async function POST(req: NextRequest) {
  const s = getServices()
  const body = await jsonBody(req)
  if (!body.repoName) {
    return sendResult(fail(ErrorCode.INVALID_INPUT, 'repoName is required', 400))
  }
  return sendResult(await s.git.sync(body))
}
