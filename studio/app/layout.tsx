import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AgentFlow',
  description: 'Directory-based agent workflow orchestration',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
