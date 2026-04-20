export const dynamic = 'force-dynamic'

import { json } from '@/lib/service-context'

export async function GET() {
  const path = require('path')
  const { TransportRegistry } = require('@agentflow/transport/transport-registry')
  const { AdapterFactory } = require('@agentflow/transport/adapter-factory')

  const registry = new TransportRegistry()
  const platformsDir = path.resolve(process.cwd(), '..', 'src', 'transport', 'platforms')
  const factory = new AdapterFactory(platformsDir)
  factory.registerAll(registry)

  return json({ platforms: registry.list() })
}
