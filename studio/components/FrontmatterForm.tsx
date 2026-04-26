'use client'

import { useState, useCallback, useMemo, useEffect, useRef, lazy, Suspense } from 'react'
import { Plus, Trash2, FilePlus, Save, Sparkles, Code, LayoutList } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { Checkbox } from './ui/checkbox'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import type { ParsedFile } from '@/lib/types'
import { FIELD_HINTS } from '@/lib/constants'
import { registerAgentFlowTheme } from '@/lib/monaco-theme'
import { YamlEditor } from './ui/yaml-editor'
import { Spinner } from './ui/spinner'
import jsYaml from 'js-yaml'

const MonacoEditor = lazy(() => import('@monaco-editor/react').then(m => ({ default: m.default })))

function InlineYamlEditor({ value, onChange, className }: { value: string; onChange: (yaml: string) => void; className?: string }) {
  const resolvedTheme = useAppStore(s => s.resolvedTheme)
  const lines = Math.min(20, Math.max(5, value.split('\n').length + 2))
  return (
    <div className={className} style={{ height: lines * 20 }}>
      <Suspense fallback={<div className="flex items-center justify-center h-full"><Spinner /></div>}>
        <MonacoEditor
          height="100%"
          language="yaml"
          value={value}
          theme={resolvedTheme === 'dark' ? 'agentflow-dark' : 'agentflow-light'}
          onChange={v => { if (v !== undefined) onChange(v) }}
          beforeMount={registerAgentFlowTheme}
          options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: 'off', scrollBeyondLastLine: false, wordWrap: 'on', tabSize: 2, automaticLayout: true, padding: { top: 4 }, folding: false, renderLineHighlight: 'none', overviewRulerLanes: 0, scrollbar: { vertical: 'hidden' }, fixedOverflowWidgets: true }}
        />
      </Suspense>
    </div>
  )
}

export interface FrontmatterFieldDef {
  key: string; label: string
  type: 'text' | 'textarea' | 'select' | 'boolean' | 'taglist' | 'keyvalue' | 'group' | 'workflow-picker'
  required?: boolean; options?: string[]
  conditional?: { field: string; value: string }
  children?: FrontmatterFieldDef[]; hintKey?: string
  section?: string
}

// Schema derived from single source of truth: src/schemas/frontmatter-schemas.js
const { getFormSchema } = require('@agentflow/core/schemas/frontmatter-schemas')

function buildFormSchemas(): Record<string, FrontmatterFieldDef[]> {
  const schemas: Record<string, FrontmatterFieldDef[]> = {}
  for (const type of ['agents', 'node', 'capability', 'instruction', 'skill', 'memory']) {
    schemas[type] = getFormSchema(type) as FrontmatterFieldDef[]
  }
  schemas.step = schemas.node
  schemas.router = schemas.node
  schemas['sub-workflow'] = schemas.node
  schemas.untyped = [
    { key: 'name', label: 'Name', type: 'text', section: 'Identity' },
    { key: 'description', label: 'Description', type: 'textarea', section: 'Identity' },
    { key: 'type', label: 'Type', type: 'select', options: ['instruction', 'capability', 'skill', 'memory', 'none'], section: 'Identity' },
  ]
  return schemas
}

export const FRONTMATTER_SCHEMAS = buildFormSchemas()

function isComplex(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (Array.isArray(v)) return v.some(item => typeof item === 'object' && item !== null)
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).some(val => typeof val === 'object' && val !== null)
  return false
}

function safeString(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try { return jsYaml.dump(v, { flowLevel: 2, lineWidth: 80 }).trim() } catch { return String(v) }
}

function serialize(v: unknown): string {
  if (v === null || v === undefined) return ''
  try { return jsYaml.dump(v, { lineWidth: 120, noRefs: true }).trim() } catch { return String(v) }
}

function coerceTaglist(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(item => {
    if (typeof item === 'string') return item
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>
      if (obj.name && typeof obj.name === 'string') return obj.name
      if (obj.ref && typeof obj.ref === 'string') return obj.ref
      return safeString(item)
    }
    return String(item)
  })
}

