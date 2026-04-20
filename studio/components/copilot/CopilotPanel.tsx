'use client'

import { useState, useMemo } from 'react'
import { Sparkles, Workflow, Settings } from 'lucide-react'
import { CopilotChat } from '@copilotkit/react-core/v2'
import { FlowAvatar } from './FlowAvatar'
import { ModelPicker } from './ModelPicker'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { emit } from '@/utils/events'

function FlowWelcomeScreen({ input, suggestionView }: any) {
  const data = useAppStore(s => s.data)
  const workflows = useMemo(() => {
    if (!data?.workflows) return []
    return Object.entries(data.workflows)
      .filter(([, wf]) => Object.keys((wf as any).nodes || {}).length > 0)
      .slice(0, 6)
      .map(([id, wf]) => ({
        id, name: (wf as any).name || id,
        description: (wf as any).description || '',
        nodeCount: Object.keys((wf as any).nodes || {}).length,
      }))
  }, [data])

  const setInput = (text: string) => {
    const el = document.querySelector<HTMLTextAreaElement>('[data-copilotkit] textarea')
    if (!el) return
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    set?.call(el, text)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.focus()
  }

  return (
    <div className="cpk:h-full cpk:flex cpk:flex-col">
      <div className="cpk:flex-1 cpk:flex cpk:flex-col cpk:items-center cpk:justify-center cpk:px-4">
        <div className="flex flex-col items-center gap-3 text-center max-w-[280px]">
          <FlowAvatar size="lg" />
          <div>
            <p className="text-sm font-semibold">Flow</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Your on-platform agent. I can build workflows, edit nodes, validate, run tools, and follow your .agentflow/ specs.
            </p>
          </div>

          {workflows.length > 0 && (
            <div className="w-full mt-1">
              <p className="text-[9px] text-muted-foreground/60 uppercase tracking-widest font-medium mb-1.5">Workflows</p>
              <div className="grid gap-1">
                {workflows.map(wf => (
                  <button
                    key={wf.id}
                    onClick={() => setInput(`Follow the "${wf.name}" workflow`)}
                    className="group w-full text-left px-2.5 py-1.5 rounded-lg border border-transparent hover:border-border/50 hover:bg-accent/50 transition-all"
                  >
                    <div className="flex items-center gap-1.5">
                      <Workflow size={11} className="text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                      <span className="text-[11px] font-medium truncate flex-1">{wf.name}</span>
                      <span className="text-[9px] text-muted-foreground/50">{wf.nodeCount}N</span>
                    </div>
                    {wf.description && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5 pl-[18px] line-clamp-1">{wf.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="cpk:px-6 cpk:pb-4">
        <div className="cpk:max-w-3xl cpk:mx-auto">
          <div className="cpk:mb-3 cpk:flex cpk:justify-center">{suggestionView}</div>
          {input}
        </div>
      </div>
    </div>
  )
}

export function FlowHeaderExtra() {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-0.5">
        <ModelPicker />
        <Tooltip><TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => emit('agentflow:show-settings')}>
            <Settings size={11} />
          </Button>
        </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Settings</TooltipContent></Tooltip>
      </div>
    </TooltipProvider>
  )
}

export function FlowPanelContent() {
  const [threadId, setThreadId] = useState<string>(() => {
    if (typeof window === 'undefined') return crypto.randomUUID()
    const saved = sessionStorage.getItem('af-flow-thread')
    if (saved) return saved
    const id = crypto.randomUUID()
    sessionStorage.setItem('af-flow-thread', id)
    return id
  })

  return (
    <CopilotChat
      key={threadId}
      threadId={threadId}
      className="h-full"
      welcomeScreen={((props: any) => <FlowWelcomeScreen {...props} />) as any}
      labels={{
        chatInputPlaceholder: 'Ask Flow…',
      } as any}
    />
  )
}

export const FlowIcon = Sparkles
