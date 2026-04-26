'use client'

import { useState, useMemo, useCallback } from 'react'
import useSWR, { mutate } from 'swr'
import { Check, ChevronDown, Sparkles, Zap, Eye, Wrench, Brain, Code2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command'

interface ModelDef {
  id: string
  label: string
  provider?: string
  providerName?: string
  tags?: string[]
  free?: boolean
  contextLength?: number
}

type Filter = 'all' | 'free' | 'tools' | 'fast' | 'vision' | 'reasoning' | 'code'

const FILTERS: { key: Filter; label: string; icon: typeof Zap }[] = [
  { key: 'free',      label: 'Free',      icon: Zap },
  { key: 'tools',     label: 'Tools',     icon: Wrench },
  { key: 'fast',      label: 'Fast',      icon: Zap },
  { key: 'vision',    label: 'Vision',    icon: Eye },
  { key: 'reasoning', label: 'Reasoning', icon: Brain },
  { key: 'code',      label: 'Code',      icon: Code2 },
]

const fetcher = (url: string) => fetch(url).then(r => r.json())

function ctxLabel(ctx?: number): string {
  if (!ctx) return ''
  if (ctx >= 1_000_000) return '1M'
  if (ctx >= 1_000) return `${Math.round(ctx / 1000)}k`
  return String(ctx)
}

export function ModelPicker() {
  const { data, isLoading } = useSWR('/api/copilot', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [customValue, setCustomValue] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const models: ModelDef[] = data?.models || []
  const current: string = data?.current || 'auto'
  const availableProviders: string[] = data?.availableProviders || []
  const providerNames: Record<string, string> = data?.providers || {}

  const select = useCallback(async (id: string) => {
    setOpen(false)
    setShowCustom(false)
    await fetch('/api/copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'model', model: id }),
    })
    mutate('/api/copilot')
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return models
    return models.filter(m => (m.tags || []).includes(filter))
  }, [models, filter])

  const available = useMemo(() =>
    filtered.filter(m => !m.provider || availableProviders.includes(m.provider)),
    [filtered, availableProviders])

  const unavailable = useMemo(() =>
    filtered.filter(m => m.provider && !availableProviders.includes(m.provider)),
    [filtered, availableProviders])

  const grouped = useMemo(() => {
    const g = new Map<string, ModelDef[]>()
    for (const m of available) {
      const key = m.provider || 'other'
      if (!g.has(key)) g.set(key, [])
      g.get(key)!.push(m)
    }
    return g
  }, [available])

  const currentModel = models.find(m => m.id === current)

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[0.7rem] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <Sparkles size={11} className={current === 'auto' ? 'text-primary' : ''} />
          <span className="font-medium max-w-[100px] truncate">
            {isLoading ? '...' : currentModel?.label || current}
          </span>
          <ChevronDown size={9} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 z-[99999]" align="start" side="top" sideOffset={4} onOpenAutoFocus={e => e.preventDefault()}>
        <Command>
          <CommandInput placeholder="Search models..." className="h-7 text-xs" />
          <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-border/40">
            <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
            {FILTERS.map(f => (
              <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(filter === f.key ? 'all' : f.key)}>
                <f.icon size={8} /> {f.label}
              </Chip>
            ))}
          </div>

          <CommandList className="max-h-64">
            <CommandEmpty>No models match</CommandEmpty>

            <CommandGroup>
              <CommandItem value="auto" onSelect={() => select('auto')} className="text-xs py-1">
                <Sparkles size={11} className="mr-1.5 text-primary" />
                <span className="flex-1 font-medium">Auto</span>
                {current === 'auto' && <Check size={11} className="text-primary" />}
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            {Array.from(grouped.entries()).map(([provider, list]) => (
              <CommandGroup key={provider} heading={providerNames[provider] || provider}>
                {list.map(m => (
                  <CommandItem key={m.id} value={m.id} onSelect={() => select(m.id)} className="text-xs py-0.5 gap-1">
                    <span className="flex-1 font-medium text-[0.65rem] truncate">{m.label}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {m.free && <span className="text-[0.55rem] text-emerald-500 font-semibold">FREE</span>}
                      {m.contextLength && <span className="text-[0.55rem] text-muted-foreground">{ctxLabel(m.contextLength)}</span>}
                      {current === m.id && <Check size={10} className="text-primary" />}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}

            {unavailable.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="No API key">
                  {unavailable.slice(0, 8).map(m => (
                    <CommandItem key={m.id} value={m.id} disabled className="text-xs py-0.5 opacity-30">
                      <span className="text-[0.65rem]">{m.label}</span>
                      {m.free && <span className="text-[0.55rem] ml-auto">FREE</span>}
                    </CommandItem>
                  ))}
                  {unavailable.length > 8 && (
                    <div className="px-2 py-0.5 text-[0.55rem] text-muted-foreground">
                      +{unavailable.length - 8} more
                    </div>
                  )}
                </CommandGroup>
              </>
            )}

            <CommandSeparator />
            <CommandGroup>
              {!showCustom ? (
                <CommandItem value="__custom__" onSelect={() => setShowCustom(true)} className="text-xs py-1 text-muted-foreground">
                  Custom model...
                </CommandItem>
              ) : (
                <div className="px-2 py-1 flex gap-1">
                  <Input
                    value={customValue}
                    onChange={e => setCustomValue(e.target.value)}
                    placeholder="provider/model-id"
                    className="h-6 text-[0.6rem] font-mono"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter' && customValue.trim()) select(customValue.trim()) }}
                  />
                  <Button size="sm" className="h-6 px-2 text-[0.55rem]" disabled={!customValue.trim()} onClick={() => select(customValue.trim())}>
                    Set
                  </Button>
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[0.6rem] font-medium transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  )
}
