'use client'

import { useState, useCallback, useMemo } from 'react'
import { Plus, Trash2, ChevronRight, Code, LayoutList } from 'lucide-react'
import { Input } from './input'
import { Button } from './button'
import { Textarea } from './textarea'
import { Badge } from './badge'
import { cn } from '@/lib/utils'
import jsYaml from 'js-yaml'

/* ── Types ───────────────────────────────────────────────────────────── */

type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue }

interface YamlEditorProps {
  value: string                          // YAML string
  onChange: (yaml: string) => void       // emits YAML string
  className?: string
  placeholder?: string
  maxDepth?: number                      // default 4
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function parse(yaml: string): YamlValue {
  try { return jsYaml.load(yaml) as YamlValue ?? {} } catch { return {} }
}

function serialize(val: YamlValue): string {
  if (val === null || val === undefined) return ''
  try { return jsYaml.dump(val, { lineWidth: 120, noRefs: true, sortKeys: false }).trim() } catch { return String(val) }
}

function typeOf(v: YamlValue): 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' {
  if (v === null || v === undefined) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v as 'object' | 'string' | 'number' | 'boolean'
}

function typeLabel(v: YamlValue): string {
  const t = typeOf(v)
  if (t === 'object') return `{${Object.keys(v as object).length}}`
  if (t === 'array') return `[${(v as YamlValue[]).length}]`
  return t
}

const TYPE_COLORS: Record<string, string> = {
  string: 'text-emerald-500', number: 'text-blue-500', boolean: 'text-amber-500',
  null: 'text-muted-foreground/50', object: 'text-violet-500', array: 'text-cyan-500',
}

/* ── Scalar editor ───────────────────────────────────────────────────── */

