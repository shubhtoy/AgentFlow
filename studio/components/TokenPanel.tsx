import { useState, useMemo } from 'react'
import { Badge } from './ui/badge'
import { cn } from '@/lib/utils'
import { Calculator, FileText, ChevronDown, ChevronRight, Layers } from 'lucide-react'
import { useAppStore } from '@/store'
import { countTokens } from '@/lib/token-counter'

/* ── Context window presets ──────────────────────────────────────────── */

const CONTEXT_PRESETS = [
  { ctx: 128_000, label: '128k' },
  { ctx: 200_000, label: '200k' },
  { ctx: 1_000_000, label: '1M' },
]

/* ── Helpers ────────────────────────────────────────────────────────── */

const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`

function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const color = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className={cn('h-1.5 rounded-full bg-muted/60 overflow-hidden', className)}>
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ── Types ──────────────────────────────────────────────────────────── */

interface FileTokens { path: string; tokens: number }
interface NodeTokens {
  id: string; name: string; type: string; total: number
  primary: FileTokens | null; context: FileTokens[]
}
interface CategoryTokens { key: string; path: string; tokens: number }

/* ── Hook ──────────────────────────────────────────────────────────── */

function useTokenBreakdown() {
  const data = useAppStore(s => s.data)
  const activeWf = useAppStore(s => s.activeWf)

  return useMemo(() => {
    if (!data || !activeWf) return null
    const wf = data.workflows?.[activeWf]
    if (!wf) return null

    const nodes: NodeTokens[] = []
    for (const [id, node] of Object.entries<any>(wf.nodes || {})) {
      const pt = node.primaryFile ? countTokens(node.primaryFile.rawContent || '') : 0
      const ctx = (node.contextFiles || []).map((f: any) => ({
        path: f.relativePath, tokens: countTokens(f.rawContent || ''),
      }))
      nodes.push({
        id, name: node.name || id, type: node.nodeType || 'step',
        total: pt + ctx.reduce((s: number, c: any) => s + c.tokens, 0),
        primary: node.primaryFile ? { path: node.primaryFile.relativePath, tokens: pt } : null,
        context: ctx,
      })
    }
    nodes.sort((a, b) => b.total - a.total)

    const shared: Record<string, CategoryTokens[]> = {}
    let sharedTotal = 0
    for (const cat of ['instructions', 'capabilities', 'skills', 'memory'] as const) {
      const items: CategoryTokens[] = []
      for (const [key, res] of Object.entries<any>(data[cat] || {})) {
        const t = countTokens(res.rawContent || '')
        items.push({ key, path: res.relativePath, tokens: t })
        sharedTotal += t
      }
      if (items.length) { items.sort((a, b) => b.tokens - a.tokens); shared[cat] = items }
    }

    const workflowTotal = nodes.reduce((s, n) => s + n.total, 0)
    return { nodes, shared, sharedTotal, workflowTotal, total: workflowTotal + sharedTotal, wfName: wf.name || activeWf }
  }, [data, activeWf])
}

/* ── Node row (expandable) ─────────────────────────────────────────── */

function NodeRow({ node, max, onSelect }: { node: NodeTokens; max: number; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const hasFiles = !!(node.primary || node.context.length)
  const typeColor = node.type === 'router' ? 'text-violet-500' : node.type === 'sub-workflow' ? 'text-blue-500' : 'text-emerald-500'

  return (
    <div className="mb-px">
      <button
        onClick={() => hasFiles ? setOpen(!open) : onSelect(node.id)}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left hover:bg-accent/60 rounded-md transition-colors group"
      >
        {hasFiles
          ? open ? <ChevronDown size={11} className="opacity-50" /> : <ChevronRight size={11} className="opacity-50" />
          : <div className="w-[11px]" />}
        <span className={cn('w-1 h-1 rounded-full shrink-0', typeColor)} />
        <span
          className="flex-1 text-xs truncate cursor-pointer hover:underline decoration-muted-foreground/30"
          onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}
        >
          {node.name}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground mr-1">{fmt(node.total)}</span>
        <div className="w-16"><Bar value={node.total} max={max} /></div>
      </button>

      {open && hasFiles && (
        <div className="ml-6 mr-2 mb-1 space-y-px">
          {node.primary && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/40 text-[11px]">
              <FileText size={10} className="opacity-40 shrink-0" />
              <span className="flex-1 font-mono truncate opacity-70">{node.primary.path.split('/').pop()}</span>
              <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">{fmt(node.primary.tokens)}</Badge>
            </div>
          )}
          {node.context.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/30 text-[11px]">
              <FileText size={10} className="opacity-30 shrink-0" />
              <span className="flex-1 font-mono truncate opacity-60">{c.path.split('/').pop()}</span>
              <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">{fmt(c.tokens)}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Shared section (collapsible) ──────────────────────────────────── */

function SharedSection({ shared, sharedTotal }: { shared: Record<string, CategoryTokens[]>; sharedTotal: number }) {
  const [open, setOpen] = useState(false)
  if (!Object.keys(shared).length) return null

  return (
    <div className="border-t">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-3 py-2 hover:bg-accent/40 transition-colors text-left">
        {open ? <ChevronDown size={11} className="opacity-50" /> : <ChevronRight size={11} className="opacity-50" />}
        <Layers size={12} className="opacity-50" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex-1">Shared Resources</span>
        <span className="text-[10px] tabular-nums text-muted-foreground">{fmt(sharedTotal)}</span>
      </button>
      {open && (
        <div className="px-3 pb-2 space-y-2">
          {Object.entries(shared).map(([cat, items]) => (
            <div key={cat}>
              <span className="text-[10px] font-medium text-muted-foreground capitalize">{cat}</span>
              <div className="mt-0.5 space-y-px">
                {items.map(item => (
                  <div key={item.key} className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-muted/40 transition-colors">
                    <FileText size={10} className="opacity-30 shrink-0" />
                    <span className="flex-1 text-[11px] font-mono truncate">{item.key}</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{fmt(item.tokens)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Main panel ────────────────────────────────────────────────────── */

export function TokenPanel() {
  const data = useAppStore(s => s.data)
  const activeWf = useAppStore(s => s.activeWf)
  const select = useAppStore(s => s.select)
  const breakdown = useTokenBreakdown()
  const [contextWindow, setContextWindow] = useState(128_000)

  if (!breakdown) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 gap-2">
        <Calculator size={24} className="opacity-30" />
        <span className="text-xs">No workflow selected</span>
      </div>
    )
  }

  const { nodes, shared, sharedTotal, total, workflowTotal, wfName } = breakdown
  const pct = Math.min((total / contextWindow) * 100, 100)
  const fits = total <= contextWindow
  const maxNode = nodes[0]?.total || 1

  return (
    <div className="flex flex-col h-full">
      {/* Context window */}
      <div className="px-3 py-1.5 border-b flex items-center gap-1">
        {CONTEXT_PRESETS.map(p => (
          <button key={p.ctx} onClick={() => setContextWindow(p.ctx)}
            className={cn('px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
              contextWindow === p.ctx ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted')}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="px-3 py-3 border-b">
        <div className="flex items-baseline justify-between mb-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono">{fmt(total)}</span>
            <span className="text-[10px] text-muted-foreground">tokens</span>
          </div>
          <Badge variant={fits ? 'secondary' : 'destructive'} className={cn('text-[10px] h-5 px-1.5', fits && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20')}>
            {fits ? `${(100 - pct).toFixed(0)}% free` : `${(pct - 100).toFixed(0)}% over`}
          </Badge>
        </div>
        <Bar value={total} max={contextWindow} className="h-2" />
        <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
          <span>Nodes: {fmt(workflowTotal)}</span>
          <span>Shared: {fmt(sharedTotal)}</span>
          <span>Limit: {fmt(contextWindow)}</span>
        </div>
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-auto">
        <div className="px-3 pt-2 pb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nodes</span>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />step</span>
            <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-violet-500" />router</span>
          </div>
        </div>
        <div className="px-1 pb-1">
          {nodes.map(n => (
            <NodeRow key={n.id} node={n} max={maxNode}
              onSelect={(id) => select({ type: 'node', workflowId: activeWf || '', key: id })} />
          ))}
        </div>

        <SharedSection shared={shared} sharedTotal={sharedTotal} />
      </div>
    </div>
  )
}
