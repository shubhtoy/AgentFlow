'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  GitBranch, RefreshCw, Search, Unplug, Plus, AlertTriangle, Loader2,
  CheckCircle2, XCircle, Circle, AlertCircle, Key, ShieldCheck,
  ShieldAlert, ChevronDown, ChevronRight, Github, FolderGit2,
  Globe, Lock, Copy,
} from 'lucide-react'
import { useAppStore } from '@/store'
import type { GitRepoStatus, RepoMapping } from '@/lib/api'
import { FeatureHint } from './onboarding/FeatureHint'
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
  const [cloneUrl, setCloneUrl] = useState('')
  const [cloning, setCloning] = useState(false)
  const [cloneError, setCloneError] = useState<string | null>(null)
  const [cloneAuthNeeded, setCloneAuthNeeded] = useState(false)

  // Auth state
  const [gitUser, setGitUser] = useState<string | null>(null)
  const [deviceCode, setDeviceCode] = useState<{ user_code: string; verification_uri: string; device_code: string; interval: number } | null>(null)
  const [authPolling, setAuthPolling] = useState(false)
  const [showPat, setShowPat] = useState(false)
  const [patInput, setPatInput] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Check stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('af-git-token')
    if (token) {
      fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.login) setGitUser(d.login) })
        .catch(() => {})
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const startDeviceFlow = async () => {
    try {
      const res = await fetch('/api/auth/github', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      })
      const data = await res.json()
      if (data.error) { setShowPat(true); return } // fallback to PAT if device flow unavailable
      setDeviceCode(data)
      navigator.clipboard.writeText(data.user_code).catch(() => {})
      window.open(data.verification_uri, '_blank')
      setAuthPolling(true)
      pollRef.current = setInterval(async () => {
        try {
          const poll = await fetch('/api/auth/github', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'poll', device_code: data.device_code }),
          }).then(r => r.json())
          if (poll.access_token) {
            clearInterval(pollRef.current!); pollRef.current = null
            localStorage.setItem('af-git-token', poll.access_token)
            setAuthPolling(false); setDeviceCode(null)
            // Fetch user info
            const user = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${poll.access_token}` } }).then(r => r.json())
            setGitUser(user.login)
          }
          if (poll.error === 'expired_token') { clearInterval(pollRef.current!); pollRef.current = null; setAuthPolling(false); setDeviceCode(null) }
        } catch {}
      }, (data.interval || 5) * 1000)
    } catch { setShowPat(true) }
  }

  const savePat = () => {
    if (!patInput.trim()) return
    localStorage.setItem('af-git-token', patInput.trim())
    fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${patInput.trim()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.login) setGitUser(d.login) })
      .catch(() => {})
    setPatInput(''); setShowPat(false)
  }

  const signOut = () => { localStorage.removeItem('af-git-token'); setGitUser(null) }

  const handleClone = async () => {
    if (!cloneUrl.trim()) return
    setCloning(true); setCloneError(null)
    const name = cloneUrl.trim().split('/').pop()?.replace('.git', '') || 'repo'
    try {
      await connectRepo({ url: cloneUrl.trim(), name, branch: 'main', role: 'primary', repoType: 'public' })
      setCloneUrl('')
      loadedRef.current = false; loadRepos()
    } catch (err: any) {
      const msg = err.message || 'Clone failed'
      if (msg.includes('401') || msg.includes('auth') || msg.includes('403')) {
        setCloneAuthNeeded(true); setCloneError('Authentication required — sign in above')
      } else { setCloneError(msg) }
    } finally { setCloning(false) }
  }
  const [reposOpen, setReposOpen] = useState(true)
  const loadedRef = useRef(false)


  const loadRepos = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { getStatus } = await import('@/lib/git-client')
      const status = await getStatus()
      if (status.files > 0) {
        setRepoStates([{
          name: 'workspace',
          url: '',
          branch: status.branch,
          localPath: '/',
          repoType: 'private',
          role: 'primary',
          agentflowPath: '.agentflow',
          status: { isRepo: true, branch: status.branch, modifiedFiles: [], untrackedFiles: [], hasRemote: false, remoteUrl: null },
          loading: false,
          syncing: false,
        }])
      } else {
        setRepoStates([])
      }
    } catch {
      setRepoStates([])
    }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (!loadedRef.current) { loadedRef.current = true; loadRepos() } }, [loadRepos])

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
    const onRefresh = () => { loadedRef.current = false; loadRepos() }
    window.addEventListener('agentflow:git-refresh', onRefresh)
    return () => window.removeEventListener('agentflow:git-refresh', onRefresh)
  }, [loadRepos])

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <div className="relative flex-1 overflow-y-auto">
        {/* Auth */}
        <div className="px-3 py-2 border-b border-border/30">
          {gitUser ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span className="text-xs flex-1">Signed in as <strong>{gitUser}</strong></span>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground" onClick={signOut}>Sign out</Button>
            </div>
          ) : deviceCode ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Enter this code on GitHub:</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold tracking-widest text-primary">{deviceCode.user_code}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigator.clipboard.writeText(deviceCode.user_code)}>
                  <Copy size={12} />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {authPolling && <Loader2 size={11} className="animate-spin text-muted-foreground" />}
                <span className="text-[10px] text-muted-foreground flex-1">{authPolling ? 'Waiting for authorization…' : ''}</span>
                <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => window.open(deviceCode.verification_uri, '_blank')}>Open GitHub</Button>
                <Button variant="ghost" size="sm" className="h-5 text-[10px] text-muted-foreground" onClick={() => { if (pollRef.current) clearInterval(pollRef.current); setDeviceCode(null); setAuthPolling(false) }}>Cancel</Button>
              </div>
            </div>
          ) : showPat ? (
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <input type="password" value={patInput} onChange={e => setPatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && savePat()} placeholder="Paste token..." className="flex-1 h-7 px-2 text-xs rounded-md border border-border bg-background" />
                <Button size="sm" className="h-7 text-xs" onClick={savePat} disabled={!patInput.trim()}>Save</Button>
              </div>
              <a href="https://github.com/settings/tokens/new?scopes=repo&description=AgentFlow" target="_blank" rel="noopener" className="text-[10px] text-primary underline">Create token on GitHub ↗</a>
              <Button variant="ghost" size="sm" className="h-5 text-[10px] text-muted-foreground" onClick={() => setShowPat(false)}>← Back</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Github size={14} className="text-muted-foreground" />
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={startDeviceFlow}>Sign in with GitHub</Button>
              <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground" onClick={() => setShowPat(true)}>Use token</Button>
            </div>
          )}
        </div>

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
      <div className="p-2 space-y-2">
        <div className="flex gap-1.5">
          <input
            value={cloneUrl}
            onChange={e => { setCloneUrl(e.target.value); setCloneError(null); setCloneAuthNeeded(false) }}
            onKeyDown={e => e.key === 'Enter' && handleClone()}
            placeholder="Paste repo URL to clone..."
            className="flex-1 h-8 px-2.5 text-xs rounded-md border border-border bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <Button size="sm" className="h-8 text-xs px-3" onClick={handleClone} disabled={cloning || !cloneUrl.trim()}>
            {cloning ? <Loader2 size={12} className="animate-spin" /> : 'Clone'}
          </Button>
        </div>
        {cloneError && <p className="text-[10px] text-destructive px-0.5">{cloneError}</p>}
      </div>
    </div>
  )
}

export { GitPanelContent as GitPanel, GitPanelContent }

export function GitActionButton() {
  return null // Popover version removed — use GitPanelContent in panel instead
}
