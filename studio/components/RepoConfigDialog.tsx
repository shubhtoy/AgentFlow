import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { Checkbox } from './ui/checkbox'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'
import { GitBranch, Plus, CheckCircle2, Key, Terminal, ShieldCheck, X, Loader2 } from 'lucide-react'
import { gitApi } from '@/lib/api'
import type { GitAuthInfo, GitAuthMethod } from '@/lib/api'

// Types matching the design doc data models
export type RepoRole = 'primary' | 'agentic' | 'shared'
export type RepoType = 'public' | 'private' | 'custom'
export type SyncDirection = 'bidirectional' | 'push_only' | 'pull_only'
export type ConflictStrategy = 'local_wins' | 'remote_wins' | 'manual' | 'timestamp'

export interface SyncRules {
  include: string[]
  exclude: string[]
  resourceTypes: string[]
  syncDirection: SyncDirection
}

export interface RepoMapping {
  name: string
  url: string
  branch: string
  localPath: string
  repoType: RepoType
  role: RepoRole
  agentflowPath: string
}

export interface RepoConfigFormData {
  mapping: RepoMapping
  syncRules: SyncRules
  conflictStrategy: ConflictStrategy
}

import { RESOURCE_CATEGORIES } from '@/lib/constants'
const RESOURCE_TYPES = RESOURCE_CATEGORIES

const DEFAULT_SYNC_RULES: SyncRules = {
  include: ['**/*.md', '**/*.yaml'],
  exclude: ['**/output/**', '**/node_modules/**'],
  resourceTypes: [],
  syncDirection: 'bidirectional',
}

