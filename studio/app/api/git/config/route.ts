export const dynamic = 'force-dynamic'

import { GIT_PROVIDERS } from '@/lib/git-providers'

/**
 * GET /api/git/config — available auth methods based on env.
 */
export async function GET() {
  const isCloud = !!(process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT || process.env.RENDER)
  const localMode = process.env.AF_LOCAL_GIT !== 'false' && !isCloud

  const available = GIT_PROVIDERS.map(p => {
    const hasOAuth = p.oauth && process.env[p.oauth.clientId] && process.env[p.oauth.clientSecret]
    const hasDeviceFlow = p.deviceFlow && process.env[p.deviceFlow.clientId]
    return {
      id: p.id,
      name: p.name,
      oauth: !!hasOAuth,
      deviceFlow: !!hasDeviceFlow,
      tokenUrl: p.tokenUrl,
      tokenHint: p.tokenHint,
    }
  })

  return Response.json({ providers: available, localMode })
}
