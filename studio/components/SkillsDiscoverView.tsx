'use client'

import { useState, useCallback, useRef, memo } from 'react'
import { Search, X, Globe, Download, ExternalLink, Check, ChevronRight, FileText } from 'lucide-react'
import { Spinner, LoadingState } from './ui/spinner'
import { useAppStore } from '@/store'
import { emit } from '@/utils/events'

interface SkillResult {
  id: string; skillId: string; name: string; installs: number; source: string
}

interface SkillFile { path: string; content: string }
interface PreviewSkill { name: string; dir: string; files: SkillFile[] }

export const SkillsDiscoverView = memo(function SkillsDiscoverView() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SkillResult[]>([])
  const [loading, setLoading] = useState(false)
  const [installed, setInstalled] = useState<Set<string>>(new Set())
  const [installing, setInstalling] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ skills: PreviewSkill[]; source: string; skillId: string } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const showNotification = useAppStore(s => s.showNotification)
  const reload = useAppStore(s => s.reload)

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

  const handleInstall = useCallback(async (skill: SkillResult) => {
    setInstalling(skill.id)
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: skill.source, skill: skill.skillId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setPreview({ skills: data.skills, source: skill.source, skillId: skill.id })
    } catch (err) {
      showNotification(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`, 'error')
    } finally { setInstalling(null) }
  }, [showNotification])

  const handleConfirm = useCallback(async () => {
    if (!preview) return
    setConfirming(true)
    try {
      const { requireWorkspace } = await import('@/lib/workspace')
      const ws = await requireWorkspace()

      for (const skill of preview.skills) {
        for (const file of skill.files) {
          // Inject source into SKILL.md frontmatter if missing
          let content = file.content
          if (file.path === 'SKILL.md' && !content.includes('source:')) {
            content = content.replace(/^(---\n)/, `$1source: ${preview.source}\n`)
          }
          await ws.write(`skills/${skill.dir}/${file.path}`, content)
        }
      }

      setInstalled(prev => new Set(prev).add(preview.skillId))
      setPreview(null)
      await reload()
      emit('agentflow:show-resources')
      showNotification(`Installed ${preview.skills.map(s => s.name).join(', ')}`, 'success')
    } catch (err) {
      showNotification(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`, 'error')
    } finally { setConfirming(false) }
  }, [preview, reload, showNotification])

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

  // ── Preview screen ──
  if (preview) {
    const totalFiles = preview.skills.reduce((n, s) => n + s.files.length, 0)
    return (
      <div className="flex flex-col h-full bg-card/50">
        <div className="p-3 border-b border-border/30 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold">Preview: {preview.source}</h3>
            <p className="text-[10px] text-muted-foreground">
              {preview.skills.length} skill{preview.skills.length > 1 ? 's' : ''} · {totalFiles} file{totalFiles > 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={() => setPreview(null)} className="p-1 rounded hover:bg-accent"><X size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {preview.skills.map(skill => (
            <div key={skill.dir} className="rounded-lg border border-border/50 p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Globe size={14} style={{ color: 'hsl(200, 80%, 55%)' }} />
                <span className="text-xs font-medium">{skill.name}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                → skills/{skill.dir}/
              </p>
              {/* File list */}
              <div className="space-y-0.5">
                {skill.files.map(f => (
                  <details key={f.path} className="group">
                    <summary className="text-[10px] text-muted-foreground/70 cursor-pointer hover:text-muted-foreground flex items-center gap-1">
                      <ChevronRight size={10} className="group-open:rotate-90 transition-transform" />
                      <FileText size={10} />
                      {f.path}
                    </summary>
                    <pre className="mt-1 text-[9px] leading-relaxed bg-background/60 rounded-md p-2 overflow-x-auto max-h-32 text-muted-foreground whitespace-pre-wrap">
                      {f.content.slice(0, 800)}{f.content.length > 800 ? '\n…' : ''}
                    </pre>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-2 border-t border-border/30 flex gap-2">
          <button onClick={() => setPreview(null)}
            className="flex-1 py-1.5 text-xs rounded-lg border border-border/50 hover:bg-accent transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={confirming}
            className="flex-1 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
            {confirming ? <Spinner size="sm" /> : <Download size={12} />}
            Install to skills/
          </button>
        </div>
      </div>
    )
  }

  // ── Search screen ──
  return (
    <div className="flex flex-col h-full bg-card/50">
      <div className="p-2.5 pb-2 space-y-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <input
            placeholder="Search 34k+ agent skills…"
            value={query}
            onChange={e => { setQuery(e.target.value); search(e.target.value) }}
            className="w-full h-8 pl-8 pr-8 text-xs rounded-lg border border-border/50 bg-background/60 focus:outline-none focus:ring-1 focus:ring-ring/30 placeholder:text-muted-foreground/50"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]) }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={12} />
            </button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/60 px-0.5">
          Search <a href="https://skills.sh" target="_blank" rel="noopener" className="underline hover:text-foreground">skills.sh</a> — preview before installing.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 pb-4">
        {loading && <LoadingState />}
        {!loading && query.length < 2 && (
          <div className="flex flex-col items-center py-10 text-center px-4">
            <Globe size={28} className="text-muted-foreground/30 mb-3" />
            <p className="text-xs text-muted-foreground/60">Type to search the skills marketplace</p>
          </div>
        )}
        {!loading && query.length >= 2 && results.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground/60">No skills found for &ldquo;{query}&rdquo;</div>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          {results.map(skill => {
            const isInstalled = installed.has(skill.id)
            const isInstalling = installing === skill.id
            return (
              <div key={skill.id}
                className="group/block relative flex flex-col items-center gap-1.5 p-2.5 rounded-lg border border-border/40 hover:border-border hover:bg-accent/40 transition-all text-center">
                <span className="flex items-center justify-center size-8 rounded-lg"
                  style={{ backgroundColor: 'hsl(200, 80%, 55%, 0.1)' }}>
                  <Globe size={16} style={{ color: 'hsl(200, 80%, 55%)' }} />
                </span>
                <span className="text-[10px] font-medium leading-tight truncate w-full">{skill.name}</span>
                <span className="text-[9px] text-muted-foreground/50 truncate w-full">{skill.source}</span>
                <span className="text-[9px] text-muted-foreground/40">{fmt(skill.installs)}</span>
                {isInstalled ? (
                  <Check size={10} className="absolute top-1.5 right-1.5 text-emerald-500" />
                ) : (
                  <button
                    disabled={isInstalling}
                    onClick={e => { e.stopPropagation(); handleInstall(skill) }}
                    className="absolute top-1 right-1 p-1 rounded-md opacity-0 group-hover/block:opacity-100 hover:bg-primary/10 text-primary transition-all disabled:opacity-50">
                    {isInstalling ? <Spinner size="sm" /> : <Download size={12} />}
                  </button>
                )}
                <button className="absolute top-1 left-1 p-1 rounded-md opacity-0 group-hover/block:opacity-100 hover:bg-accent text-muted-foreground/50 transition-all"
                  onClick={() => window.open(`https://skills.sh/${skill.source}/${skill.skillId}`, '_blank')}>
                  <ExternalLink size={10} />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})
