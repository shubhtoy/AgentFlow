import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Loader2, ExternalLink } from 'lucide-react'

export interface RepoConfigFormData {
  mapping: { url: string; name: string; branch: string; role: string; repoType: string }
}

export function RepoConfigDialog({ open, onClose, onSave }: {
  open: boolean; onClose: () => void
  onSave: (data: RepoConfigFormData) => Promise<void>
}) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authNeeded, setAuthNeeded] = useState(false)
  const [token, setToken] = useState('')

  const handleClone = async () => {
    if (!url.trim()) return
    setLoading(true); setError(null)

    // If auth was requested and token provided, save it
    if (authNeeded && token.trim()) {
      localStorage.setItem('af-git-token', token.trim())
      setAuthNeeded(false)
    }

    const cleanUrl = url.trim().endsWith('.git') ? url.trim() : url.trim()
    const name = cleanUrl.split('/').pop()?.replace('.git', '') || 'repo'

    try {
      await onSave({ mapping: { url: cleanUrl, name, branch: 'main', role: 'primary', repoType: 'public' } })
      setUrl(''); setToken(''); setError(null)
      onClose()
    } catch (err: any) {
      const msg = err.message || 'Clone failed'
      if (msg.includes('401') || msg.includes('auth') || msg.includes('403') || msg.includes('Authentication')) {
        setAuthNeeded(true)
        setError('Authentication required')
      } else {
        setError(msg)
      }
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setError(null); setAuthNeeded(false) } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Clone Repository</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Input
            placeholder="https://github.com/user/repo.git"
            value={url}
            onChange={e => { setUrl(e.target.value); setError(null); setAuthNeeded(false) }}
            onKeyDown={e => e.key === 'Enter' && !authNeeded && handleClone()}
            className="h-9"
            autoFocus
          />

          {authNeeded && (
            <div className="space-y-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <p className="text-xs text-amber-600 dark:text-amber-400">Enter a personal access token:</p>
              <Input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleClone()}
                placeholder="ghp_... or glpat-..."
                className="h-7 text-xs"
              />
              <a href="https://github.com/settings/tokens/new?scopes=repo&description=AgentFlow" target="_blank" rel="noopener" className="text-[10px] text-primary flex items-center gap-1">
                Create GitHub token <ExternalLink size={9} />
              </a>
            </div>
          )}

          {error && !authNeeded && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleClone} disabled={loading || !url.trim()}>
            {loading && <Loader2 size={14} className="animate-spin mr-1" />}
            {authNeeded ? 'Retry' : 'Clone'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
