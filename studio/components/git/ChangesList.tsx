'use client'

import { useState } from 'react'
import { FileText, Plus, Trash2, Pencil, Loader2, GitCommitHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface FileChange { path: string; status: 'M' | 'A' | 'D' | '?' }

interface Props {
  files: FileChange[]
  onCommit: (message: string) => Promise<void>
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Pencil }> = {
  M: { label: 'Modified', color: 'text-amber-500', icon: Pencil },
  A: { label: 'Added', color: 'text-emerald-500', icon: Plus },
  D: { label: 'Deleted', color: 'text-red-500', icon: Trash2 },
  '?': { label: 'Untracked', color: 'text-muted-foreground', icon: FileText },
}

export function ChangesList({ files, onCommit }: Props) {
  const [message, setMessage] = useState('')
  const [committing, setCommitting] = useState(false)

  if (files.length === 0) return null

  const handleCommit = async () => {
    if (!message.trim()) return
    setCommitting(true)
    try { await onCommit(message.trim()); setMessage('') }
    finally { setCommitting(false) }
  }

  return (
    <div className="border-t border-border/30">
      <p className="px-3.5 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Changes ({files.length})
      </p>

      <div className="max-h-[140px] overflow-y-auto px-2">
        {files.map(f => {
          const cfg = statusConfig[f.status] || statusConfig['?']
          const Icon = cfg.icon
          return (
            <div key={f.path} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-accent/30 transition-colors">
              <Icon size={11} className={`shrink-0 ${cfg.color}`} />
              <span className="text-[11px] truncate flex-1 font-mono">{f.path}</span>
              <span className={`text-[9px] font-medium shrink-0 ${cfg.color}`}>{f.status}</span>
            </div>
          )
        })}
      </div>

      <div className="flex gap-1.5 px-3.5 py-2.5">
        <Input
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCommit()}
          placeholder="Commit message…"
          className="flex-1 h-8 text-xs"
        />
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleCommit} disabled={committing || !message.trim()}>
          {committing ? <Loader2 size={11} className="animate-spin" /> : <GitCommitHorizontal size={12} />}
          Commit
        </Button>
      </div>
    </div>
  )
}