function getSchemaForType(resourceType: string | null | undefined): FrontmatterFieldDef[] {
  if (!resourceType) return FRONTMATTER_SCHEMAS.untyped
  if (resourceType === 'agents') return FRONTMATTER_SCHEMAS.agents
  if (['step', 'router', 'sub-workflow'].includes(resourceType)) return FRONTMATTER_SCHEMAS[resourceType] ?? FRONTMATTER_SCHEMAS.step
  if (['builtin', 'script', 'mcp', 'package'].includes(resourceType)) return FRONTMATTER_SCHEMAS.capability
  return FRONTMATTER_SCHEMAS[resourceType] ?? FRONTMATTER_SCHEMAS.untyped
}

function serializeFrontmatter(values: Record<string, unknown>): string {
  try {
    const yaml = jsYaml.dump(values, { lineWidth: 120, noRefs: true, sortKeys: false })
    return `---\n${yaml}---\n`
  } catch {
    const lines: string[] = ['---']
    for (const [k, v] of Object.entries(values)) {
      if (v === undefined || v === null || v === '') continue
      if (typeof v === 'boolean') lines.push(`${k}: ${v}`)
      else if (Array.isArray(v)) { if (v.length === 0) continue; lines.push(`${k}:`); for (const item of v) lines.push(`  - ${typeof item === 'object' ? jsYaml.dump(item).trim() : item}`) }
      else if (typeof v === 'object') { lines.push(`${k}:`); for (const [sk, sv] of Object.entries(v as Record<string, unknown>)) { if (sv !== undefined && sv !== null && sv !== '') lines.push(`  ${sk}: ${sv}`) } }
      else lines.push(`${k}: ${v}`)
    }
    lines.push('---')
    return lines.join('\n') + '\n'
  }
}

/* ── Section header ──────────────────────────────────────────────────── */

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2.5 pt-3 pb-2 first:pt-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-primary/70">{title}</span>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  )
}

/* ── Tag input ───────────────────────────────────────────────────────── */

