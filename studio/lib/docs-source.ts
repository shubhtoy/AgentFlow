import { docs } from '@/.source'
import { loader } from 'fumadocs-core/source'
import { lucideIconsPlugin } from 'fumadocs-core/source/plugins/lucide-icons'

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: '/docs',
  plugins: [lucideIconsPlugin()],
})
