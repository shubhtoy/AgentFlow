'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle2, Key, Terminal, Github, Globe, Loader2, Copy, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface SshKey { type: string; filename: string; fingerprint: string | null }
interface ProviderInfo { id: string; name: string; oauth: boolean; deviceFlow: boolean; tokenUrl: string; tokenHint: string }

export interface AuthState {
  username: string | null
  provider: string | null
  transport: 'ssh' | 'https'
}

interface Props {
  auth: AuthState
  onAuthChange: (auth: AuthState) => void
}

export function ConnectionStatus({ auth, onAuthChange }: Props) {
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [localMode, setLocalMode] = useState(false)
  const [sshKeys, setSshKeys] = useState<SshKey[]>([])
  const [view, setView] = useState<'status' | 'signin' | 'pat' | 'device' | 'transport'>('status')
  const [patInput, setPatInput] = useState('')
  const [deviceCode, setDeviceCode] = useState<{ user_code: string; verification_uri: string; device_code: string; interval: number } | null>(null)
  const [devicePolling, setDevicePolling] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/git').then(r => r.json()).then(d => {
      setProviders(d.providers || []); setLocalMode(d.localMode)
      if (d.ssh?.keys?.length) setSshKeys(d.ssh.keys)
    }).catch(() => {})

    // Restore existing session
    fetch('/api/auth/session').then(r => r.json()).then(s => {
      if (s?.user?.name) {
        if ((s as any).accessToken) localStorage.setItem('af-git-token', (s as any).accessToken)
        onAuthChange({ username: s.user.name, provider: (s as any).provider || 'github', transport: 'https' })
      }
    }).catch(() => {})

    // Restore token
    const token = localStorage.getItem('af-git-token')
    if (token) {
      fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.login) onAuthChange({ username: d.login, provider: 'github', transport: sshKeys.length > 0 && localMode ? 'ssh' : 'https' }) })
        .catch(() => {})
    }

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // Auto-select best transport when SSH keys load
  useEffect(() => {
    if (auth.username && localMode && sshKeys.length > 0 && auth.transport === 'https') {
      onAuthChange({ ...auth, transport: 'ssh' })
    }
  }, [sshKeys, localMode])

  const resolveIdentity = useCallback(async (token: string) => {
    localStorage.setItem('af-git-token', token)
    const transport = localMode && sshKeys.length > 0 ? 'ssh' : 'https'
    try {
      const d = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null)
      onAuthChange({ username: d?.login || 'authenticated', provider: d?.login ? 'github' : 'token', transport })
    } catch {
      onAuthChange({ username: 'authenticated', provider: 'token', transport })
    }
    setView('status')
  }, [localMode, sshKeys, onAuthChange])

  const handleDeviceFlow = useCallback(async () => {
    const res = await fetch('/api/auth/device', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) }).then(r => r.json())
    if (res.error || !res.user_code) { setView('pat'); return }
    setDeviceCode(res); setView('device')
    navigator.clipboard.writeText(res.user_code).catch(() => {})
    window.open(res.verification_uri, '_blank')
    setDevicePolling(true)
    pollRef.current = setInterval(async () => {
      const poll = await fetch('/api/auth/device', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'poll', device_code: res.device_code }) }).then(r => r.json()).catch(() => ({}))
      if (poll.access_token) {
        clearInterval(pollRef.current!); pollRef.current = null; setDevicePolling(false); setDeviceCode(null)
        await resolveIdentity(poll.access_token)
      }
      if (poll.error === 'expired_token') { clearInterval(pollRef.current!); pollRef.current = null; setDevicePolling(false); setDeviceCode(null); setView('signin') }
    }, (res.interval || 5) * 1000)
  }, [resolveIdentity])

  const handleSavePat = useCallback(() => {
    if (!patInput.trim()) return
    resolveIdentity(patInput.trim())
    setPatInput('')
  }, [patInput, resolveIdentity])

  const handleSignOut = useCallback(async () => {
    localStorage.removeItem('af-git-token')
    onAuthChange({ username: null, provider: null, transport: 'https' })
    await fetch('/api/auth/signout', { method: 'POST' }).catch(() => {})
    setView('status')
  }, [onAuthChange])

  // ── Signed in ──
  if (auth.username && view !== 'transport') {
    const TransportIcon = auth.transport === 'ssh' ? Terminal : Globe
    const transportLabel = auth.transport === 'ssh' ? `SSH (${sshKeys[0]?.filename || 'key'})` : 'HTTPS + token'
    return (
      <div className="px-3.5 py-2.5 border-b border-border/30 space-y-1.5">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
          <span className="text-xs font-medium flex-1">{auth.username}</span>
          {auth.provider && auth.provider !== 'token' && (
            <Badge variant="outline" className="h-5 text-[10px] gap-1">
              <Github size={10} /> {auth.provider}
            </Badge>
          )}
          <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground" onClick={handleSignOut}>Sign out</Button>
        </div>
        <div className="flex items-center gap-1.5 pl-[22px]">
          <TransportIcon size={11} className="text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground flex-1">{transportLabel}</span>
          {localMode && sshKeys.length > 0 && (
            <Button variant="ghost" size="sm" className="h-5 text-[9px] text-muted-foreground/60" onClick={() => setView('transport')}>
              <Settings2 size={9} className="mr-0.5" /> Transport
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ── Transport picker (only when signed in + local mode with SSH) ──
  if (view === 'transport' && auth.username) {
    return (
      <div className="px-3.5 py-3 border-b border-border/30 space-y-2">
        <p className="text-xs font-medium">Clone/push transport</p>
        <div className="space-y-1">
          <button onClick={() => { onAuthChange({ ...auth, transport: 'ssh' }); setView('status') }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors text-left ${auth.transport === 'ssh' ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-accent/50'}`}>
            <Terminal size={14} className={auth.transport === 'ssh' ? 'text-primary' : 'text-muted-foreground'} />
            <div className="flex-1">
              <p className="text-xs font-medium">SSH</p>
              <p className="text-[10px] text-muted-foreground">{sshKeys.map(k => k.filename).join(', ')}</p>
            </div>
            {auth.transport === 'ssh' && <Badge variant="outline" className="text-[9px] h-4 text-primary border-primary/30">Active</Badge>}
          </button>
          <button onClick={() => { onAuthChange({ ...auth, transport: 'https' }); setView('status') }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors text-left ${auth.transport === 'https' ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-accent/50'}`}>
            <Globe size={14} className={auth.transport === 'https' ? 'text-primary' : 'text-muted-foreground'} />
            <div className="flex-1">
              <p className="text-xs font-medium">HTTPS + Token</p>
              <p className="text-[10px] text-muted-foreground">Uses your access token for auth</p>
            </div>
            {auth.transport === 'https' && <Badge variant="outline" className="text-[9px] h-4 text-primary border-primary/30">Active</Badge>}
          </button>
        </div>
        <Button variant="ghost" size="sm" className="h-5 text-[10px] text-muted-foreground" onClick={() => setView('status')}>← Back</Button>
      </div>
    )
  }

  // ── Device flow ──
  if (view === 'device' && deviceCode) {
    return (
      <div className="px-3.5 py-3 border-b border-border/30 space-y-2">
        <p className="text-xs text-muted-foreground">Enter this code on GitHub:</p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold tracking-widest text-primary">{deviceCode.user_code}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigator.clipboard.writeText(deviceCode.user_code)}><Copy size={12} /></Button>
        </div>
        <div className="flex items-center gap-2">
          {devicePolling && <Loader2 size={11} className="animate-spin text-muted-foreground" />}
          <span className="text-[10px] text-muted-foreground flex-1">{devicePolling ? 'Waiting for authorization…' : ''}</span>
          <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => window.open(deviceCode.verification_uri, '_blank')}>Open GitHub</Button>
          <Button variant="ghost" size="sm" className="h-5 text-[10px] text-muted-foreground" onClick={() => { if (pollRef.current) clearInterval(pollRef.current); setDeviceCode(null); setDevicePolling(false); setView('signin') }}>Cancel</Button>
        </div>
      </div>
    )
  }

  // ── PAT input ──
  if (view === 'pat') {
    return (
      <div className="px-3.5 py-3 border-b border-border/30 space-y-2">
        <p className="text-xs font-medium">Personal Access Token</p>
        <div className="flex gap-1.5">
          <Input type="password" value={patInput} onChange={e => setPatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSavePat()} placeholder="ghp_... or glpat-..." className="flex-1 h-8 text-xs font-mono" autoFocus />
          <Button size="sm" className="h-8 text-xs" onClick={handleSavePat} disabled={!patInput.trim()}>Save</Button>
        </div>
        <div className="flex items-center gap-3">
          {providers.filter(p => p.tokenUrl).map(p => (
            <a key={p.id} href={p.tokenUrl} target="_blank" rel="noopener" className="text-[10px] text-primary hover:underline">{p.name} ↗</a>
          ))}
          <Button variant="ghost" size="sm" className="h-5 text-[10px] text-muted-foreground ml-auto" onClick={() => setView('signin')}>← Back</Button>
        </div>
      </div>
    )
  }

  // ── Sign in options (identity first) ──
  const hasDeviceFlow = providers.some(p => p.deviceFlow)
  const oauthProviders = providers.filter(p => p.oauth)

  return (
    <div className="px-3.5 py-3 border-b border-border/30 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Sign in to connect repositories</p>

      {/* GitHub device flow — primary */}
      {hasDeviceFlow && (
        <button onClick={handleDeviceFlow} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-left">
          <Github size={16} className="text-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">Sign in with GitHub</p>
            <p className="text-[10px] text-muted-foreground">Authorize in browser — no secrets needed</p>
          </div>
        </button>
      )}

      {/* PAT — universal fallback */}
      <button onClick={() => setView('pat')} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left">
        <Key size={15} className="text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium">Use access token</p>
          <p className="text-[10px] text-muted-foreground">Works with GitHub, GitLab, Bitbucket, Gitea</p>
        </div>
      </button>

      {/* OAuth — if server configured */}
      {oauthProviders.length > 0 && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className="text-[10px] text-muted-foreground/50">or</span>
          {oauthProviders.map(p => (
            <Button key={p.id} variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => { window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(window.location.href)}` }}>
              {p.id === 'github' ? <Github size={11} /> : <Globe size={11} />} {p.name}
            </Button>
          ))}
        </div>
      )}

      {/* SSH hint */}
      {localMode && sshKeys.length > 0 && (
        <p className="text-[10px] text-emerald-600 flex items-center gap-1 pt-0.5">
          <Terminal size={10} /> SSH keys detected — will be used for clone/push after sign in
        </p>
      )}
    </div>
  )
}
