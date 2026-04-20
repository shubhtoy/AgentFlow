import { useMemo, useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { emit } from '@/utils/events'
import { countTokens } from '@/lib/token-counter'
import {
  AlertCircle, AlertTriangle, CheckCircle2,
  Cloud, HardDrive, Globe, GitBranch,
} from 'lucide-react'
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '../ui/tooltip'

function Seg({ children, onClick, tip, className = '' }: {
  children: React.ReactNode; onClick?: () => void; tip?: string; className?: string
}) {
  const inner = (
    <button onClick={onClick} disabled={!onClick}
      className={`flex items-center gap-1 px-2 h-full rounded-sm transition-colors ${
        onClick ? 'hover:bg-muted/40 hover:text-foreground/80 cursor-pointer' : 'cursor-default'
      } ${className}`}>
      {children}
    </button>
  )
  if (!tip) return inner
  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="top" className="text-xs">{tip}</TooltipContent>
    </Tooltip>
  )
}

/* ── Inline token usage bar ── */
function TokenIndicator({ workflowId }: { workflowId: string }) {
  const data = useAppStore(s => s.data)

  const tokens = useMemo(() => {
    if (!data || !workflowId) return null
    const wf = data.workflows?.[workflowId]
    if (!wf) return null
    let total = 0
    for (const node of Object.values<any>(wf.nodes || {})) {
      if (node.primaryFile?.rawContent) total += countTokens(node.primaryFile.rawContent)
      for (const cf of node.contextFiles || []) {
        if (cf.rawContent) total += countTokens(cf.rawContent)
      }
    }
    for (const cat of ['instructions', 'capabilities', 'runbooks', 'memory'] as const) {
      for (const res of Object.values<any>(data[cat] || {})) {
        if (res.rawContent) total += countTokens(res.rawContent)
      }
    }
    return total
  }, [data, workflowId])

  const contextWindow = 128_000

  if (tokens === null) return null

  const pct = Math.min((tokens / contextWindow) * 100, 100)
  const color = pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-amber-400' : 'bg-primary/60'
  const fmt = tokens > 999 ? `${(tokens / 1000).toFixed(1)}k` : `${tokens}`

  return (
    <Seg tip={`~${tokens.toLocaleString()} tokens (${pct.toFixed(0)}% of 128k context) — click for details`} onClick={() => window.dispatchEvent(new CustomEvent('agentflow:show-token-calc'))}>
      <div className="flex items-center gap-1.5">
        <div className="w-12 h-1.5 rounded-full bg-muted/60 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs tabular-nums">{fmt}</span>
      </div>
    </Seg>
  )
}

export function StatusBar() {
  const data = useAppStore(s => s.data)
  const activeWf = useAppStore(s => s.activeWf)
  const validationResult = useAppStore(s => s.validationResult)
  const validate = useAppStore(s => s.validate)
  const saveStatus = useAppStore(s => s.saveStatus)
  const [wsType, setWsType] = useState<string>('local')

  useEffect(() => {
    import('@/lib/workspace').then(({ getWorkspace }) => {
      setWsType(getWorkspace()?.type || 'local')
    }).catch(() => {})
  }, [data])

  const wf = data?.workflows[activeWf]
  const wfName = wf?.name || activeWf || '—'
  const nodeCount = wf ? Object.keys(wf.nodes).length : 0
  const edgeCount = wf?.edges.length ?? 0
  const workflowCount = data ? Object.keys(data.workflows).length : 0
  const errorCount = validationResult?.errors?.length ?? 0
  const warningCount = validationResult?.warnings?.length ?? 0

  useEffect(() => { if (data) validate() }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const WsIcon = wsType === 'browser' ? Globe : wsType === 'git' ? Cloud : HardDrive
  const wsLabel = wsType === 'browser' ? 'Browser' : wsType === 'git' ? 'Git' : 'Local'

  return (
    <TooltipProvider delayDuration={300}>
      <footer data-tour="statusbar" className="h-8 flex items-center border-t border-border/30 text-xs text-muted-foreground/70 shrink-0 z-50 select-none
        bg-background/80 backdrop-blur-xl backdrop-saturate-150
        shadow-[0_-1px_0_rgba(0,0,0,0.02),0_-1px_3px_rgba(0,0,0,0.03)]
        dark:shadow-[0_-1px_0_rgba(255,255,255,0.02),0_-1px_3px_rgba(0,0,0,0.15)]">

        <Seg tip={`Workspace: ${wsLabel}`}>
          <WsIcon size={11} className="opacity-60" />
          <span>{wsLabel}</span>
          {saveStatus === 'dirty' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5" />}
          {saveStatus === 'saving' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse ml-0.5" />}
          {saveStatus === 'saved' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 ml-0.5" />}
        </Seg>

        <Seg tip={`${workflowCount} workflow${workflowCount !== 1 ? 's' : ''}`}>
          <GitBranch size={11} className="opacity-50" />
          <span className="text-foreground/60 font-medium">{wfName}</span>
        </Seg>

        {wf && (
          <Seg tip={`${nodeCount} nodes, ${edgeCount} edges`}>
            <span>{nodeCount}N · {edgeCount}E</span>
          </Seg>
        )}

        <div className="flex-1" />

        {activeWf && <TokenIndicator workflowId={activeWf} />}

        <Seg onClick={() => emit('agentflow:show-validation')} tip="Open validation panel">
          {errorCount > 0 ? (
            <span className="flex items-center gap-1 text-red-400"><AlertCircle size={13} />{errorCount} error{errorCount > 1 ? 's' : ''}</span>
          ) : warningCount > 0 ? (
            <span className="flex items-center gap-1 text-amber-400"><AlertTriangle size={13} />{warningCount} warning{warningCount > 1 ? 's' : ''}</span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-500/60"><CheckCircle2 size={13} />No issues</span>
          )}
        </Seg>
      </footer>
    </TooltipProvider>
  )
}
