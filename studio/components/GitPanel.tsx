'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  GitBranch, RefreshCw, Search, Unplug, Plus, AlertTriangle,
  CheckCircle2, XCircle, Circle, AlertCircle, Key, ShieldCheck,
  ShieldAlert, ChevronDown, ChevronRight, Github, FolderGit2,
  Globe, Lock, Copy, Loader2,
} from 'lucide-react'
import { useAppStore } from '@/store'
import type { GitRepoStatus, GitAuthInfo, GitAuthMethod, RepoMapping } from '@/lib/api'
import { FeatureHint } from './onboarding/FeatureHint'
import { RepoConfigDialog } from './RepoConfigDialog'
import type { RepoConfigFormData } from './RepoConfigDialog'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip'

interface RepoWithStatus extends RepoMapping { status: GitRepoStatus | null; loading: boolean; syncing: boolean }

function statusLabel(s: GitRepoStatus | null) {
  if (!s) return 'Loading…'; if (!s.isRepo) return 'Not cloned'; if (!s.isClean) return 'Changes'; return 'Clean'
}

function statusColorClass(s: GitRepoStatus | null) {
  if (!s) return 'text-muted-foreground'; if (!s.isRepo) return 'text-destructive'; if (!s.isClean) return 'text-yellow-500'; return 'text-green-500'
}

function SectionHeader({ title, count, open, onToggle }: { title: string; count?: number; open: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} className="px-3 py-1.5 flex items-center gap-1 cursor-pointer select-none hover:bg-accent">
      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
      {count !== undefined && count > 0 && <Badge variant="secondary" className="h-4 text-[9px] ml-auto">{count}</Badge>}
    </div>
  )
}