// Pattern list editor (for include/exclude globs)
function PatternListEditor({ label, patterns, onChange }: {
  label: string; patterns: string[]; onChange: (p: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const add = () => { const t = draft.trim(); if (t && !patterns.includes(t)) { onChange([...patterns, t]); setDraft('') } }
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-1 min-h-[28px]">
        {patterns.map((p, i) => (
          <Badge key={i} variant="secondary" className="text-[10px] font-mono gap-1 pr-1">
            {p}
            <button onClick={() => onChange(patterns.filter((_, j) => j !== i))} className="hover:text-destructive"><X size={10} /></button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="e.g. **/*.md" className="h-8 text-xs font-mono"
        />
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={add} disabled={!draft.trim()}>
          <Plus size={14} />
        </Button>
      </div>
    </div>
  )
}

function authMethodIcon(m: GitAuthMethod) {
  switch (m.type) {
    case 'ssh': case 'ssh-agent': return <Key size={10} />
    case 'gh-cli': return <Terminal size={10} />
    case 'credential-helper': return <ShieldCheck size={10} />
    default: return <CheckCircle2 size={10} />
  }
}

export interface RepoConfigDialogProps {
  open: boolean
  onClose: () => void
  initial?: Partial<RepoConfigFormData>
  onSave: (data: RepoConfigFormData) => void
}

export function RepoConfigDialog({ open, onClose, initial, onSave }: RepoConfigDialogProps) {
  const isEdit = Boolean(initial?.mapping?.name)

  const [authInfo, setAuthInfo] = useState<GitAuthInfo | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<RepoRole>('primary')
  const [branch, setBranch] = useState('main')
  const [repoType, setRepoType] = useState<RepoType>('public')
  const [agentflowPath, setAgentflowPath] = useState('.agentflow')

  const [includePatterns, setIncludePatterns] = useState<string[]>(DEFAULT_SYNC_RULES.include)
  const [excludePatterns, setExcludePatterns] = useState<string[]>(DEFAULT_SYNC_RULES.exclude)
  const [resourceTypes, setResourceTypes] = useState<string[]>([])
  const [syncDirection, setSyncDirection] = useState<SyncDirection>('bidirectional')
  const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>('manual')

  useEffect(() => {
    if (!open) return
    const m = initial?.mapping
    setUrl(m?.url ?? ''); setName(m?.name ?? ''); setRole(m?.role ?? 'primary')
    setBranch(m?.branch ?? 'main'); setRepoType(m?.repoType ?? 'public')
    setAgentflowPath(m?.agentflowPath ?? '.agentflow')
    const sr = initial?.syncRules
    setIncludePatterns(sr?.include ?? DEFAULT_SYNC_RULES.include)
    setExcludePatterns(sr?.exclude ?? DEFAULT_SYNC_RULES.exclude)
    setResourceTypes(sr?.resourceTypes ?? [])
    setSyncDirection(sr?.syncDirection ?? 'bidirectional')
    setConflictStrategy(initial?.conflictStrategy ?? 'manual')
    setAuthLoading(true)
    gitApi.getAuthInfo().then(info => setAuthInfo(info)).catch(() => setAuthInfo(null)).finally(() => setAuthLoading(false))
  }, [open, initial])

  const handleResourceTypeToggle = useCallback((type: string) => {
    setResourceTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
  }, [])

  const handleSave = () => {
    onSave({
      mapping: { name: name.trim(), url: url.trim(), branch: branch.trim() || 'main', localPath: '', repoType, role, agentflowPath: agentflowPath.trim() || '.agentflow' },
      syncRules: { include: includePatterns, exclude: excludePatterns, resourceTypes, syncDirection },
      conflictStrategy,
    })
    onClose()
  }

  const canSave = url.trim().length > 0 && name.trim().length > 0

  // Auto-detect name from URL
  useEffect(() => {
    if (name || !url) return
    const match = url.replace(/\.git$/, '').split('/').pop()
    if (match) setName(match)
  }, [url, name])

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch size={18} />
            {isEdit ? 'Edit Repository' : 'Connect Repository'}
          </DialogTitle>
          <DialogDescription>Configure repository connection and sync settings.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Auth detection */}
          {authLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" /> Detecting auth methods…
            </div>
          ) : authInfo && authInfo.methods.length > 0 ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5">
              <p className="text-[11px] font-semibold mb-1">Detected auth methods</p>
              <div className="flex flex-wrap gap-1">
                {authInfo.methods.map((m, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-500/30">
                    {authMethodIcon(m)} {m.label}
                  </Badge>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {authInfo.recommended === 'ssh' ? `SSH recommended — use: ${authInfo.sshExample}`
                  : authInfo.recommended === 'https' ? `HTTPS recommended — use: ${authInfo.httpsExample}`
                  : 'Configure git credentials or SSH keys for private repos'}
              </p>
            </div>
          ) : authInfo ? (
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-2.5">
              <p className="text-[11px] font-semibold">No auth methods detected</p>
              <p className="text-[10px] text-muted-foreground">Public repos will work. For private repos, set up SSH keys or a git credential helper.</p>
            </div>
          ) : null}

          {/* URL */}
          <div className="space-y-1.5">
            <Label className="text-xs">Repository URL *</Label>
            <Input value={url} onChange={e => setUrl(e.target.value)}
              placeholder={authInfo?.recommended === 'ssh' ? authInfo.sshExample : 'https://github.com/org/repo.git'}
              className="h-8 text-xs font-mono" />
            <p className="text-[10px] text-muted-foreground">
              {url.startsWith('git@') ? 'SSH URL — requires SSH key auth'
                : url.startsWith('https://') ? 'HTTPS URL — uses credential helper or token'
                : 'Enter SSH (git@…) or HTTPS (https://…) URL'}
            </p>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs">Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. team-shared" className="h-8 text-xs" />
          </div>

          {/* Role + Repo Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <select value={role} onChange={e => setRole(e.target.value as RepoRole)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs">
                <option value="primary">Primary</option>
                <option value="agentic">Agentic</option>
                <option value="shared">Shared</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Repo Type</Label>
              <select value={repoType} onChange={e => setRepoType(e.target.value as RepoType)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs">
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          {/* Branch + Agentflow Path */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Branch</Label>
              <Input value={branch} onChange={e => setBranch(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Agentflow Path</Label>
              <Input value={agentflowPath} onChange={e => setAgentflowPath(e.target.value)} placeholder=".agentflow" className="h-8 text-xs font-mono" />
            </div>
          </div>

          <Separator />

          {/* Sync Rules */}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sync Rules</p>

          <PatternListEditor label="Include patterns" patterns={includePatterns} onChange={setIncludePatterns} />
          <PatternListEditor label="Exclude patterns" patterns={excludePatterns} onChange={setExcludePatterns} />

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Resource types (leave empty to sync all)</Label>
            <div className="flex flex-wrap gap-3">
              {RESOURCE_TYPES.map(type => (
                <label key={type} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Checkbox checked={resourceTypes.includes(type)} onCheckedChange={() => handleResourceTypeToggle(type)} className="h-3.5 w-3.5" />
                  {type}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Sync direction</Label>
            <ToggleGroup type="single" value={syncDirection} onValueChange={v => { if (v) setSyncDirection(v as SyncDirection) }} size="sm">
              <ToggleGroupItem value="bidirectional" className="text-[11px]">Bidirectional</ToggleGroupItem>
              <ToggleGroupItem value="push_only" className="text-[11px]">Push only</ToggleGroupItem>
              <ToggleGroupItem value="pull_only" className="text-[11px]">Pull only</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Separator />

          {/* Conflict Strategy */}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Conflict Strategy</p>
          <select value={conflictStrategy} onChange={e => setConflictStrategy(e.target.value as ConflictStrategy)}
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs">
            <option value="manual">Manual — review each conflict</option>
            <option value="local_wins">Local wins — keep local changes</option>
            <option value="remote_wins">Remote wins — keep remote changes</option>
            <option value="timestamp">Timestamp — most recent wins</option>
          </select>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={!canSave}>{isEdit ? 'Save' : 'Connect'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
