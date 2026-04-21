export const dynamic = 'force-dynamic'

/**
 * GitHub Device Flow proxy.
 * Browser can't call github.com directly (CORS), so we proxy 2 calls:
 *   start → POST github.com/login/device/code
 *   poll  → POST github.com/login/oauth/access_token
 *
 * Register a GitHub OAuth App at https://github.com/settings/applications/new
 * Set GITHUB_CLIENT_ID in .env.local
 */

const CLIENT_ID = process.env.GITHUB_CLIENT_ID || ''

export async function POST(req: Request) {
  if (!CLIENT_ID) return Response.json({ error: 'GITHUB_CLIENT_ID not set in .env.local' }, { status: 500 })

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
