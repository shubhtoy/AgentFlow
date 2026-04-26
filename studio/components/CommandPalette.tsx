'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Search as SearchIcon } from 'lucide-react'
import { useAppStore } from '@/store'
import { CATEGORY_CONFIG } from '@/lib/constants'
import { useCategoryConfig } from '../hooks/useCategoryConfig'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from './ui/command'
import { Badge } from './ui/badge'
import type { ParsedFile, ResourceCategory } from '@/lib/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
  id: string
  name: string
  description: string
  category: string
  type: 'node' | 'resource' | 'workflow'
  workflowId?: string
  resourceCategory?: ResourceCategory
}

interface ActionCommand {
  id: string
  label: string
  description: string
  action: () => void
}

// ---------------------------------------------------------------------------
// Fuzzy match helper
// ---------------------------------------------------------------------------

function fuzzyMatch(query: string, text: string): boolean {
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++
  }
  return qi === q.length
}

// ---------------------------------------------------------------------------
// Recent / frequent tracking (session-level)
// ---------------------------------------------------------------------------

const recentSelections: SearchResult[] = []
const MAX_RECENT = 8

function trackRecent(result: SearchResult) {
  const idx = recentSelections.findIndex((r) => r.id === result.id)
  if (idx >= 0) recentSelections.splice(idx, 1)
  recentSelections.unshift(result)
  if (recentSelections.length > MAX_RECENT) recentSelections.pop()
}

// ---------------------------------------------------------------------------
// Build search index from store data
// ---------------------------------------------------------------------------

