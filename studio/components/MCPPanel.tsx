'use client'

// ---------------------------------------------------------------------------
// MCPPanel — MCP server management with full config, auth, metadata, test
// ---------------------------------------------------------------------------
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Server, Search, RefreshCw, ChevronRight, Wrench, Trash2, Copy,
  Plus, Download, ExternalLink, Radio, Wifi, Info, Key, Settings2,
  AlertTriangle, Loader2, Check, X, Shield, Terminal, Globe,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { FeatureHint } from './onboarding/FeatureHint'
import { Separator } from './ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from './ui/dialog'
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from './ui/tooltip'

// ── Types ──

interface MCPServerEntry {
  name: string; command: string; args: string[]; env: Record<string, string>
  disabled: boolean; autoApprove: string[]; status: string; toolCount: number
  tools: { name: string; description: string }[]; registryName?: string
  description?: string; version?: string; url?: string
}

interface MCPConfig { servers: MCPServerEntry[]; configPath: string }

interface EnvVarDef {
  name: string; description: string; isRequired: boolean
  isSecret?: boolean; format?: string; defaultValue?: string
}

interface RegistryEntry {
  name: string; description: string; version?: string
  packages: { registryType: string; identifier: string; transport: { type: string } }[]
  remotes: { type: string; url: string; headers?: { name: string; description: string; isRequired: boolean; value?: string }[] }[]
  repository?: { url: string; source: string } | null; websiteUrl?: string | null
  publishedAt?: string | null; updatedAt?: string | null; isLatest?: boolean
  environmentVariables?: EnvVarDef[]
}

// ── Helpers ──

function shortName(s: string) { const p = s.split('/'); return p[p.length - 1] || s }

function dedupeByName(entries: RegistryEntry[]) {
  const m = new Map<string, RegistryEntry>()
  for (const e of entries) { if (!m.has(e.name) || e.isLatest) m.set(e.name, e) }
  return Array.from(m.values())
}

function transportLabel(server: MCPServerEntry) {
  if (server.url) return server.url.includes('/sse') ? 'SSE' : 'HTTP'
  if (server.command) return 'stdio'
  return '?'
}

function hasUnsetEnv(env: Record<string, string>) {
  return Object.values(env).some(v => typeof v === 'string' && v.startsWith('${env:'))
}

// ── Server Card ──

