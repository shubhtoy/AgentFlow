export const dynamic = 'force-dynamic'

import fs from 'fs'
import path from 'path'
import os from 'os'
import { GIT_PROVIDERS } from '@/lib/git-providers'

const SSH_DIR = path.join(os.homedir(), '.ssh')
const KEY_PATTERNS = ['id_ed25519', 'id_rsa', 'id_ecdsa', 'id_dsa']

/** GET /api/git — returns providers, localMode, and SSH key metadata in one call */
export async function GET() {
  const isCloud = !!(process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT || process.env.RENDER)
  const localMode = process.env.AF_LOCAL_GIT !== 'false' && !isCloud

  const providers = GIT_PROVIDERS.map(p => {
    const hasOAuth = p.oauth && process.env[p.oauth.clientId] && process.env[p.oauth.clientSecret]
    const hasDeviceFlow = p.deviceFlow && process.env[p.deviceFlow.clientId]
    return { id: p.id, name: p.name, oauth: !!hasOAuth, deviceFlow: !!hasDeviceFlow, tokenUrl: p.tokenUrl, tokenHint: p.tokenHint }
  })

  let ssh = { available: false, keys: [] as { type: string; filename: string; fingerprint: string | null }[] }
  if (!isCloud) {
    try {
      if (fs.existsSync(SSH_DIR)) {
        const files = fs.readdirSync(SSH_DIR)
        ssh.keys = KEY_PATTERNS.filter(k => files.includes(k)).map(k => {
          let fingerprint: string | null = null
          if (files.includes(`${k}.pub`)) {
            try { const pub = fs.readFileSync(path.join(SSH_DIR, `${k}.pub`), 'utf-8').trim(); fingerprint = pub.split(' ')[2] || null } catch {}
          }
          return { type: k.replace('id_', ''), filename: k, fingerprint }
        })
        ssh.available = ssh.keys.length > 0
      }
    } catch {}
  }

  return Response.json({ providers, localMode, ssh })
}
