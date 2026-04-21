export const dynamic = 'force-dynamic'

/**
 * GitHub Device Flow proxy.
 * Uses @octokit/auth-oauth-device server-side to handle CORS.
 * Only needs GITHUB_CLIENT_ID (no secret required for device flow).
 */

const CLIENT_ID = process.env.GITHUB_CLIENT_ID || ''

export async function POST(req: Request) {
  if (!CLIENT_ID) return Response.json({ error: 'GITHUB_CLIENT_ID not configured' }, { status: 501 })

  const { action, device_code } = await req.json()

  if (action === 'start') {
    const res = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: CLIENT_ID, scope: 'repo' }),
    })
    return Response.json(await res.json())
  }

  if (action === 'poll') {
    if (!device_code) return Response.json({ error: 'device_code required' }, { status: 400 })
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: CLIENT_ID, device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
    })
    return Response.json(await res.json())
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
