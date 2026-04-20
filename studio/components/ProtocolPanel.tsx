'use client'

// ---------------------------------------------------------------------------
// ProtocolPanel — Protocol adapter management (view, toggle, health)
// Data comes entirely from GET /api/protocols — no static duplication.
// MCP is excluded (it has its own dedicated MCPPanel).
// ---------------------------------------------------------------------------
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import {
  Network, ChevronRight, Wrench,
  Puzzle, ArrowUpRight,
  Webhook, Plus, Trash2,
} from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { emit } from '../utils/events'
import { FeatureHint } from './onboarding/FeatureHint'

// ── Hook types ──

interface HookDef {
  name: string
  version?: string
  description?: string
  event: string
  condition?: { field: string; operator: string; value: string }
  action: { type: string; target: string; params?: Record<string, unknown> }
  enabled: boolean
  priority?: number
}

// ── HookCard ──

function HookCard({ hook, onToggle, onDelete, onEdit }: {
  hook: HookDef
  onToggle: (name: string, enabled: boolean) => void
  onDelete: (name: string) => void
  onEdit: (hook: HookDef) => void
}) {
  return (
    <div
      onClick={() => onEdit(hook)}
      className={`rounded-lg border overflow-hidden transition-all cursor-pointer hover:ring-1 hover:ring-ring/30 ${!hook.enabled ? 'opacity-60 bg-muted/20' : 'bg-card'}`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <div className={`w-2 h-2 rounded-full shrink-0 ${hook.enabled ? 'bg-green-500' : 'bg-zinc-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[0.8125rem] font-semibold truncate">{hook.name}</span>
            <Badge variant="outline" className="h-[16px] text-[0.55rem] px-1 border bg-amber-500/15 text-amber-600 border-amber-500/30">
              {hook.event}
            </Badge>
          </div>
          <p className="text-[0.65rem] text-muted-foreground truncate">
            {hook.condition ? `${hook.condition.field} ${hook.condition.operator} ${hook.condition.value}` : hook.action.type}
            {' → '}{hook.action.target || 'none'}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={hook.enabled} onChange={e => onToggle(hook.name, e.target.checked)} className="sr-only peer" />
          <div className="w-8 h-4 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4" />
        </label>
        <button onClick={() => onDelete(hook.name)} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── HookForm ──

function HookForm({ eventTypes, onSave, onCancel, initial }: {
  eventTypes: string[]
  onSave: (hook: Partial<HookDef>) => void
  onCancel: () => void
  initial?: HookDef | null
}) {
  const [name, setName] = useState(initial?.name || '')
  const [event, setEvent] = useState(initial?.event || eventTypes[0] || 'fileEdited')
  const [actionType, setActionType] = useState(initial?.action?.type || 'trigger-workflow')
  const [target, setTarget] = useState(initial?.action?.target || '')
  const [condField, setCondField] = useState(initial?.condition?.field || '')
  const [condOp, setCondOp] = useState(initial?.condition?.operator || 'matches')
  const [condVal, setCondVal] = useState(initial?.condition?.value || '')
  const [priority, setPriority] = useState(initial?.priority ?? 100)
  const isEdit = !!initial

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Hook name" disabled={isEdit}
        className={`w-full text-xs bg-background border rounded px-2 py-1.5 ${isEdit ? 'opacity-60' : ''}`} />
      <div className="flex gap-2">
        <select value={event} onChange={e => setEvent(e.target.value)}
          className="flex-1 text-xs bg-background border rounded px-2 py-1.5">
          {eventTypes.map(et => <option key={et} value={et}>{et}</option>)}
        </select>
        <select value={actionType} onChange={e => setActionType(e.target.value)}
          className="flex-1 text-xs bg-background border rounded px-2 py-1.5">
          <option value="trigger-workflow">trigger-workflow</option>
          <option value="run-script">run-script</option>
          <option value="log">log</option>
          <option value="notify">notify</option>
        </select>
      </div>
      <input value={target} onChange={e => setTarget(e.target.value)} placeholder="Action target"
        className="w-full text-xs bg-background border rounded px-2 py-1.5" />
      <details className="text-xs">
        <summary className="text-muted-foreground cursor-pointer py-1">Condition & priority</summary>
        <div className="space-y-2 pt-1">
          <div className="flex gap-2">
            <input value={condField} onChange={e => setCondField(e.target.value)} placeholder="Field (e.g. path)"
              className="flex-1 text-xs bg-background border rounded px-2 py-1.5" />
            <select value={condOp} onChange={e => setCondOp(e.target.value)}
              className="text-xs bg-background border rounded px-2 py-1.5">
              {['equals','contains','matches','startsWith','endsWith'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <input value={condVal} onChange={e => setCondVal(e.target.value)} placeholder="Value (e.g. \\.ts$)"
            className="w-full text-xs bg-background border rounded px-2 py-1.5" />
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Priority:</span>
            <input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))} min={0} max={1000}
              className="w-20 text-xs bg-background border rounded px-2 py-1.5" />
          </div>
        </div>
      </details>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="h-7 text-xs" disabled={!name.trim()}
          onClick={() => onSave({
            name, event,
            action: { type: actionType, target },
            ...(condField && condVal ? { condition: { field: condField, operator: condOp, value: condVal } } : {}),
            enabled: initial?.enabled ?? true,
            priority,
          })}>
          {isEdit ? 'Update' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

// ── HooksSection ──

function HooksSection() {
  const [hooks, setHooks] = useState<HookDef[]>([])
  const [eventTypes, setEventTypes] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<HookDef | null>(null)
  const [open, setOpen] = useState(true)

  const fetchHooks = useCallback(async () => {
    try {
      const [hRes, eRes] = await Promise.all([
        api.getHooks(),
        api.getEventTypes(),
      ])
      setHooks(hRes.hooks || [])
      setEventTypes(eRes.eventTypes || [])
    } catch {}
  }, [])

  useEffect(() => { fetchHooks() }, [fetchHooks])

  const handleToggle = useCallback(async (name: string, enabled: boolean) => {
    await api.updateHook(name, { enabled })
    fetchHooks()
  }, [fetchHooks])

  const handleDelete = useCallback(async (name: string) => {
    await api.deleteHook(name)
    fetchHooks()
  }, [fetchHooks])

  const handleSave = useCallback(async (hook: Partial<HookDef>) => {
    if (editing) {
      await api.updateHook(editing.name, hook)
      setEditing(null)
    } else {
      await api.saveHook(hook)
      setAdding(false)
    }
    fetchHooks()
  }, [fetchHooks, editing])

  const handleEdit = useCallback((hook: HookDef) => {
    setEditing(hook)
    setAdding(false)
    setOpen(true)
  }, [])

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 w-full px-3 py-1.5 hover:bg-accent/50 transition-colors text-left group"
      >
        <ChevronRight size={12} className={`text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
        <Webhook size={13} className="text-amber-500" />
        <span className="text-[0.75rem] font-semibold flex-1">Event Hooks</span>
        <span className="text-[0.6rem] text-muted-foreground">{hooks.filter(h => h.enabled).length}/{hooks.length}</span>
        <span onClick={e => { e.stopPropagation(); setAdding(true); setEditing(null); setOpen(true) }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground ml-1">
          <Plus size={14} />
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 px-3 pb-2">
          {hooks.map(h =>
            editing?.name === h.name
              ? <HookForm key={`edit-${h.name}`} eventTypes={eventTypes} onSave={handleSave} onCancel={() => setEditing(null)} initial={h} />
              : <HookCard key={h.name} hook={h} onToggle={handleToggle} onDelete={handleDelete} onEdit={handleEdit} />
          )}
          {hooks.length === 0 && !adding && !editing && (
            <p className="text-[0.65rem] text-muted-foreground text-center py-3">No hooks configured</p>
          )}
          {adding && <HookForm eventTypes={eventTypes} onSave={handleSave} onCancel={() => setAdding(false)} />}
        </div>
      )}
    </div>
  )
}

// ── Main Panel ──

export function ProtocolPanel() {
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="relative px-3 py-2 flex items-center justify-between border-b border-border">
        <FeatureHint id="protocols" text="Event hooks and MCP tool servers. More protocols coming soon." show side="bottom" />
        <div className="flex items-center gap-1.5">
          <Puzzle size={15} className="text-primary" />
          <span className="text-[0.8125rem] font-semibold">Protocols</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto py-1">
        {/* MCP link */}
        <div
          onClick={() => emit('agentflow:show-mcp')}
          className="mx-3 mb-2 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-accent/50 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <Wrench size={13} className="text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[0.8125rem] font-semibold">MCP Servers</span>
                <Badge variant="outline" className="h-[16px] text-[0.55rem] px-1 border bg-green-500/15 text-green-600 border-green-500/30">Stable</Badge>
              </div>
              <p className="text-[0.65rem] text-muted-foreground">Connect tools via Model Context Protocol</p>
            </div>
            <ArrowUpRight size={14} className="text-muted-foreground" />
          </div>
        </div>

        <Separator className="my-1" />

        {/* Hooks */}
        <HooksSection />

        <Separator className="my-1" />

        {/* Coming soon */}
        <div className="px-3 py-4 text-center space-y-1.5">
          <Network size={20} className="mx-auto text-muted-foreground/40" />
          <p className="text-[0.7rem] text-muted-foreground">
            Agent-to-Agent (A2A), Agent-to-User (AG-UI), and more protocols will be added as export targets adopt them.
          </p>
        </div>
      </div>
    </div>
  )
}
