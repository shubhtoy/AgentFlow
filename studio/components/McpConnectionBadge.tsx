'use client'

import { Server, Wifi, Terminal, AlertCircle } from 'lucide-react'

export type McpConnectionMode = 'full' | 'http-only' | 'offline'

export interface McpStatusInfo {
  mode: McpConnectionMode
  activeServers: number
  totalServers: number
  stdioCount: number
  httpCount: number
}

/**
 * Determines the connection mode based on environment.
 * - full: server available, supports both stdio and HTTP
 * - http-only: no server, only HTTP/SSE servers work (browser-direct)
 * - offline: no servers configured
 */
export function getConnectionMode(servers: Array<{ disabled: boolean; command?: string; url?: string }>): McpStatusInfo {
  const active = servers.filter(s => !s.disabled)
  const stdioCount = active.filter(s => !!s.command && !s.url).length
  const httpCount = active.filter(s => !!s.url).length
  const total = servers.length
  const activeCount = active.length

  // For now, assume server is always available (Next.js API routes)
  const mode: McpConnectionMode = activeCount === 0 ? 'offline' : 'full'

  return { mode, activeServers: activeCount, totalServers: total, stdioCount, httpCount }
}

/**
 * Compact badge for status bar — shows connection mode + counts
 */
export function McpStatusBadge({ info, onClick }: { info: McpStatusInfo; onClick?: () => void }) {
  if (info.totalServers === 0) return null

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-accent/50 transition-colors"
    >
      <Server size={12} className={info.activeServers > 0 ? 'text-emerald-500' : 'text-muted-foreground/50'} />
      <span className={`text-xs ${info.activeServers > 0 ? 'text-foreground/70' : 'text-muted-foreground/50'}`}>
        {info.activeServers}/{info.totalServers}
      </span>
      {info.stdioCount > 0 && (
        <span className="flex items-center gap-0.5 text-[0.6rem] text-amber-500/80">
          <Terminal size={9} />{info.stdioCount}
        </span>
      )}
      {info.httpCount > 0 && (
        <span className="flex items-center gap-0.5 text-[0.6rem] text-emerald-500/80">
          <Wifi size={9} />{info.httpCount}
        </span>
      )}
    </button>
  )
}

/**
 * Per-server connection badge — shows transport + status
 */
export function McpServerBadge({ server, testResult }: {
  server: { disabled: boolean; command?: string; url?: string; status: string; env?: Record<string, string> }
  testResult?: { ok: boolean; latencyMs?: number } | null
}) {
  const transport = server.url ? (server.url.includes('/sse') ? 'SSE' : 'HTTP') : server.command ? 'stdio' : '?'
  const isStdio = transport === 'stdio'
  const isMisconfigured = server.status === 'misconfigured'
  const envMissing = Object.values(server.env || {}).some(v => typeof v === 'string' && v.startsWith('${env:'))

  const statusColor = server.disabled ? 'bg-muted text-muted-foreground' :
    isMisconfigured ? 'bg-destructive/10 text-destructive' :
    envMissing ? 'bg-orange-500/10 text-orange-500' :
    testResult?.ok ? 'bg-emerald-500/15 text-emerald-500' :
    'bg-emerald-500/10 text-emerald-500'

  const statusText = server.disabled ? 'off' :
    isMisconfigured ? 'error' :
    envMissing ? 'needs env' :
    testResult?.ok ? `connected · ${testResult.latencyMs}ms` :
    'ready'

  const dotColor = server.disabled ? 'bg-muted-foreground' :
    isMisconfigured ? 'bg-destructive' :
    envMissing ? 'bg-orange-400' :
    testResult?.ok ? 'bg-emerald-500' :
    'bg-emerald-500 animate-pulse'

  return (
    <div className="flex items-center gap-1.5">
      {/* Transport badge */}
      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[0.6rem] font-medium border ${
        isStdio ? 'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5' :
        'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5'
      }`}>
        {isStdio ? <Terminal size={9} /> : <Wifi size={9} />}
        {transport}
      </span>
      {/* Status badge */}
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[0.6rem] font-medium ${statusColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        {statusText}
      </span>
    </div>
  )
}