function AuthSection({ authInfo, loading, onRefresh }: { authInfo: GitAuthInfo | null; loading: boolean; onRefresh: () => void }) {
  const [open, setOpen] = useState(true)
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [user, setUser] = useState<string | null>(null)
  const hasToken = (authInfo?.methods.length ?? 0) > 0

  useEffect(() => {
    // Check if we have a stored token and verify it
    const stored = localStorage.getItem('af-git-token')
    if (stored) {
      fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${stored}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.login) setUser(d.login) })
        .catch(() => {})
    }
  }, [])

  const saveToken = async () => {
    if (!token.trim()) return
    setSaving(true); setVerifying(true)
    try {
      const res = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token.trim()}` } })
      if (!res.ok) throw new Error('Invalid token')
      const data = await res.json()
      localStorage.setItem('af-git-token', token.trim())
      setUser(data.login)
      setToken('')
      onRefresh()
    } catch {
      setUser(null)
    }
    finally { setSaving(false); setVerifying(false) }
  }

  const logout = () => {
    localStorage.removeItem('af-git-token')
    setUser(null)
    onRefresh()
  }

  return (
    <>
      <SectionHeader title="Authentication" count={user ? 1 : 0} open={open} onToggle={() => setOpen(o => !o)} />
      {open && (
        <div className="px-3 pb-2">
          {user ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-green-500" />
              <span className="text-xs flex-1">Signed in as <strong>{user}</strong></span>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground" onClick={logout}>Sign out</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] text-muted-foreground">
                Enter a <a href="https://github.com/settings/tokens/new?scopes=repo&description=AgentFlow" target="_blank" rel="noopener" className="text-primary underline">GitHub Personal Access Token</a> for private repos.
              </p>
              <div className="flex gap-1.5">
                <input
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveToken()}
                  placeholder="ghp_..."
                  className="flex-1 h-7 px-2 text-xs rounded-md border border-border bg-background placeholder:text-muted-foreground/50"
                />
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={saveToken} disabled={saving || !token.trim()}>
                  {saving ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/60">Token is stored locally in your browser. Public repos work without auth.</p>
            </div>
          )}
        </div>
      )}
    </>
  )
  )
}

function RepoCard({ repo, onSync, onScan, onDisconnect }: { repo: RepoWithStatus; onSync: () => void; onScan: () => void; onDisconnect: () => void }) {
  const s = repo.status; const isRepo = s?.isRepo ?? false; const clrClass = statusColorClass(s)
  return (
    <div className="mx-2 mb-1 p-2.5 rounded-md border border-border/50 hover:bg-accent/30 transition-colors">
      <div className="flex items-center gap-1.5 mb-1">
        {repo.loading ? <Loader2 size={14} className={`animate-spin ${clrClass}`} /> : <span className={clrClass}>{isRepo ? <FolderGit2 size={14} /> : <XCircle size={14} />}</span>}
        <span className="text-xs font-semibold flex-1 truncate">{repo.name}</span>
        {s?.branch && <Badge variant="outline" className="h-[18px] text-[9px]"><GitBranch size={9} className="mr-0.5" />{s.branch}</Badge>}
        <Badge variant="outline" className="h-[18px] text-[9px] capitalize">{repo.role}</Badge>
      </div>
      {!repo.loading && (
        <div className="flex flex-col gap-0.5 ml-5 mb-1">
          <div className="flex items-center gap-1"><Circle size={6} className={clrClass} /><span className={`text-[10px] font-medium ${clrClass}`}>{statusLabel(s)}</span></div>
          {(s?.remoteUrl || repo.url) && <p className="text-[9px] text-muted-foreground font-mono truncate">{s?.remoteUrl || repo.url}</p>}
          {isRepo && s && (
            <div className="flex gap-1 flex-wrap mt-0.5">
              {s.ahead > 0 && <Badge variant="outline" className="h-4 text-[9px]">↑ {s.ahead}</Badge>}
              {s.behind > 0 && <Badge variant="outline" className="h-4 text-[9px]">↓ {s.behind}</Badge>}
              {s.modifiedFiles.length > 0 && <Badge variant="outline" className="h-4 text-[9px]">{s.modifiedFiles.length} modified</Badge>}
            </div>
          )}
        </div>
      )}
      <div className="flex gap-0.5 ml-4">
        {isRepo ? (
          <>
            <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6" onClick={onSync} disabled={repo.syncing}>{repo.syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}</Button></TooltipTrigger><TooltipContent>Sync</TooltipContent></Tooltip></TooltipProvider>
            <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6" onClick={onScan} disabled={repo.loading}><Search size={12} /></Button></TooltipTrigger><TooltipContent>Scan</TooltipContent></Tooltip></TooltipProvider>
          </>
        ) : (
          <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={onSync} disabled={repo.syncing}>
            {repo.syncing ? <Loader2 size={10} className="mr-1 animate-spin" /> : <FolderGit2 size={11} className="mr-1" />} Init Repo
          </Button>
        )}
        <div className="flex-1" />
        <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={onDisconnect}><Unplug size={11} /></Button></TooltipTrigger><TooltipContent>Disconnect</TooltipContent></Tooltip></TooltipProvider>
      </div>
    </div>
  )
}

function GitPanelContent() {
  const triggerSync = useAppStore(s => s.triggerSync)
  const triggerScan = useAppStore(s => s.triggerScan)
  const fetchGitStatus = useAppStore(s => s.fetchGitStatus)
  const connectRepo = useAppStore(s => s.connectRepo)
  const [repoStates, setRepoStates] = useState<RepoWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [authInfo, setAuthInfo] = useState<GitAuthInfo | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [reposOpen, setReposOpen] = useState(true)
  const loadedRef = useRef(false)

  const refreshAuth = useCallback(() => {
    setAuthLoading(false)
    // Client-side git uses token auth stored in localStorage
    const token = localStorage.getItem('af-git-token')
    setAuthInfo({
      methods: token ? [{ type: 'env-token', label: 'Personal Access Token', ready: true }] : [],
      recommended: 'https',
      sshExample: '',
      httpsExample: 'https://github.com/user/repo.git',
    })
  }, [])

  const loadRepos = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { getDirectoryHandle } = await import('@/lib/workspace/browser-adapter')
      const dir = getDirectoryHandle()
      if (!dir) { setRepoStates([]); return }
      const { status } = await import('@/lib/git-client')
      const gitStatus = await status(dir)
      if (gitStatus.isRepo) {
        setRepoStates([{
          name: gitStatus.remoteUrl?.split('/').pop()?.replace('.git', '') || 'workspace',
          url: gitStatus.remoteUrl || '',
          branch: gitStatus.branch,
          localPath: '/',
          repoType: 'private',
          role: 'primary',
          agentflowPath: '.agentflow',
          status: gitStatus,
          loading: false,
          syncing: false,
        }])
      } else {
        setRepoStates([])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load git status'
      setError(msg)
    }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (!loadedRef.current) { loadedRef.current = true; loadRepos(); refreshAuth() } }, [loadRepos, refreshAuth])

  const handleSync = useCallback(async (repoName: string) => {
    setRepoStates(prev => prev.map(r => r.name === repoName ? { ...r, syncing: true } : r))
    try {
      const { getDirectoryHandle } = await import('@/lib/workspace/browser-adapter')
      const { pull } = await import('@/lib/git-client')
      const dir = getDirectoryHandle()
      if (dir) await pull(dir, localStorage.getItem('af-git-token') || undefined)
      await loadRepos()
    } catch { setRepoStates(prev => prev.map(r => r.name === repoName ? { ...r, syncing: false } : r)) }
  }, [triggerSync])

  const handleScan = useCallback(async (repo: RepoWithStatus) => {
    setRepoStates(prev => prev.map(r => r.name === repo.name ? { ...r, loading: true } : r))
    try { await triggerScan({ dir: repo.localPath }); setRepoStates(prev => prev.map(r => r.name === repo.name ? { ...r, loading: false } : r)) }
    catch { setRepoStates(prev => prev.map(r => r.name === repo.name ? { ...r, loading: false } : r)) }
  }, [triggerScan])

  const handleDisconnect = useCallback(async (repoName: string) => {
    try { setRepoStates(prev => prev.filter(r => r.name !== repoName)) } catch {}
  }, [fetchGitStatus])

  // Listen for external refresh trigger (from FloatingPanel header button)
  useEffect(() => {
    const onRefresh = () => { loadedRef.current = false; loadRepos(); refreshAuth() }
    window.addEventListener('agentflow:git-refresh', onRefresh)
    return () => window.removeEventListener('agentflow:git-refresh', onRefresh)
  }, [loadRepos, refreshAuth])

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <div className="relative flex-1 overflow-y-auto">
        <FeatureHint id="git" text="Clone repos, commit changes, and sync branches — all from within the studio." show side="bottom" />
        <AuthSection authInfo={authInfo} loading={authLoading} onRefresh={refreshAuth} />
        <Separator />
        <SectionHeader title="Repositories" count={repoStates.length} open={reposOpen} onToggle={() => setReposOpen(o => !o)} />
        {reposOpen && (
          <>
            {loading && repoStates.length === 0 ? <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin" /></div>
            : error ? <div className="px-3 py-4 text-center"><AlertTriangle size={18} className="mx-auto text-yellow-500" /><p className="text-[11px] text-muted-foreground mt-1">{error}</p><Button size="sm" onClick={loadRepos} className="mt-1 text-[10px]">Retry</Button></div>
            : repoStates.length === 0 ? <div className="px-3 py-4 text-center"><FolderGit2 size={20} className="mx-auto text-muted-foreground" /><p className="text-[11px] text-muted-foreground mt-1.5">No repos connected yet</p></div>
            : <div className="pb-1">{repoStates.map(repo => <RepoCard key={repo.name} repo={repo} onSync={() => handleSync(repo.name)} onScan={() => handleScan(repo)} onDisconnect={() => handleDisconnect(repo.name)} />)}</div>}
          </>
        )}
      </div>
      <Separator />
      <div className="p-2"><Button variant="outline" size="sm" className="w-full" onClick={() => setConfigOpen(true)}><Plus size={13} className="mr-1" /> Connect Repo</Button></div>
      <RepoConfigDialog open={configOpen} onClose={() => setConfigOpen(false)} onSave={async (data: RepoConfigFormData) => { setConfigOpen(false); await connectRepo({ url: data.mapping.url, name: data.mapping.name, role: data.mapping.role, branch: data.mapping.branch, repoType: data.mapping.repoType }); loadedRef.current = false; loadRepos() }} />
    </div>
  )
}

export { GitPanelContent as GitPanel, GitPanelContent }

export function GitActionButton() {
  return null // Popover version removed — use GitPanelContent in panel instead
}
