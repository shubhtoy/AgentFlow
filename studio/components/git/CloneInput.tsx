'use client'

import { useState } from 'react'
import { FolderGit2, Loader2, Github, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { detectProvider } from '@/lib/git-providers'

interface Props {
  onClone: (url: string) => Promise<void>
}

export function CloneInput({ onClone }: Props) {
  const [url, setUrl] = useState('')
  const [cloning, setCloning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const provider = url.trim() ? detectProvider(url.trim()) : null
  const ProviderIcon = provider?.id === 'github' ? Github : provider ? Globe : FolderGit2

  const handleClone = async () => {
    if (!url.trim()) return
    setCloning(true); setError(null)
    try { await onClone(url.trim()); setUrl('') }
    catch (err: any) {
      const msg = err?.message || 'Clone failed'
      if (msg.includes('401') || msg.includes('auth') || msg.includes('403')) setError('Authentication required — connect above first')
      else if (msg.includes('404') || msg.includes('not found')) setError('Repository not found — check the URL')
      else setError(msg)
    }
    finally { setCloning(false) }
  }

  return (
    <div className="px-3.5 py-2.5 border-t border-border/30 space-y-1.5">
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <ProviderIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            value={url}
            onChange={e => { setUrl(e.target.value); setError(null) }}
            onKeyDown={e => e.key === 'Enter' && handleClone()}
            placeholder="Paste repo URL to clone…"
            className="h-8 pl-8 text-xs font-mono"
          />
        </div>
        <Button size="sm" className="h-8 text-xs px-3" onClick={handleClone} disabled={cloning || !url.trim()}>
          {cloning ? <Loader2 size={12} className="animate-spin" /> : 'Clone'}
        </Button>
      </div>
      {error && <p className="text-[10px] text-destructive px-0.5">{error}</p>}
      {provider && !error && <p className="text-[10px] text-muted-foreground/50 px-0.5">Detected: {provider.name}</p>}
    </div>
  )
}