function TagInput({ label, value, onChange, suggestions, helperText }: {
  label: string; value: string[]; onChange: (v: string[]) => void; suggestions?: string[]; helperText?: string
}) {
  const [input, setInput] = useState('')
  const handleAdd = (tag?: string) => {
    const trimmed = (tag ?? input).trim()
    if (trimmed && !value.includes(trimmed)) { onChange([...value, trimmed]); setInput('') }
  }
  const available = suggestions?.filter(s => !value.includes(s)) ?? []
  return (
    <div>
      <span className="text-xs text-muted-foreground mb-1 block">{label}</span>
      {helperText && <span className="text-[11px] text-muted-foreground/60 mb-1.5 block">{helperText}</span>}
      <div className="flex flex-wrap gap-1 mb-2">
        {value.map(tag => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button onClick={() => onChange(value.filter(t => t !== tag))} className="ml-0.5 hover:text-destructive">×</button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }} placeholder={`Add ${label.toLowerCase()}…`} className="h-8 text-sm" />
        <Button size="sm" variant="outline" onClick={() => handleAdd()} disabled={!input.trim()}>Add</Button>
      </div>
      {available.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          <span className="text-[10px] text-muted-foreground/60 mr-1 self-center">Suggestions:</span>
          {available.slice(0, 8).map(s => (
            <Badge key={s} variant="outline" className="text-[11px] cursor-pointer opacity-70 hover:opacity-100" onClick={() => handleAdd(s)}>{s}</Badge>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Key-value editor ────────────────────────────────────────────────── */

function KeyValueEditor({ label, value, onChange }: { label: string; value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const entries = Object.entries(value)
  return (
    <div>
      <span className="text-xs text-muted-foreground mb-1 block">{label}</span>
      <div className="space-y-2">
        {entries.map(([k, v], i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input value={k} onChange={e => { const next: Record<string, string> = {}; for (const [ok, ov] of entries) next[ok === k ? e.target.value : ok] = ov; onChange(next) }} placeholder="Key" className="h-8 text-sm flex-1" />
            <Input value={v} onChange={e => onChange({ ...value, [k]: e.target.value })} placeholder="Value" className="h-8 text-sm flex-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { const next = { ...value }; delete next[k]; onChange(next) }}><Trash2 size={14} /></Button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="ghost" className="mt-2 gap-1" onClick={() => onChange({ ...value, '': '' })}><Plus size={14} /> Add Entry</Button>
    </div>
  )
}

/* ── Custom field name prompt ────────────────────────────────────────── */

let _customFieldCounter = 0
function nextCustomFieldName(): string {
  _customFieldCounter++
  const names = ['param', 'config', 'option', 'setting', 'attr', 'prop', 'meta', 'flag']
  return `${names[_customFieldCounter % names.length]}_${_customFieldCounter}`
}

/* ── Main form ───────────────────────────────────────────────────────── */

interface FrontmatterFormProps { file: ParsedFile; onSave: (yamlBlock: string) => void }

export function FrontmatterForm({ file, onSave }: FrontmatterFormProps) {
  const data = useAppStore(s => s.data)
  const fm = file.frontmatter ?? {}
  const detectedType = (fm.type as string) ?? file.resourceType ?? null
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...fm }))
  const [dirty, setDirty] = useState(false)
  const [viewMode, setViewMode] = useState<'form' | 'yaml'>('form')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setValues({ ...(file.frontmatter ?? {}) }); setDirty(false) }, [file.filePath, file.frontmatter])

  const currentType = (values.type as string) ?? detectedType
  const schema = useMemo(() => getSchemaForType(currentType), [currentType])
  const builtinKeys = useMemo(() => new Set(schema.map(f => f.key)), [schema])

  const customFields = useMemo(() => {
    const custom: Record<string, string> = {}
    for (const [k, v] of Object.entries(values)) { if (!builtinKeys.has(k)) custom[k] = safeString(v) }
    return custom
  }, [values, builtinKeys])

  const buildMerged = useCallback(() => {
    const merged: Record<string, unknown> = {}
    for (const field of schema) {
      if (field.type === 'group' && field.children) {
        const group: Record<string, unknown> = {}
        for (const child of field.children) { const v = (values[field.key] as Record<string, unknown>)?.[child.key]; if (v !== undefined && v !== '') group[child.key] = v }
        if (Object.keys(group).length > 0) merged[field.key] = group
      } else { const v = values[field.key]; if (v !== undefined) merged[field.key] = v }
    }
    for (const [k, v] of Object.entries(customFields).sort(([a], [b]) => a.localeCompare(b))) { if (k) merged[k] = v }
    return merged
  }, [schema, values, customFields])

  const setValue = useCallback((key: string, val: unknown) => {
    setValues(prev => ({ ...prev, [key]: val }))
    setDirty(true)
  }, [])

  // Auto-save with 1.5s debounce (when enabled)
  const autoSave = useAppStore(s => s.autoSave)
  useEffect(() => {
    if (!dirty || !autoSave) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const merged = buildMerged()
      onSave(serializeFrontmatter(merged))
      setDirty(false)
    }, 500)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [dirty, values, buildMerged, onSave, autoSave])

  const handleSaveNow = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    const merged = buildMerged()
    onSave(serializeFrontmatter(merged))
    setDirty(false)
  }, [buildMerged, onSave])

  const hasFrontmatter = file.rawContent.trimStart().startsWith('---')

  if (!hasFrontmatter) {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center">
          <Sparkles size={20} className="text-primary/40" />
        </div>
        <p className="text-sm font-medium mb-1">No properties defined</p>
        <p className="text-xs text-muted-foreground/60 mb-5 max-w-[220px] leading-relaxed">
          Properties control how this resource behaves. Initialize to get started.
        </p>
        <Button variant="outline" size="sm" onClick={() => onSave('---\n---\n')} className="gap-1.5 h-8">
          <FilePlus size={13} /> Initialize Properties
        </Button>
      </div>
    )
  }

  const isFieldVisible = (field: FrontmatterFieldDef): boolean => {
    if (!field.conditional) return true
    return String(values[field.conditional.field] ?? '') === field.conditional.value
  }

  // Group fields by section
  const sections = useMemo(() => {
    const map = new Map<string, FrontmatterFieldDef[]>()
    for (const field of schema) {
      const sec = field.section ?? 'General'
      if (!map.has(sec)) map.set(sec, [])
      map.get(sec)!.push(field)
    }
    return map
  }, [schema])

  const renderField = (field: FrontmatterFieldDef) => {
    if (!isFieldVisible(field)) return null
    const hint = FIELD_HINTS[field.hintKey ?? field.key]

    if (field.type === 'group' && field.children) {
      const groupVal = (values[field.key] as Record<string, unknown>) ?? {}
      return (
        <div key={field.key} className="mb-4">
          <Label className="text-xs font-medium">{field.label}</Label>
          {hint && <p className="text-[11px] text-muted-foreground/60 mb-2">{hint.description}</p>}
          <div className="space-y-3 pl-3 border-l-2 border-primary/20 ml-1 mt-1.5">
            {field.children.map(child => {
              const childHint = FIELD_HINTS[child.hintKey ?? child.key]
              const childVal = groupVal[child.key]
              const isNestedArr = Array.isArray(childVal)
              const isNestedObj = !isNestedArr && typeof childVal === 'object' && childVal !== null

              // Array of objects (e.g. context.inputs: [{ref, scope}]) — render as structured list
              if (isNestedArr && childVal.some((item: unknown) => typeof item === 'object')) {
                const items = childVal as Record<string, unknown>[]
                return (
                  <div key={child.key}>
                    <Label className="text-xs">{child.label}</Label>
                    {childHint && <p className="text-[10px] text-muted-foreground/60 mb-1.5">{childHint.description}</p>}
                    <div className="space-y-1.5">
                      {items.map((item, i) => (
                        <div key={i} className="flex items-center gap-1.5 p-1.5 rounded-md bg-muted/30 border border-border/30">
                          <div className="flex-1 flex items-center gap-1.5 min-w-0">
                            {Object.entries(item).map(([ik, iv]) => (
                              <span key={ik} className="inline-flex items-center gap-0.5 text-[11px]">
                                <span className="text-muted-foreground/60">{ik}:</span>
                                <Input
                                  value={String(iv ?? '')}
                                  onChange={e => {
                                    const next = [...items]
                                    next[i] = { ...next[i], [ik]: e.target.value }
                                    setValue(field.key, { ...groupVal, [child.key]: next })
                                  }}
                                  className="h-6 text-[11px] px-1.5 w-auto min-w-[80px] flex-1"
                                />
                              </span>
                            ))}
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground/50 hover:text-destructive"
                            onClick={() => {
                              const next = items.filter((_, j) => j !== i)
                              setValue(field.key, { ...groupVal, [child.key]: next })
                            }}><Trash2 size={11} /></Button>
                        </div>
                      ))}
                    </div>
                    <Button size="sm" variant="ghost" className="mt-1.5 gap-1 text-[11px] text-muted-foreground h-7"
                      onClick={() => {
                        const template = items.length > 0
                          ? Object.fromEntries(Object.keys(items[0]).map(k => [k, '']))
                          : { ref: '', scope: 'full' }
                        setValue(field.key, { ...groupVal, [child.key]: [...items, template] })
                      }}><Plus size={12} /> Add</Button>
                  </div>
                )
              }

              return (
                <div key={child.key}>
                  <Label className="text-xs">{child.label}</Label>
                  {child.type === 'textarea' || isNestedObj ? (
                    <Textarea
                      value={isNestedObj ? jsYaml.dump(childVal, { flowLevel: 3, lineWidth: 80 }).trim() : String(childVal ?? '')}
                      onChange={e => {
                        let parsed: unknown = e.target.value
                        try { parsed = jsYaml.load(e.target.value) } catch {}
                        setValue(field.key, { ...groupVal, [child.key]: parsed })
                      }}
                      placeholder={childHint?.placeholder}
                      className="font-mono text-xs mt-1"
                      rows={isNestedObj ? Math.min(8, String(jsYaml.dump(childVal)).split('\n').length + 1) : 2}
                    />
                  ) : isNestedArr ? (
                    <TagInput
                      label=""
                      value={childVal.map(String)}
                      onChange={v => setValue(field.key, { ...groupVal, [child.key]: v })}
                    />
                  ) : (
                    <Input
                      value={String(childVal ?? '')}
                      onChange={e => setValue(field.key, { ...groupVal, [child.key]: e.target.value })}
                      placeholder={childHint?.placeholder}
                      className="h-8 text-sm mt-1"
                    />
                  )}
                  {childHint && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{childHint.description}</p>}
                </div>
              )
            })}
          </div>
          {field.key === 'narrativeTemplate' && (
            <p className="mt-2 p-2 bg-accent/50 rounded-md text-sm italic border border-border/30">
              {String(groupVal.prefix ?? '')} {'{{category/name}}'} {String(groupVal.suffix ?? '')}
            </p>
          )}
        </div>
      )
    }

    if (field.type === 'select') {
      return (
        <div key={field.key} className="mb-4">
          <Label className="text-xs">{field.label}</Label>
          <select value={String(values[field.key] ?? '')} onChange={e => setValue(field.key, e.target.value)}
            className="mt-1 h-8 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 appearance-none cursor-pointer">
            <option value="">Select…</option>
            {(field.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          {hint && <p className="text-[10px] text-muted-foreground/60 mt-0.5 ml-1">{hint.description}</p>}
        </div>
      )
    }

    if (field.type === 'workflow-picker') {
      const workflows = data ? Object.entries(data.workflows) : []
      return (
        <div key={field.key} className="mb-4">
          <Label className="text-xs">{field.label}</Label>
          <select value={String(values[field.key] ?? '')} onChange={e => setValue(field.key, e.target.value)}
            className="mt-1 h-8 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 appearance-none cursor-pointer">
            <option value="">Select a workflow…</option>
            {workflows.map(([id, wf]) => <option key={id} value={id}>{(wf as any).name || id}</option>)}
          </select>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5 ml-1">Double-click this node on canvas to navigate into the linked workflow.</p>
        </div>
      )
    }

    if (field.type === 'boolean') {
      return (
        <div key={field.key} className="mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={Boolean(values[field.key])} onCheckedChange={v => setValue(field.key, v)} />
            <span className="text-sm">{field.label}</span>
          </label>
          {hint && <p className="text-[10px] text-muted-foreground/60 ml-6 -mt-0.5">{hint.description}</p>}
        </div>
      )
    }

    if ((field.type as string) === 'object-list' && field.children) {
      const items = (Array.isArray(values[field.key]) ? values[field.key] : []) as Record<string, unknown>[]
      return (
        <div key={field.key} className="mb-4">
          <Label className="text-xs">{field.label}</Label>
          {hint && <p className="text-[11px] text-muted-foreground/60 mb-1.5">{hint.description}</p>}
          <div className="space-y-1.5">
            {items.map((item, i) => (
              <div key={i} className="flex items-start gap-1.5 p-2 rounded-md bg-muted/30 border border-border/30">
                <div className="flex-1 space-y-1.5">
                  {field.children!.map(child => (
                    <div key={child.key} className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground/60 w-16 shrink-0">{child.label}</span>
                      <Input value={String(item[child.key] ?? '')}
                        onChange={e => { const next = [...items]; next[i] = { ...next[i], [child.key]: e.target.value }; setValue(field.key, next) }}
                        className="h-6 text-[11px] px-1.5 flex-1" />
                    </div>
                  ))}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 mt-0.5"
                  onClick={() => setValue(field.key, items.filter((_, j) => j !== i))}><Trash2 size={11} /></Button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="mt-1.5 gap-1 text-[11px] text-muted-foreground h-7"
            onClick={() => {
              const template = Object.fromEntries(field.children!.map(c => [c.key, '']))
              setValue(field.key, [...items, template])
            }}><Plus size={12} /> Add Output</Button>
        </div>
      )
    }

    if (field.type === 'taglist') {
      const raw = values[field.key]
      if (Array.isArray(raw) && raw.some(item => typeof item === 'object' && item !== null)) {
        return (
          <div key={field.key} className="mb-4">
            <Label className="text-xs">{field.label}</Label>
            {hint && <p className="text-[11px] text-muted-foreground/60 mb-1">{hint.description}</p>}
            <Textarea value={safeString(raw)} onChange={e => { try { setValue(field.key, jsYaml.load(e.target.value)) } catch {} }} className="font-mono text-xs" rows={3} />
          </div>
        )
      }
      return <div key={field.key} className="mb-4"><TagInput label={field.label} value={coerceTaglist(raw)} onChange={v => setValue(field.key, v)} suggestions={hint?.suggestions} helperText={hint?.description} /></div>
    }

    if (field.type === 'keyvalue') {
      const raw = values[field.key]
      // Deep nested objects → visual YAML editor
      if (isComplex(raw)) {
        return (
          <div key={field.key} className="mb-4">
            <Label className="text-xs">{field.label}</Label>
            {hint && <p className="text-[11px] text-muted-foreground/60 mb-1">{hint.description}</p>}
            <YamlEditor
              value={serialize(raw)}
              onChange={yaml => { try { setValue(field.key, jsYaml.load(yaml)) } catch {} }}
            />
          </div>
        )
      }
      const obj = (typeof raw === 'object' && !Array.isArray(raw)) ? (raw as Record<string, string>) : {}
      return <div key={field.key} className="mb-4"><KeyValueEditor label={field.label} value={obj} onChange={v => setValue(field.key, v)} />{hint && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{hint.description}</p>}</div>
    }

    // textarea type — handle deep objects with visual YAML editor
    if (field.type === 'textarea') {
      const raw = values[field.key]
      const isDeep = typeof raw === 'object' && raw !== null
      if (isDeep) {
        return (
          <div key={field.key} className="mb-4">
            <Label className="text-xs">{field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}</Label>
            {hint && <p className="text-[10px] text-muted-foreground/60 mt-0.5 mb-1">{hint.description}</p>}
            <YamlEditor
              value={serialize(raw)}
              onChange={yaml => { try { setValue(field.key, jsYaml.load(yaml)) } catch {} }}
            />
          </div>
        )
      }
      return (
        <div key={field.key} className="mb-4">
          <Label className="text-xs">{field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}</Label>
          <Textarea
            value={String(raw ?? '')}
            onChange={e => setValue(field.key, e.target.value)}
            placeholder={hint?.placeholder}
            className="mt-1 text-sm"
            rows={2}
          />
          {hint && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{hint.description}</p>}
        </div>
      )
    }

    return (
      <div key={field.key}>
        <Label className="text-xs font-medium text-foreground/80">{field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}</Label>
        <Input value={String(values[field.key] ?? '')} onChange={e => setValue(field.key, e.target.value)} placeholder={hint?.placeholder} className="mt-1.5 h-9 text-sm bg-background/50" />
        {hint && <p className="text-[10px] text-muted-foreground/50 mt-1 leading-relaxed">{hint.description}</p>}
      </div>
    )
  }

  return (
    <div className="p-3 space-y-0">
      {/* View mode toggle */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-medium">
          {currentType || 'untyped'}
        </span>
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/30 border border-border/30">
          <button onClick={() => setViewMode('form')}
            className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all',
              viewMode === 'form' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <LayoutList size={10} /> Form
          </button>
          <button onClick={() => setViewMode('yaml')}
            className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all',
              viewMode === 'yaml' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <Code size={10} /> YAML
          </button>
        </div>
      </div>

      {viewMode === 'yaml' ? (
        <InlineYamlEditor
          value={serialize(values)}
          onChange={yaml => {
            try {
              const parsed = jsYaml.load(yaml) as Record<string, unknown>
              if (parsed && typeof parsed === 'object') { setValues(parsed); setDirty(true) }
            } catch {}
          }}
        />
      ) : (
      <>
      {/* Grouped schema fields */}
      {Array.from(sections.entries()).map(([sectionName, fields]) => {
        const visibleFields = fields.filter(isFieldVisible)
        if (visibleFields.length === 0) return null
        return (
          <div key={sectionName}>
            <SectionHeader title={sectionName} />
            <div className="rounded-lg border border-border/40 bg-card/30 p-3 space-y-3">
              {visibleFields.map(renderField)}
            </div>
          </div>
        )
      })}

      {/* Custom fields — collapsible, hidden when empty */}
      {Object.keys(customFields).length > 0 && (
        <>
          <SectionHeader title="Custom Fields" />
          <div className="rounded-lg border border-border/40 bg-card/30 p-3 space-y-2">
            {Object.entries(customFields).map(([k, v]) => (
              <div key={k} className="flex gap-2 items-start">
                <Input value={k} className="h-8 text-sm flex-1 font-mono" placeholder="field_name" onChange={e => { const next = { ...values }; delete next[k]; next[e.target.value] = values[k]; setValues(next); setDirty(true) }} />
                {isComplex(values[k]) ? (
                  <YamlEditor value={serialize(values[k])} onChange={yaml => { try { setValue(k, jsYaml.load(yaml)) } catch {} }} className="flex-[2]" />
                ) : (
                  <Input value={v} className="h-8 text-sm flex-1" placeholder="Value" onChange={e => setValue(k, e.target.value)} />
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => { const next = { ...values }; delete next[k]; setValues(next); setDirty(true) }}><Trash2 size={14} /></Button>
              </div>
            ))}
          </div>
          <div className="pt-2">
            <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground text-xs" onClick={() => { setValue(nextCustomFieldName(), '') }}><Plus size={13} /> Add Custom Field</Button>
          </div>
        </>
      )}
      </>
      )}

      {/* Auto-save indicator */}
      <div className="flex items-center justify-center py-1">
        <span className="text-[10px] text-muted-foreground/50">
          {dirty ? '● Saving…' : '✓ Saved'}
        </span>
      </div>
    </div>
  )
}
