'use client'

import { type ReactNode } from 'react'
import { CopilotKitProvider } from '@copilotkit/react-core/v2'
import { toast } from 'sonner'
import { CopilotReadables } from './CopilotReadables'
import { CopilotActions } from './CopilotActions'
import { CopilotToolRenderers } from './CopilotToolRenderers'
import { CopilotSuggestions } from './CopilotSuggestions'
import { AgentStateSync } from './AgentStateSync'

export function CopilotProvider({ children }: { children: ReactNode }) {
  return (
    <CopilotKitProvider
      runtimeUrl="/api/copilotkit"
      showDevConsole={false}
      onError={(event) => {
        const msg = event.error?.message || 'An error occurred'
        console.error(`[CopilotKit ${event.code}]`, msg, event)
        toast.error(msg, { description: event.code })
      }}
    >
      <CopilotReadables />
      <CopilotActions />
      <CopilotToolRenderers />
      <CopilotSuggestions />
      <AgentStateSync />
      {children}
    </CopilotKitProvider>
  )
}