function buildSearchIndex(
  data: ReturnType<typeof useAppStore.getState>['data'],
  activeWf: string,
): SearchResult[] {
  if (!data) return []
  const results: SearchResult[] = []

  for (const [wfId, wf] of Object.entries(data.workflows)) {
    results.push({
      id: `wf:${wfId}`, name: wf.name || wfId, description: wf.description || '',
      category: 'workflows', type: 'workflow', workflowId: wfId,
    })
    for (const [nodeId, node] of Object.entries(wf.nodes)) {
      results.push({
        id: `node:${wfId}:${nodeId}`, name: node.name || nodeId, description: node.description || '',
        category: 'nodes', type: 'node', workflowId: wfId,
      })
    }
  }

  const resourceCategories: { key: ResourceCategory; items: Record<string, ParsedFile> }[] = [
    { key: 'instructions', items: data.instructions },
    { key: 'capabilities', items: data.capabilities },
    { key: 'skills', items: data.skills },
    { key: 'memory', items: data.memory },
    { key: 'hooks', items: data.hooks as Record<string, ParsedFile> },
    { key: 'customFiles', items: data.customFiles ?? {} },
  ]

  for (const { key, items } of resourceCategories) {
    for (const [name, file] of Object.entries(items)) {
      results.push({
        id: `res:${key}:${name}`, name: file.title || name,
        description: (file.frontmatter?.description as string) || '',
        category: key, type: 'resource', resourceCategory: key,
      })
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Action commands registry
// ---------------------------------------------------------------------------

function buildActionCommands(actions: {
  setCommandPaletteOpen: (open: boolean) => void
  validate: () => Promise<unknown>
  toggleResourcePalette: () => void
  toggleExplorer: () => void
}): ActionCommand[] {
  return [
    { id: 'action:elements', label: 'Toggle Elements Library', description: 'Open or close the elements palette (⌘L)',
      action: () => { actions.setCommandPaletteOpen(false); actions.toggleResourcePalette() } },
    { id: 'action:explorer', label: 'Toggle Explorer', description: 'Open or close the explorer panel (⌘B)',
      action: () => { actions.setCommandPaletteOpen(false); actions.toggleExplorer() } },
    { id: 'action:validate', label: 'Validate', description: 'Run validation on the workspace',
      action: () => { actions.setCommandPaletteOpen(false); actions.validate() } },
    { id: 'action:shortcuts', label: 'Help', description: 'Shortcuts, concepts & ecosystem reference (?)',
      action: () => { actions.setCommandPaletteOpen(false); window.dispatchEvent(new CustomEvent('agentflow:show-shortcuts')) } },
    { id: 'action:auto-save', label: 'Toggle Auto-Save', description: 'Enable or disable automatic saving',
      action: () => {
        actions.setCommandPaletteOpen(false)
        const store = useAppStore.getState()
        store.toggleAutoSave()
        store.showNotification(`Auto-save ${store.autoSave ? 'enabled' : 'disabled'}`, 'info')
      } },
    { id: 'action:settings', label: 'Open Settings', description: 'API keys, theme, preferences',
      action: () => { actions.setCommandPaletteOpen(false); window.dispatchEvent(new CustomEvent('agentflow:show-settings')) } },
  ]
}

// ---------------------------------------------------------------------------
// Category display
// ---------------------------------------------------------------------------

const CATEGORY_ORDER = ['nodes', 'workflows', 'instructions', 'capabilities', 'skills', 'memory', 'hooks', 'customFiles']

function getCategoryLabel(cat: string): string {
  if (cat === 'nodes') return 'Nodes'
  if (cat === 'workflows') return 'Workflows'
  const cfg = CATEGORY_CONFIG[cat]
  return cfg ? `${cfg.label}s` : cat
}

// ---------------------------------------------------------------------------
// CommandPalette Component
// ---------------------------------------------------------------------------

export default function CommandPalette() {
  const commandPaletteOpen = useAppStore(s => s.commandPaletteOpen)
  const setCommandPaletteOpen = useAppStore(s => s.setCommandPaletteOpen)
  const data = useAppStore(s => s.data)
  const activeWf = useAppStore(s => s.activeWf)
  const select = useAppStore(s => s.select)
  const setDrawerOpen = useAppStore(s => s.setDrawerOpen)
  const validate = useAppStore(s => s.validate)
  const toggleResourcePalette = useAppStore(s => s.toggleResourcePalette)
  const toggleExplorer = useAppStore(s => s.toggleExplorer)

  const [query, setQuery] = useState('')
  const categoryConfig = useCategoryConfig()

  const searchIndex = useMemo(() => buildSearchIndex(data, activeWf), [data, activeWf])
  const actionCommands = useMemo(() => buildActionCommands({ setCommandPaletteOpen, validate, toggleResourcePalette, toggleExplorer }), [setCommandPaletteOpen, validate, toggleResourcePalette, toggleExplorer])

  const isActionQuery = query.startsWith('>')
  const actionQuery = isActionQuery ? query.slice(1).trim().toLowerCase() : ''

  const filteredResults = useMemo(() => {
    if (isActionQuery) return []
    if (!query.trim()) return recentSelections.slice()
    return searchIndex.filter(r => fuzzyMatch(query, r.name) || fuzzyMatch(query, r.description))
  }, [query, searchIndex, isActionQuery])

  const filteredActions = useMemo(() => {
    if (!isActionQuery) return []
    if (!actionQuery) return actionCommands
    return actionCommands.filter(a => fuzzyMatch(actionQuery, a.label) || fuzzyMatch(actionQuery, a.description))
  }, [isActionQuery, actionQuery, actionCommands])

  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {}
    for (const r of filteredResults) {
      if (!groups[r.category]) groups[r.category] = []
      groups[r.category].push(r)
    }
    const ordered: { category: string; items: SearchResult[] }[] = []
    for (const cat of CATEGORY_ORDER) {
      if (groups[cat]) ordered.push({ category: cat, items: groups[cat] })
    }
    for (const cat of Object.keys(groups)) {
      if (!CATEGORY_ORDER.includes(cat)) ordered.push({ category: cat, items: groups[cat] })
    }
    return ordered
  }, [filteredResults])

  useEffect(() => {
    if (commandPaletteOpen) setQuery('')
  }, [commandPaletteOpen])

  // Global Ctrl/Cmd+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [commandPaletteOpen, setCommandPaletteOpen])

  const handleSelect = useCallback((id: string) => {
    // Action commands
    const action = actionCommands.find(a => a.id === id)
    if (action) { action.action(); return }

    // Search results
    const result = filteredResults.find(r => r.id === id) ?? recentSelections.find(r => r.id === id)
    if (!result) return

    trackRecent(result)
    setCommandPaletteOpen(false)

    if (result.type === 'node') {
      select({ type: 'node', key: result.id.split(':')[2], workflowId: result.workflowId })
      setDrawerOpen(true)
    } else if (result.type === 'resource') {
      select({ type: 'resource', category: result.resourceCategory, key: result.name })
      setDrawerOpen(true)
    } else if (result.type === 'workflow') {
      select({ type: 'workflow', key: result.workflowId || result.name })
    }
  }, [actionCommands, filteredResults, select, setCommandPaletteOpen, setDrawerOpen])

  return (
    <CommandDialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} shouldFilter={false}>
      <CommandInput
        placeholder="Search nodes, resources, workflows… (prefix > for commands)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[calc(70vh-80px)]">
        <CommandEmpty>
          {isActionQuery ? 'No commands found' : query.trim() ? 'No results found' : 'Start typing to search across your workspace'}
        </CommandEmpty>

        {/* Action commands mode */}
        {isActionQuery && filteredActions.length > 0 && (
          <CommandGroup heading="Commands">
            {filteredActions.map(action => (
              <CommandItem key={action.id} value={action.id} onSelect={handleSelect}>
                <div className="flex flex-col">
                  <span className="font-medium">{action.label}</span>
                  <span className="text-xs text-muted-foreground">{action.description}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Recent results */}
        {!isActionQuery && !query.trim() && recentSelections.length > 0 && (
          <CommandGroup heading="Recent">
            {recentSelections.map(result => {
              const cfg = categoryConfig[result.category]
              return (
                <CommandItem key={result.id} value={result.id} onSelect={handleSelect}>
                  <ResultRow result={result} cfg={cfg} />
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {/* Grouped search results */}
        {!isActionQuery && query.trim() && groupedResults.map(group => (
          <CommandGroup key={group.category} heading={getCategoryLabel(group.category)}>
            {group.items.map(result => {
              const cfg = categoryConfig[result.category]
              return (
                <CommandItem key={result.id} value={result.id} onSelect={handleSelect}>
                  <ResultRow result={result} cfg={cfg} />
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}

function ResultRow({ result, cfg }: { result: SearchResult; cfg?: { icon: any; label: string; primaryColor: string; containerColor: string } }) {
  const Icon = cfg?.icon
  return (
    <div className="flex items-center gap-2 w-full">
      {Icon && (
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: cfg?.containerColor }}
        >
          <Icon size={18} style={{ color: cfg?.primaryColor }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium truncate">{result.name}</span>
          <Badge variant="secondary" className="text-[0.65rem] h-5 shrink-0">
            {cfg?.label || result.category}
          </Badge>
        </div>
        {result.description && (
          <p className="text-xs text-muted-foreground truncate">
            {result.description.length > 80 ? `${result.description.slice(0, 80)}…` : result.description}
          </p>
        )}
      </div>
    </div>
  )
}
