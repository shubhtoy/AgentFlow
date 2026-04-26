import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { RESOURCE_CATEGORIES } from '@/lib/constants'
import { useNewStore } from '@/store/create-store'
import { useAppStore } from '@/store'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card'
import {
  Search,
  Workflow,
  Wrench,
  BookOpen,
  FileText,
  MessageSquare,
  Brain,
  X,
  Plus,
  Check,
  GripVertical,
  Globe,
  Download,
  ExternalLink,
} from 'lucide-react'
import { Spinner, LoadingState } from '../ui/spinner'

const TYPE_FILTERS = [
  { value: '', label: 'All', icon: null },
  { value: 'workflow', label: 'Workflows', icon: Workflow },
  { value: 'instruction', label: 'Instructions', icon: BookOpen },
  { value: 'capability', label: 'Capabilities', icon: Wrench },
  { value: 'skill', label: 'Skills', icon: FileText },
  { value: 'memory', label: 'Memory', icon: Brain },
] as const

const TYPE_ICON_MAP: Record<string, typeof Workflow> = {
  workflow: Workflow,
  instruction: BookOpen,
  capability: Wrench,
  skill: FileText,
  memory: Brain,
}

const COMPLEXITY_COLOR: Record<string, string> = {
  basic: 'bg-green-500/15 text-green-700 dark:text-green-400',
  intermediate: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  advanced: 'bg-red-500/15 text-red-700 dark:text-red-400',
}

interface LibraryBrowserProps {
  onSelect?: (entry: any) => void
  onAdd?: (entry: any) => void
}

/* ── Skills.sh search tab ── */

interface SkillResult {
  id: string
  skillId: string
  name: string
  installs: number
  source: string
}

function SkillsShSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SkillResult[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const search = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (q.length < 2) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/skills?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(data.skills ?? [])
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 300)
  }, [])

  const fmtInstalls = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search skills.sh..."
            value={query}
            onChange={e => { setQuery(e.target.value); search(e.target.value) }}
            className="pl-8 h-8 text-xs"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]) }}
              className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {loading && (
            <div className="flex items-center justify-center h-20">
              <Spinner />
            </div>
          )}
          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="text-center py-8 text-xs text-muted-foreground">No skills found.</div>
          )}
          {!loading && query.length < 2 && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Type at least 2 characters to search 34k+ agent skills.
            </div>
          )}
          {results.map(skill => (
            <Card key={skill.id} className="hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => window.open(`https://skills.sh/${skill.source}/${skill.skillId}`, '_blank')}>
              <CardHeader className="p-2.5 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <CardTitle className="text-xs font-medium truncate">{skill.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                      <Download className="h-2.5 w-2.5" />{fmtInstalls(skill.installs)}
                    </span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground/40" />
                  </div>
                </div>
                <CardDescription className="text-[10px] leading-relaxed">{skill.source}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

/* ── Main export with tabs ── */

export function LibraryBrowser({ onSelect, onAdd }: LibraryBrowserProps) {
  const [tab, setTab] = useState<'local' | 'skills'>('local')
  const entries = useNewStore(s => s.libraryEntries)
  const loading = useNewStore(s => s.libraryLoading)
  const loadLibrary = useNewStore(s => s.loadLibrary)
  const search = useNewStore(s => s.librarySearch)
  const setSearch = useNewStore(s => s.setLibrarySearch)
  const data = useAppStore(s => s.data)

  const [typeFilter, setTypeFilter] = useState('')
  const [domainFilter, setDomainFilter] = useState('')

  useEffect(() => {
    if (entries.length === 0) loadLibrary()
  }, [entries.length, loadLibrary])

  // Compute installed items from workspace data
  const installedItems = useMemo(() => {
    const set = new Set<string>()
    if (!data) return set
    const categories = RESOURCE_CATEGORIES
    for (const cat of categories) {
      const records = data[cat] as Record<string, any> | undefined
      if (records) {
        const singularType = cat.endsWith('s') ? cat.slice(0, -1) : cat
        for (const name of Object.keys(records)) {
          set.add(`${singularType}:${name}`)
        }
      }
    }
    // Check workflows
    for (const wfId of Object.keys(data.workflows || {})) {
      set.add(`workflow:${wfId}`)
    }
    return set
  }, [data])

  const handleDragStart = useCallback((e: React.DragEvent, entry: any) => {
    e.stopPropagation()
    e.dataTransfer.setData('application/agentflow-library', JSON.stringify({
      type: 'library-item',
      name: entry.name,
      entryType: entry.type,
    }))
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  const domains = useMemo(() => {
    const set = new Set<string>()
    entries.forEach((e: any) => { if (e.domain) set.add(e.domain) })
    return Array.from(set).sort()
  }, [entries])

  const filtered = useMemo(() => {
    let result = entries
    if (typeFilter) result = result.filter((e: any) => e.type === typeFilter)
    if (domainFilter) result = result.filter((e: any) => e.domain === domainFilter)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((e: any) =>
        e.name.toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        (e.tags || []).some((t: string) => t.toLowerCase().includes(q))
      )
    }
    return result
  }, [entries, typeFilter, domainFilter, search])

  const handleClearFilters = useCallback(() => {
    setSearch('')
    setTypeFilter('')
    setDomainFilter('')
  }, [setSearch])

  const hasFilters = search || typeFilter || domainFilter

  if (loading && tab === 'local') {
    return (
      <div className="flex items-center justify-center h-32">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab switcher */}
      <div className="flex border-b">
        <button onClick={() => setTab('local')}
          className={`flex-1 px-3 py-1.5 text-[11px] font-medium transition-colors ${tab === 'local' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          Local Library
        </button>
        <button onClick={() => setTab('skills')}
          className={`flex-1 px-3 py-1.5 text-[11px] font-medium transition-colors flex items-center justify-center gap-1 ${tab === 'skills' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <Globe className="h-3 w-3" />Skills.sh
        </button>
      </div>

      {tab === 'skills' ? <SkillsShSearch /> : (
      <>
      {/* Search */}
      <div className="p-2 space-y-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search library..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Type filter chips */}
        <div className="flex flex-wrap gap-1">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value === typeFilter ? '' : f.value)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                f.value === typeFilter
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {f.icon && <f.icon className="h-2.5 w-2.5" />}
              {f.label}
            </button>
          ))}
        </div>

        {/* Domain filter */}
        {domains.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {domains.map(d => (
              <button
                key={d}
                onClick={() => setDomainFilter(d === domainFilter ? '' : d)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                  d === domainFilter
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        )}

        {/* Active filter summary */}
        {hasFilters && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {filtered.length} of {entries.length} items
            </span>
            <button
              onClick={handleClearFilters}
              className="text-[10px] text-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              {hasFilters ? 'No items match your filters.' : 'Library is empty.'}
            </div>
          ) : (
            filtered.map((entry: any) => {
              const Icon = TYPE_ICON_MAP[entry.type] || FileText
              const isInstalled = installedItems.has(`${entry.type}:${entry.name}`)
              const isWorkflow = entry.type === 'workflow'
              return (
                <Card
                  key={`${entry.type}-${entry.name}`}
                  draggable={!isWorkflow}
                  onDragStart={isWorkflow ? undefined : (e) => handleDragStart(e, entry)}
                  className={`hover:bg-accent/50 transition-colors ${isWorkflow ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
                  onClick={() => onSelect?.(entry)}
                >
                  <CardHeader className="p-2.5 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <CardTitle className="text-xs font-medium truncate">
                          {entry.name}
                        </CardTitle>
                        {isInstalled && (
                          <Check className="h-3 w-3 shrink-0 text-green-600 dark:text-green-400" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {entry.complexity && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${COMPLEXITY_COLOR[entry.complexity] || ''}`}>
                            {entry.complexity}
                          </span>
                        )}
                        {onAdd && !isInstalled && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0"
                            onClick={e => { e.stopPropagation(); onAdd(entry) }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        )}
                        {!isWorkflow && (
                          <GripVertical className="h-3 w-3 text-muted-foreground/30" />
                        )}
                      </div>
                    </div>
                    <CardDescription className="text-[10px] line-clamp-2 leading-relaxed">
                      {entry.description}
                    </CardDescription>
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 pt-0.5">
                        {entry.tags.slice(0, 4).map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-[9px] px-1 py-0 h-4">
                            {tag}
                          </Badge>
                        ))}
                        {entry.tags.length > 4 && (
                          <span className="text-[9px] text-muted-foreground">+{entry.tags.length - 4}</span>
                        )}
                      </div>
                    )}
                  </CardHeader>
                </Card>
              )
            })
          )}
        </div>
      </ScrollArea>
      </>
      )}
    </div>
  )
}