function ScalarInput({ value, onChange }: { value: YamlValue; onChange: (v: YamlValue) => void }) {
  const t = typeOf(value)

  if (t === 'boolean') {
    return (
      <button onClick={() => onChange(!value)}
        className={cn('h-7 px-2 rounded-md border text-xs font-mono', value ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' : 'border-amber-500/30 text-amber-500 bg-amber-500/5')}>
        {String(value)}
      </button>
    )
  }

  if (t === 'number') {
    return <Input type="number" value={String(value ?? '')} onChange={e => onChange(Number(e.target.value))} className="h-7 text-xs font-mono w-24" />
  }

  const str = String(value ?? '')
  if (str.length > 60 || str.includes('\n')) {
    return <Textarea value={str} onChange={e => onChange(e.target.value)} className="text-xs font-mono min-h-[56px]" rows={2} />
  }

  return <Input value={str} onChange={e => onChange(e.target.value)} className="h-7 text-xs" placeholder="value" />
}

/* ── Node renderer (recursive) ───────────────────────────────────────── */

function NodeRow({ keyName, value, onChange, onDelete, onRenameKey, depth, maxDepth }: {
  keyName?: string; value: YamlValue; onChange: (v: YamlValue) => void
  onDelete?: () => void; onRenameKey?: (newKey: string) => void
  depth: number; maxDepth: number
}) {
  const [collapsed, setCollapsed] = useState(depth > 1)
  const t = typeOf(value)
  const isContainer = t === 'object' || t === 'array'

  // Too deep — fall back to YAML textarea
  if (depth >= maxDepth && isContainer) {
    return (
      <div className="flex gap-1.5 items-start mb-1">
        {keyName !== undefined && onRenameKey && (
          <Input value={keyName} onChange={e => onRenameKey(e.target.value)} className="h-7 text-xs font-mono w-28 shrink-0" />
        )}
        <Textarea value={serialize(value)} onChange={e => { try { onChange(jsYaml.load(e.target.value) as YamlValue) } catch {} }}
          className="flex-1 text-xs font-mono" rows={3} />
        {onDelete && <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground/50 hover:text-destructive" onClick={onDelete}><Trash2 size={12} /></Button>}
      </div>
    )
  }

  if (!isContainer) {
    return (
      <div className="flex gap-1.5 items-center mb-1">
        {keyName !== undefined && onRenameKey && (
          <Input value={keyName} onChange={e => onRenameKey(e.target.value)} className="h-7 text-xs font-mono w-28 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1"><ScalarInput value={value} onChange={onChange} /></div>
        <span className={cn('text-[9px] shrink-0', TYPE_COLORS[t])}>{t}</span>
        {onDelete && <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground/50 hover:text-destructive" onClick={onDelete}><Trash2 size={12} /></Button>}
      </div>
    )
  }

  // Object or Array
  const entries = t === 'array'
    ? (value as YamlValue[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, YamlValue>)

  return (
    <div className="mb-1">
      <div className="flex items-center gap-1">
        <button onClick={() => setCollapsed(!collapsed)} className="p-0.5 rounded hover:bg-accent/50">
          <ChevronRight size={12} className={cn('text-muted-foreground/60 transition-transform', !collapsed && 'rotate-90')} />
        </button>
        {keyName !== undefined && onRenameKey && (
          <Input value={keyName} onChange={e => onRenameKey(e.target.value)} className="h-7 text-xs font-mono w-28 shrink-0 text-muted-foreground" />
        )}
        <Badge variant="outline" className={cn('text-[9px] px-1 py-0', TYPE_COLORS[t])}>{typeLabel(value)}</Badge>
        {onDelete && <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground/50 hover:text-destructive" onClick={onDelete}><Trash2 size={11} /></Button>}
      </div>
      {!collapsed && (
        <div className="ml-4 pl-2 border-l border-border/40 mt-1 space-y-0.5">
          {entries.map(([k, v]) => (
            <NodeRow
              key={k} keyName={t === 'object' ? k : undefined} value={v} depth={depth + 1} maxDepth={maxDepth}
              onChange={newV => {
                if (t === 'array') {
                  const arr = [...(value as YamlValue[])]; arr[Number(k)] = newV; onChange(arr)
                } else {
                  onChange({ ...(value as Record<string, YamlValue>), [k]: newV })
                }
              }}
              onDelete={() => {
                if (t === 'array') {
                  onChange((value as YamlValue[]).filter((_, i) => i !== Number(k)))
                } else {
                  const next = { ...(value as Record<string, YamlValue>) }; delete next[k]; onChange(next)
                }
              }}
              onRenameKey={t === 'object' ? (newKey) => {
                const obj = value as Record<string, YamlValue>
                const next: Record<string, YamlValue> = {}
                for (const [ok, ov] of Object.entries(obj)) next[ok === k ? newKey : ok] = ov
                onChange(next)
              } : undefined}
            />
          ))}
          <div className="flex gap-1 pt-1">
            <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-muted-foreground"
              onClick={() => {
                if (t === 'array') onChange([...(value as YamlValue[]), ''])
                else onChange({ ...(value as Record<string, YamlValue>), '': '' })
              }}><Plus size={11} /> {t === 'array' ? 'Item' : 'Key'}</Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────────────── */

export function YamlEditor({ value, onChange, className, placeholder, maxDepth = 4 }: YamlEditorProps) {
  const [mode, setMode] = useState<'visual' | 'raw'>('visual')
  const [rawDraft, setRawDraft] = useState('')

  const parsed = useMemo(() => parse(value), [value])

  const switchToRaw = useCallback(() => {
    setRawDraft(value || '')
    setMode('raw')
  }, [value])

  const switchToVisual = useCallback(() => {
    try { jsYaml.load(rawDraft); onChange(rawDraft); setMode('visual') }
    catch { /* stay in raw mode if invalid */ }
  }, [rawDraft, onChange])

  return (
    <div className={cn('rounded-md border border-border/50 overflow-hidden', className)}>
      {/* Mode toggle */}
      <div className="flex items-center justify-between px-2 py-1 bg-muted/30 border-b border-border/30">
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
          {mode === 'visual' ? 'Visual' : 'YAML'}
        </span>
        <button onClick={mode === 'visual' ? switchToRaw : switchToVisual}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-accent/50">
          {mode === 'visual' ? <><Code size={10} /> Raw</> : <><LayoutList size={10} /> Visual</>}
        </button>
      </div>

      {mode === 'raw' ? (
        <Textarea
          value={rawDraft}
          onChange={e => setRawDraft(e.target.value)}
          onBlur={() => { try { jsYaml.load(rawDraft); onChange(rawDraft) } catch {} }}
          placeholder={placeholder || 'key: value'}
          className="border-0 rounded-none font-mono text-xs min-h-[100px] focus-visible:ring-0"
        />
      ) : (
        <div className="p-2 max-h-[300px] overflow-y-auto">
          {typeOf(parsed) === 'object' && Object.keys(parsed as object).length === 0 && (
            <p className="text-xs text-muted-foreground/50 italic py-2 text-center">{placeholder || 'Empty — add a key below'}</p>
          )}
          <NodeRow value={parsed} onChange={v => onChange(serialize(v))} depth={0} maxDepth={maxDepth} />
        </div>
      )}
    </div>
  )
}