function ServerCard({ server, onToggle, onRemove, onDiscover, onTest, onConfigure }: {
  server: MCPServerEntry
  onToggle: (name: string, enabled: boolean) => void
  onRemove: (name: string) => void
  onDiscover: (name: string) => void
  onTest: (name: string) => Promise<any>
  onConfigure: (server: MCPServerEntry) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const isMisconfigured = server.status === 'misconfigured'
  const transport = transportLabel(server)
  const envMissing = hasUnsetEnv(server.env || {})
  const cmdStr = server.url || `${server.command} ${(server.args || []).join(' ')}`.trim()

  const handleDiscover = async (e: React.MouseEvent) => {
    e.stopPropagation(); setDiscovering(true); await onDiscover(server.name); setDiscovering(false)
  }
  const handleTest = async (e: React.MouseEvent) => {
    e.stopPropagation(); setTesting(true); setTestResult(null)
    setTestResult(await onTest(server.name)); setTesting(false)
  }

  return (
    <div className={`rounded-lg border overflow-hidden transition-all ${server.disabled ? 'opacity-60 bg-muted/30' : 'bg-card'} ${isMisconfigured ? 'border-destructive/30' : expanded ? 'border-primary/40' : 'border-border'}`}>
      {/* Header row */}
      <div onClick={() => setExpanded(e => !e)} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors">
        <div className={`w-2 h-2 rounded-full shrink-0 ${server.disabled ? 'bg-muted-foreground' : isMisconfigured ? 'bg-destructive' : envMissing ? 'bg-orange-400' : 'bg-green-500'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[0.8125rem] font-semibold truncate">{server.name}</span>
            <Badge variant="outline" className="h-4 text-[0.55rem] px-1 shrink-0">{transport}</Badge>
          </div>
          {server.description && <p className="text-[0.65rem] text-muted-foreground truncate">{server.description}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {envMissing && (
            <Tooltip><TooltipTrigger><Key size={12} className="text-orange-400" /></TooltipTrigger>
              <TooltipContent>API key / env vars need configuration</TooltipContent></Tooltip>
          )}
          {server.toolCount > 0 && (
            <Badge variant="outline" className="h-5 text-[0.6875rem]"><Wrench size={10} className="mr-0.5" />{server.toolCount}</Badge>
          )}
          <label className="relative inline-flex items-center cursor-pointer" onClick={e => e.stopPropagation()}>
            <input type="checkbox" checked={!server.disabled} onChange={e => onToggle(server.name, e.target.checked)} className="sr-only peer" />
            <div className="w-8 h-4 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4" />
          </label>
          <ChevronRight size={14} className={`text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border">
          {/* Connection info */}
          {cmdStr && !isMisconfigured && (
            <div className="px-3 pt-2 pb-1">
              <div className="flex items-center gap-1 bg-muted/50 rounded-md px-2.5 py-1.5">
                {server.url ? <Globe size={10} className="shrink-0 text-muted-foreground" /> : <Terminal size={10} className="shrink-0 text-muted-foreground" />}
                <code className="text-[0.7rem] text-muted-foreground flex-1 truncate font-mono">{cmdStr}</code>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { navigator.clipboard.writeText(cmdStr); toast.success('Copied') }}>
                  <Copy size={10} />
                </Button>
              </div>
            </div>
          )}

          {/* Auth / env status */}
          {Object.keys(server.env || {}).length > 0 && (
            <div className="px-3 py-1.5">
              <div className="flex items-center gap-1 mb-1">
                <Shield size={10} className="text-muted-foreground" />
                <span className="text-[0.65rem] font-semibold text-muted-foreground uppercase tracking-wide">Auth & Environment</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {Object.entries(server.env).map(([k, v]) => {
                  const isToken = typeof v === 'string' && v.startsWith('${env:')
                  return (
                    <div key={k} className="flex items-center gap-1.5 text-[0.65rem]">
                      {isToken ? <X size={9} className="text-orange-400 shrink-0" /> : <Check size={9} className="text-green-500 shrink-0" />}
                      <span className="font-mono truncate">{k}</span>
                      <span className={`ml-auto text-[0.6rem] ${isToken ? 'text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                        {isToken ? 'not set' : 'configured'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Metadata */}
          {(server.version || server.registryName) && (
            <div className="px-3 py-1 flex items-center gap-2 text-[0.65rem] text-muted-foreground">
              {server.version && <span>v{server.version}</span>}
              {server.registryName && <span className="truncate font-mono">{server.registryName}</span>}
            </div>
          )}

          {/* Tools */}
          {server.tools.length > 0 && (
            <div className="px-3 pb-1.5">
              <p className="text-[0.65rem] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Tools ({server.tools.length})</p>
              <div className="flex flex-col gap-0.5">
                {server.tools.slice(0, 5).map(tool => (
                  <div key={tool.name} className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/30">
                    <Wrench size={10} className="shrink-0 text-muted-foreground" />
                    <span className="text-[0.65rem] font-medium truncate">{tool.name}</span>
                    {tool.description && <span className="text-[0.55rem] text-muted-foreground truncate ml-auto">{tool.description}</span>}
                  </div>
                ))}
                {server.tools.length > 5 && <span className="text-[0.6rem] text-muted-foreground pl-2">+{server.tools.length - 5} more</span>}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-1 px-3 pb-2 pt-1 flex-wrap">
            <Button variant="outline" size="sm" className="text-[0.65rem] h-6 px-2" onClick={handleTest} disabled={testing || server.disabled || isMisconfigured}>
              {testing ? <Loader2 size={10} className="mr-1 animate-spin" /> : <Radio size={10} className="mr-1" />}
              {testing ? 'Testing…' : 'Test'}
            </Button>
            <Button variant="outline" size="sm" className="text-[0.65rem] h-6 px-2" onClick={handleDiscover} disabled={discovering || server.disabled || isMisconfigured}>
              {discovering ? <Loader2 size={10} className="mr-1 animate-spin" /> : <Download size={10} className="mr-1" />}
              {discovering ? 'Discovering…' : 'Discover'}
            </Button>
            <Button variant="outline" size="sm" className="text-[0.65rem] h-6 px-2" onClick={(e) => { e.stopPropagation(); onConfigure(server) }}>
              <Settings2 size={10} className="mr-1" /> Configure
            </Button>
            <Button variant="ghost" size="sm" className="text-[0.65rem] h-6 px-2 text-destructive ml-auto" onClick={(e) => { e.stopPropagation(); onRemove(server.name) }}>
              <Trash2 size={10} className="mr-1" /> Remove
            </Button>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`mx-3 mb-2 rounded-md px-2.5 py-1.5 text-[0.65rem] ${testResult.ok ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-destructive/10 text-destructive'}`}>
              {testResult.ok ? (
                <div className="flex items-center gap-1.5 font-medium">
                  <Wifi size={10} /> {testResult.latencyMs}ms · {testResult.toolCount} tool{testResult.toolCount !== 1 ? 's' : ''} · {testResult.transport || 'connected'}
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={10} /> {testResult.error}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Registry Card ──

function RegistryCard({ entry, onAdd, alreadyAdded }: {
  entry: RegistryEntry; onAdd: (e: RegistryEntry) => void; alreadyAdded: boolean
}) {
  const hasTransport = (entry.packages?.length ?? 0) > 0 || (entry.remotes?.length ?? 0) > 0
  const transportType = entry.remotes?.length ? 'HTTP' : entry.packages?.length ? 'stdio' : null
  const needsAuth = (entry.environmentVariables || []).length > 0 ||
    (entry.remotes || []).some(r => (r.headers || []).length > 0)

  return (
    <div className="flex gap-2.5 px-3 py-2 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-all">
      <div className="w-8 h-8 rounded-md shrink-0 flex items-center justify-center bg-primary/10 text-primary mt-0.5">
        <Server size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-[0.8rem] font-semibold truncate">{shortName(entry.name)}</span>
          {entry.repository?.url && (
            <a href={entry.repository.url} target="_blank" rel="noopener" className="text-muted-foreground hover:text-primary">
              <ExternalLink size={10} />
            </a>
          )}
        </div>
        {entry.description && <p className="text-[0.65rem] text-muted-foreground line-clamp-2 mt-0.5">{entry.description}</p>}
        <div className="flex gap-1 mt-1 flex-wrap items-center">
          {entry.version && <Badge variant="outline" className="h-4 text-[0.55rem] px-1">v{entry.version}</Badge>}
          {transportType && <Badge variant="outline" className="h-4 text-[0.55rem] px-1">{transportType}</Badge>}
          {needsAuth && <Badge variant="outline" className="h-4 text-[0.55rem] px-1 text-orange-500 border-orange-300"><Key size={8} className="mr-0.5" />auth</Badge>}
        </div>
      </div>
      <div className="shrink-0 flex items-center">
        {alreadyAdded ? (
          <Badge variant="outline" className="h-6 text-[0.65rem] text-green-600 border-green-300"><Check size={10} className="mr-0.5" />Added</Badge>
        ) : !hasTransport ? (
          <Badge variant="outline" className="h-6 text-[0.65rem] opacity-50">N/A</Badge>
        ) : (
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onAdd(entry)}><Plus size={14} /></Button>
        )}
      </div>
    </div>
  )
}

// ── Add Server Dialog — prompts for API keys upfront ──

function AddServerDialog({ open, onClose, registryEntry, onAdded }: {
  open: boolean; onClose: () => void; registryEntry: RegistryEntry | null; onAdded: () => void
}) {
  const [name, setName] = useState('')
  const [envPairs, setEnvPairs] = useState<{ key: string; value: string; description: string; required: boolean; secret: boolean }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!registryEntry || !open) return
    setName(shortName(registryEntry.name)); setError(null)

    // Collect env vars from packages + remote headers
    const vars: typeof envPairs = []
    for (const ev of (registryEntry.environmentVariables || [])) {
      if (ev.format === 'header') continue
      vars.push({ key: ev.name, value: '', description: ev.description, required: ev.isRequired, secret: !!ev.isSecret })
    }
    for (const remote of (registryEntry.remotes || [])) {
      for (const hdr of (remote.headers || [])) {
        if (!vars.some(v => v.key === hdr.name)) {
          vars.push({ key: hdr.name, value: hdr.value || '', description: hdr.description, required: hdr.isRequired, secret: true })
        }
      }
    }
    // If no vars declared but it's a remote server, hint that auth might be needed
    setEnvPairs(vars)
  }, [registryEntry, open])

  const handleAdd = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    // Warn about required but empty env vars
    const missingRequired = envPairs.filter(p => p.required && !p.value.trim())
    if (missingRequired.length > 0) {
      setError(`Required: ${missingRequired.map(p => p.key).join(', ')}. Enter values or use \${env:VAR} to read from environment.`)
      return
    }
    setSaving(true); setError(null)
    try {
      const env: Record<string, string> = {}
      for (const p of envPairs) {
        if (!p.key.trim()) continue
        // If user left it empty, use ${env:KEY} token; if they typed a value, use it directly
        env[p.key.trim()] = p.value.trim() || `\${env:${p.key.trim()}}`
      }
      const res = await fetch('/api/mcp/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), registryName: registryEntry?.name, env: Object.keys(env).length > 0 ? env : undefined }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || `HTTP ${res.status}`) }
      toast.success(`Added ${name.trim()}`)
      onAdded(); onClose()
    } catch (err: any) { setError(err.message) }
    setSaving(false)
  }

  const needsAuth = envPairs.length > 0

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server size={16} /> Add MCP Server
          </DialogTitle>
          {registryEntry?.description && (
            <DialogDescription className="text-xs">{registryEntry.description}</DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-3">
          {error && <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>}
          <div>
            <label className="text-xs font-medium">Server name</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="mt-1 font-mono text-xs h-8" autoFocus />
          </div>

          {/* Auth section */}
          {needsAuth && (
            <div className="rounded-md border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Key size={12} className="text-orange-500" />
                <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">Authentication Required</span>
              </div>
              <p className="text-[0.65rem] text-muted-foreground mb-2">
                Enter API keys directly, or leave blank to use environment variables.
              </p>
              {envPairs.map((pair, i) => (
                <div key={i} className="mb-2">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-[0.65rem] font-mono font-medium">{pair.key}</span>
                    {pair.required && <Badge variant="outline" className="h-3.5 text-[0.5rem] px-1 text-orange-500 border-orange-300">required</Badge>}
                  </div>
                  {pair.description && <p className="text-[0.6rem] text-muted-foreground mb-0.5">{pair.description}</p>}
                  <Input
                    type={pair.secret ? 'password' : 'text'}
                    placeholder={`\${env:${pair.key}} or paste value`}
                    value={pair.value}
                    onChange={e => { const n = [...envPairs]; n[i] = { ...n[i], value: e.target.value }; setEnvPairs(n) }}
                    className="font-mono text-xs h-7"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Extra env vars */}
          <div>
            <Button variant="ghost" size="sm" className="h-6 text-[0.65rem] text-muted-foreground" onClick={() => setEnvPairs(p => [...p, { key: '', value: '', description: '', required: false, secret: false }])}>
              <Plus size={10} className="mr-1" /> Add environment variable
            </Button>
            {envPairs.filter(p => !p.description && !p.required).map((pair, idx) => {
              const realIdx = envPairs.indexOf(pair)
              return (
                <div key={idx} className="flex gap-1 mt-1">
                  <Input placeholder="KEY" value={pair.key} onChange={e => { const n = [...envPairs]; n[realIdx] = { ...n[realIdx], key: e.target.value }; setEnvPairs(n) }} className="flex-1 font-mono text-xs h-7" />
                  <Input placeholder="value" value={pair.value} onChange={e => { const n = [...envPairs]; n[realIdx] = { ...n[realIdx], value: e.target.value }; setEnvPairs(n) }} className="flex-[1.5] font-mono text-xs h-7" />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEnvPairs(p => p.filter((_, j) => j !== realIdx))}><Trash2 size={10} /></Button>
                </div>
              )
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleAdd} disabled={saving}>
            {saving ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Plus size={12} className="mr-1" />}
            {saving ? 'Adding…' : 'Add Server'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Add Custom Server Dialog ──

function AddCustomDialog({ open, onClose, onAdded }: {
  open: boolean; onClose: () => void; onAdded: () => void
}) {
  const [name, setName] = useState('')
  const [transport, setTransport] = useState<'url' | 'stdio'>('url')
  const [url, setUrl] = useState('')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [envPairs, setEnvPairs] = useState<{ key: string; value: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setName(''); setUrl(''); setCommand(''); setArgs(''); setEnvPairs([]); setError(null); setTransport('url') }
  }, [open])

  const handleAdd = async () => {
    if (!name.trim()) { setError('Server name is required'); return }
    if (transport === 'url' && !url.trim()) { setError('URL is required'); return }
    if (transport === 'stdio' && !command.trim()) { setError('Command is required'); return }
    setSaving(true); setError(null)
    try {
      const env: Record<string, string> = {}
      for (const p of envPairs) { if (p.key.trim()) env[p.key.trim()] = p.value || `\${env:${p.key.trim()}}` }

      // Build a source object that config-manager.addServer understands
      const source: any = { name: name.trim(), packages: [], remotes: [] }
      if (transport === 'url') {
        source.remotes = [{ type: url.includes('/sse') ? 'sse' : 'streamable-http', url: url.trim() }]
      } else {
        const parts = command.trim().split(/\s+/)
        const cmd = parts[0]
        const cmdArgs = [...parts.slice(1), ...args.split(/\s+/).filter(Boolean)]
        source.packages = [{ registryType: cmd === 'uvx' ? 'pypi' : 'npm', identifier: cmdArgs[cmdArgs.length - 1] || cmd, transport: { type: 'stdio' } }]
      }

      const res = await fetch('/api/mcp/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), env: Object.keys(env).length > 0 ? env : undefined }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || `HTTP ${res.status}`) }

      // If it's a URL server, update the config directly with the url field
      // If stdio, update with command/args since addServer may not handle raw command strings
      const updateBody: any = { name: name.trim() }
      if (transport === 'url') {
        // Patch the server entry to set the url directly
        await fetch('/api/mcp/update', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), url: url.trim() }),
        })
      }

      toast.success(`Added ${name.trim()}`)
      onAdded(); onClose()
    } catch (err: any) { setError(err.message) }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server size={16} /> Add Custom MCP Server
          </DialogTitle>
          <DialogDescription className="text-xs">
            Connect to any MCP server by URL or local command.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {error && <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>}

          <div>
            <label className="text-xs font-medium">Server name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="my-server" className="mt-1 font-mono text-xs h-8" autoFocus />
          </div>

          {/* Transport toggle */}
          <div className="flex gap-1 p-0.5 bg-muted rounded-md">
            <button onClick={() => setTransport('url')} className={`flex-1 text-xs py-1.5 rounded transition-colors ${transport === 'url' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
              <Globe size={11} className="inline mr-1" />URL (HTTP/SSE)
            </button>
            <button onClick={() => setTransport('stdio')} className={`flex-1 text-xs py-1.5 rounded transition-colors ${transport === 'stdio' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
              <Terminal size={11} className="inline mr-1" />Command (stdio)
            </button>
          </div>

          {transport === 'url' ? (
            <div>
              <label className="text-xs font-medium">Server URL</label>
              <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="http://localhost:3001/mcp" className="mt-1 font-mono text-xs h-8" />
              <p className="text-[0.6rem] text-muted-foreground mt-1">Use /mcp for Streamable HTTP or /sse for SSE transport</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium">Command</label>
                <Input value={command} onChange={e => setCommand(e.target.value)} placeholder="npx -y @modelcontextprotocol/server-filesystem" className="mt-1 font-mono text-xs h-8" />
              </div>
              <div>
                <label className="text-xs font-medium">Additional arguments</label>
                <Input value={args} onChange={e => setArgs(e.target.value)} placeholder="/path/to/allowed/dir" className="mt-1 font-mono text-xs h-8" />
              </div>
            </div>
          )}

          {/* Env vars */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Environment variables</label>
              <Button variant="ghost" size="sm" className="h-5 text-[0.6rem]" onClick={() => setEnvPairs(p => [...p, { key: '', value: '' }])}>
                <Plus size={9} className="mr-0.5" /> Add
              </Button>
            </div>
            {envPairs.length === 0 && <p className="text-[0.6rem] text-muted-foreground mt-1">None — add if the server needs API keys</p>}
            {envPairs.map((pair, i) => (
              <div key={i} className="flex gap-1 mt-1">
                <Input placeholder="KEY" value={pair.key} onChange={e => { const n = [...envPairs]; n[i] = { ...n[i], key: e.target.value }; setEnvPairs(n) }} className="flex-1 font-mono text-xs h-7" />
                <Input placeholder="value" type="password" value={pair.value} onChange={e => { const n = [...envPairs]; n[i] = { ...n[i], value: e.target.value }; setEnvPairs(n) }} className="flex-[1.5] font-mono text-xs h-7" />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEnvPairs(p => p.filter((_, j) => j !== i))}><Trash2 size={10} /></Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleAdd} disabled={saving}>
            {saving ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Plus size={12} className="mr-1" />}
            {saving ? 'Adding…' : 'Add Server'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Configure Server Dialog — edit env vars / auth after adding ──

function ConfigureDialog({ open, onClose, server, onSaved }: {
  open: boolean; onClose: () => void; server: MCPServerEntry | null; onSaved: () => void
}) {
  const [envPairs, setEnvPairs] = useState<{ key: string; value: string }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!server || !open) return
    setEnvPairs(Object.entries(server.env || {}).map(([key, value]) => ({ key, value })))
  }, [server, open])

  const handleSave = async () => {
    if (!server) return
    setSaving(true)
    const env: Record<string, string> = {}
    for (const p of envPairs) { if (p.key.trim()) env[p.key.trim()] = p.value }
    try {
      const res = await fetch('/api/mcp/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: server.name, env }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success(`Updated ${server.name}`)
      onSaved(); onClose()
    } catch (err: any) { toast.error(err.message) }
    setSaving(false)
  }

  if (!server) return null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 size={16} /> Configure {server.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {server.url ? `${server.url}` : `${server.command} ${(server.args || []).join(' ')}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Key size={12} className="text-muted-foreground" />
            <span className="text-xs font-semibold">Environment Variables & API Keys</span>
          </div>
          <p className="text-[0.65rem] text-muted-foreground">
            Enter values directly or use <code className="bg-muted px-1 rounded text-[0.6rem]">{'${env:VAR}'}</code> to read from your environment at runtime.
          </p>
          {envPairs.map((pair, i) => {
            const isUnset = pair.value.startsWith('${env:')
            return (
              <div key={i} className="flex gap-1 items-center">
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  {isUnset ? <X size={9} className="text-orange-400 shrink-0" /> : <Check size={9} className="text-green-500 shrink-0" />}
                  <Input value={pair.key} onChange={e => { const n = [...envPairs]; n[i] = { ...n[i], key: e.target.value }; setEnvPairs(n) }} className="font-mono text-xs h-7 flex-1" placeholder="KEY" />
                </div>
                <Input
                  type="password"
                  value={pair.value}
                  onChange={e => { const n = [...envPairs]; n[i] = { ...n[i], value: e.target.value }; setEnvPairs(n) }}
                  className="font-mono text-xs h-7 flex-[1.5]"
                  placeholder="value or ${env:VAR}"
                />
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEnvPairs(p => p.filter((_, j) => j !== i))}>
                  <Trash2 size={10} />
                </Button>
              </div>
            )
          })}
          <Button variant="ghost" size="sm" className="h-6 text-[0.65rem]" onClick={() => setEnvPairs(p => [...p, { key: '', value: '' }])}>
            <Plus size={10} className="mr-1" /> Add variable
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Check size={12} className="mr-1" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main MCP Panel ──

export function MCPPanel() {
  const [tab, setTab] = useState('servers')
  const [config, setConfig] = useState<MCPConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [localFilter, setLocalFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<RegistryEntry[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [recentServers, setRecentServers] = useState<RegistryEntry[]>([])
  const [recentLoading, setRecentLoading] = useState(false)
  const recentLoaded = useRef(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<RegistryEntry | null>(null)
  const [configureServer, setConfigureServer] = useState<MCPServerEntry | null>(null)
  const [customDialogOpen, setCustomDialogOpen] = useState(false)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mcp/config')
      if (!res.ok) throw new Error()
      setConfig(await res.json())
    } catch { setConfig({ servers: [], configPath: '.agentflow/mcp.json' }) }
    setLoading(false)
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  const loadRecent = useCallback(async () => {
    if (recentLoaded.current) return
    recentLoaded.current = true; setRecentLoading(true)
    try {
      const since = new Date(Date.now() - 7 * 86400000).toISOString()
      const res = await fetch(`/api/mcp/search?updated_since=${encodeURIComponent(since)}&limit=30`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRecentServers(dedupeByName(data.servers || []))
    } catch {}
    setRecentLoading(false)
  }, [])

  useEffect(() => { if (tab === 'registry') loadRecent() }, [tab, loadRecent])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); setSearchError(null); return }
    setSearching(true); setSearchError(null)
    try {
      const res = await fetch(`/api/mcp/search?q=${encodeURIComponent(q)}&limit=20`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSearchResults(dedupeByName(data.servers || []))
    } catch (err: any) { setSearchError(err.message) }
    setSearching(false)
  }, [])

  useEffect(() => {
    clearTimeout(searchTimer.current)
    if (searchQuery.trim()) searchTimer.current = setTimeout(() => doSearch(searchQuery), 350)
    else { setSearchResults([]); setSearchError(null) }
    return () => clearTimeout(searchTimer.current)
  }, [searchQuery, doSearch])

  const handleToggle = useCallback(async (name: string, enabled: boolean) => {
    try {
      await fetch('/api/mcp/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, disabled: !enabled }) })
      loadConfig(); window.dispatchEvent(new CustomEvent('mcp-tools-changed'))
    } catch {}
  }, [loadConfig])

  const handleRemove = useCallback(async (name: string) => {
    try {
      await fetch('/api/mcp/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
      toast.success(`Removed ${name}`)
      loadConfig(); window.dispatchEvent(new CustomEvent('mcp-tools-changed'))
    } catch {}
  }, [loadConfig])

  const handleDiscover = useCallback(async (name: string) => {
    try {
      // Find server config to check if it's HTTP/SSE (client-side) or stdio (server)
      const cfg = config?.servers.find((s: any) => s.name === name)
      let data: any
      if (cfg?.url) {
        const { discoverMcpTools } = await import('@/lib/mcp-discover-client')
        data = await discoverMcpTools(cfg)
      } else {
        const res = await fetch('/api/mcp/discover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
        const text = await res.text()
        try { data = JSON.parse(text) } catch { toast.error(`Non-JSON response`); return }
      }
      if (!data.ok && data.error) {
        data.error?.includes('environment variable') ? toast.warning(data.error) : toast.error(data.error)
        return
      }
      // Save discovered tools to workspace
      if (data.tools) {
        const { requireWorkspace } = await import('@/lib/workspace')
        const ws = await requireWorkspace()
        try {
          const mcpJson = JSON.parse(await ws.read('mcp.json').catch(() => '{"mcpServers":{}}'))
          if (mcpJson.mcpServers?.[name]) {
            mcpJson.mcpServers[name].discoveredTools = data.tools
            await ws.write('mcp.json', JSON.stringify(mcpJson, null, 2))
          }
        } catch {}
      }
      toast.success(`Discovered ${data.toolCount} tool${data.toolCount !== 1 ? 's' : ''} from ${name}`)
      loadConfig(); window.dispatchEvent(new CustomEvent('mcp-tools-changed'))
    } catch (err: any) { toast.error(`Discovery failed: ${err.message}`) }
  }, [loadConfig, config])

  const handleTest = useCallback(async (name: string) => {
    try {
      const res = await fetch('/api/mcp/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
      return await res.json()
    } catch (err: any) { return { ok: false, status: 'error', error: err.message } }
  }, [])

  const configuredNames = new Set(config?.servers.map(s => s.name) ?? [])
  const configuredRegistryNames = new Set(config?.servers.filter(s => s.registryName).map(s => s.registryName!) ?? [])
  const filteredServers = config?.servers.filter(s => s.name.toLowerCase().includes(localFilter.toLowerCase())) ?? []
  const activeCount = config?.servers.filter(s => !s.disabled).length ?? 0
  const totalCount = config?.servers.length ?? 0
  const registryList = searchQuery.trim() ? searchResults : recentServers
  const isSearchMode = searchQuery.trim().length > 0
  const isAlreadyAdded = (entry: RegistryEntry) => configuredNames.has(shortName(entry.name)) || configuredRegistryNames.has(entry.name)

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        {/* Header */}
        <div className="relative px-3 py-2 flex items-center justify-between border-b border-border">
          <FeatureHint id="mcp" text="Connect external tools via MCP — add servers, test connections, and discover available tools for your agents." show side="bottom" />
          <div className="flex items-center gap-1.5">
            <Server size={15} className="text-primary" />
            <span className="text-[0.8125rem] font-semibold">MCP Servers</span>
            {totalCount > 0 && <Badge variant="outline" className="h-[18px] text-[0.6rem]">{activeCount}/{totalCount}</Badge>}
          </div>
          <Tooltip><TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadConfig} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </Button>
          </TooltipTrigger><TooltipContent>Refresh</TooltipContent></Tooltip>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
          <TabsList className="w-full rounded-none h-8">
            <TabsTrigger value="servers" className="flex-1 text-xs">Servers</TabsTrigger>
            <TabsTrigger value="registry" className="flex-1 text-xs">Registry</TabsTrigger>
          </TabsList>

          {loading && <div className="h-0.5 bg-primary/30 animate-pulse" />}

          <TabsContent value="servers" className="flex flex-col flex-1 min-h-0 m-0">
            <div className="px-3 pt-2 pb-1.5 shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-2 top-2 text-muted-foreground" />
                <Input placeholder="Filter servers…" value={localFilter} onChange={e => setLocalFilter(e.target.value)} className="pl-7 h-8 text-[0.8rem]" />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto px-3 pb-2">
              {config && filteredServers.length === 0 && !loading && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-muted">
                    <Server size={22} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    {localFilter ? 'No servers match' : 'No MCP servers configured'}
                  </p>
                  {!localFilter && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setTab('registry')}>
                        <Globe size={13} className="mr-1" /> Registry
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setCustomDialogOpen(true)}>
                        <Plus size={13} className="mr-1" /> Custom
                      </Button>
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                {filteredServers.map(server => (
                  <ServerCard
                    key={server.name} server={server}
                    onToggle={handleToggle} onRemove={handleRemove}
                    onDiscover={handleDiscover} onTest={handleTest}
                    onConfigure={setConfigureServer}
                  />
                ))}
              </div>
            </div>
            {totalCount > 0 && (
              <>
                <Separator />
                <div className="p-2 flex gap-1.5">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setTab('registry')}>
                    <Globe size={12} className="mr-1" /> Registry
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setCustomDialogOpen(true)}>
                    <Plus size={12} className="mr-1" /> Custom
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="registry" className="flex flex-col flex-1 min-h-0 m-0">
            <div className="px-3 pt-2 pb-1.5 shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-2 top-2 text-muted-foreground" />
                <Input placeholder="Search MCP servers…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-7 h-8 text-[0.8rem]" autoFocus />
                {searching && <Loader2 size={14} className="absolute right-2 top-2 animate-spin text-muted-foreground" />}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto px-3 pb-2">
              {searchError && <div className="text-[0.7rem] text-destructive bg-destructive/10 rounded-md px-2.5 py-1.5 mb-2">{searchError}</div>}
              {registryList.length > 0 && (
                <p className="text-[0.6rem] text-muted-foreground font-semibold uppercase tracking-wide mb-1">
                  {isSearchMode ? `${registryList.length} result${registryList.length !== 1 ? 's' : ''}` : 'Recently updated'}
                </p>
              )}
              {!isSearchMode && recentLoading && <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>}
              {isSearchMode && !searching && searchResults.length === 0 && !searchError && (
                <div className="flex flex-col items-center py-8 gap-2">
                  <Search size={20} className="text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No results for &ldquo;{searchQuery}&rdquo;</p>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                {registryList.map(entry => (
                  <RegistryCard key={`${entry.name}-${entry.version}`} entry={entry}
                    onAdd={(e) => { setSelectedEntry(e); setAddDialogOpen(true) }}
                    alreadyAdded={isAlreadyAdded(entry)} />
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <AddServerDialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} registryEntry={selectedEntry} onAdded={() => { loadConfig(); setTab('servers') }} />
        <ConfigureDialog open={!!configureServer} onClose={() => setConfigureServer(null)} server={configureServer} onSaved={loadConfig} />
        <AddCustomDialog open={customDialogOpen} onClose={() => setCustomDialogOpen(false)} onAdded={() => { loadConfig(); setTab('servers') }} />
      </div>
    </TooltipProvider>
  )
}
