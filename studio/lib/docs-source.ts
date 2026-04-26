import { docs } from '@/.source'
import { loader } from 'fumadocs-core/source'
import { lucideIconsPlugin } from 'fumadocs-core/source/plugins/lucide-icons'
import { statusBadgesPlugin } from 'fumadocs-core/source/plugins/status-badges'

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: '/docs',
  plugins: [
    lucideIconsPlugin(),
    statusBadgesPlugin({
      renderBadge: (status) => {
        const colors: Record<string, string> = {
          new: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
          beta: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
          deprecated: 'bg-red-500/10 text-red-600 border-red-500/20',
          experimental: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
        }
        const cls = colors[status] || 'bg-muted text-muted-foreground border-border'
        // Return a React element — fumadocs renders this in the sidebar
        const React = require('react')
        return React.createElement('span', {
          className: `ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded-md border ${cls}`,
        }, status)
      },
    }),
  ],
})
