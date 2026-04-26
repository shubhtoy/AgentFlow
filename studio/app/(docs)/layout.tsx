import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { RootProvider } from 'fumadocs-ui/provider/next'
import type { ReactNode } from 'react'
import { source } from '@/lib/docs-source'
import { ThemeSwitcher } from '@/components/docs/ThemeSwitcher'

export default function DocsRootLayout({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      search={{
        options: {
          type: process.env.NODE_ENV === 'production' ? 'static' : 'fetch',
        },
      }}
    >
      <DocsLayout
        tree={source.getPageTree() as any}
        nav={{ title: 'AgentFlow' }}
        sidebar={{ footer: <ThemeSwitcher /> }}
        containerProps={{ style: { '--fd-layout-width': '100%' } as React.CSSProperties }}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  )
}
