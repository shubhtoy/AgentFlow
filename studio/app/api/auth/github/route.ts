export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'

/**
 * Minimal proxy for GitHub Device Flow OAuth.
 * GitHub blocks device flow from browsers (CORS), so we proxy the 2 calls:
 * 1. POST /login/device/code → get user_code + device_code
 * 2. POST /login/oauth/access_token → poll for token
 *
 * No state stored server-side. Token is returned to client and stored in localStorage.
 */

const CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23liYMgJyPcMOOxMJq' // AgentFlow public OAuth App

export async function POST(req: NextRequest) {
  const { action, device_code } = await req.json()

  if (action === 'start') {
    const res = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: CLIENT_ID, scope: 'repo' }),
    })
    const data = await res.json()
    return Response.json(data)
  }

  if (action === 'poll') {
    if (!device_code) return Response.json({ error: 'device_code required' }, { status: 400 })
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: CLIENT_ID, device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
    })
    const data = await res.json()
    return Response.json(data)
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
