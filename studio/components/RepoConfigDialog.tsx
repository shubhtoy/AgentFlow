import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { GitBranch, Lock, Globe, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react'

export interface RepoConfigFormData {
  mapping: { url: string; name: string; branch: string; role: string; repoType: string }
}

/** Parse a git URL to extract name */
function parseGitUrl(url: string): { host: string; owner: string; repo: string; isGitHub: boolean } | null {
  // GitHub: github.com/user/repo
  const gh = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/)
  if (gh) return { host: 'github.com', owner: gh[1], repo: gh[2], isGitHub: true }
  // GitLab, Bitbucket, or any host: host.com/user/repo
  const generic = url.match(/(?:https?:\/\/|git@)([^/:]+)[/:]([^/]+)\/([^/.]+)/)
  if (generic) return { host: generic[1], owner: generic[2], repo: generic[3], isGitHub: false }
  return null
}

export function RepoConfigDialog({ open, onClose, onSave }: {
  open: boolean; onClose: () => void
  onSave: (data: RepoConfigFormData) => Promise<void>
}) {
  const [url, setUrl] = useState('')
  const [branch, setBranch] = useState('main')
  const [loading, setLoading] = useState(false)
  const [repoInfo, setRepoInfo] = useState<{ name: string; private: boolean; description: string; default_branch: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [token, setToken] = useState('')
  const hasToken = !!localStorage.getItem('af-git-token')

  // Auto-detect repo info when URL changes
  useEffect(() => {
    setRepoInfo(null); setError(null); setNeedsAuth(false)
    const parsed = parseGitUrl(url)
    if (!parsed) return

    // Only auto-detect via API for GitHub
    if (parsed.isGitHub) {
      const t = localStorage.getItem('af-git-token')
      const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' }
      if (t) headers.Authorization = `Bearer ${t}`
      const ctrl = new AbortController()
      fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, { headers, signal: ctrl.signal })
        .then(r => {
          if (r.status === 404) { setNeedsAuth(true); setError('Repo not found or private — add a token below'); return null }
          if (!r.ok) { setError('Could not fetch repo info'); return null }
          return r.json()
        })
        .then(d => {
          if (!d) return
          setRepoInfo({ name: d.name, private: d.private, description: d.description || '', default_branch: d.default_branch })
          setBranch(d.default_branch || 'main')
        })
        .catch(() => {})
      return () => ctrl.abort()
    } else {
      // Non-GitHub: just use parsed name, assume public
      setRepoInfo({ name: parsed.repo, private: false, description: `${parsed.host}/${parsed.owner}/${parsed.repo}`, default_branch: 'main' })
    }
  }, [url])

  const saveToken = () => {
    if (!token.trim()) return
    localStorage.setItem('af-git-token', token.trim())
    setToken('')
    setNeedsAuth(false)
    // Re-trigger detection
    setUrl(u => u + ' ')
    setTimeout(() => setUrl(u => u.trim()), 10)
  }

  const handleConnect = async () => {
    const parsed = parseGitUrl(url)
    if (!parsed) { setError('Enter a valid git URL'); return }
    setLoading(true); setError(null)
    try {
      await onSave({
        mapping: {
          url: url.trim().endsWith('.git') ? url.trim() : url.trim() + '.git',
          name: repoInfo?.name || parsed.repo,
          branch,
          role: 'primary',
          repoType: repoInfo?.private ? 'private' : 'public',
        }
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Clone failed')
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Connect Repository</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* URL input */}
          <div>
            <Input
              placeholder="https://github.com/user/repo"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && repoInfo && handleConnect()}
              className="h-9"
              autoFocus
            />
          </div>

          {/* Auto-detected info */}
          {repoInfo && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50">
              {repoInfo.private ? <Lock size={14} className="text-amber-500" /> : <Globe size={14} className="text-emerald-500" />}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{repoInfo.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{repoInfo.private ? 'private' : 'public'}</span>
                {repoInfo.description && <p className="text-xs text-muted-foreground truncate">{repoInfo.description}</p>}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <GitBranch size={12} />
                <input
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                  className="w-16 bg-transparent border-none text-xs p-0 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Auth section — only if needed */}
          {(needsAuth || (repoInfo?.private && !hasToken)) && (
            <div className="space-y-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Authentication required for private repos</p>
              <div className="flex gap-1.5">
                <Input
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveToken()}
                  placeholder="ghp_..."
                  className="h-7 text-xs flex-1"
                />
                <Button size="sm" className="h-7 text-xs" onClick={saveToken} disabled={!token.trim()}>Save</Button>
              </div>
              <a href="https://github.com/settings/tokens/new?scopes=repo&description=AgentFlow" target="_blank" rel="noopener" className="text-[10px] text-primary flex items-center gap-1">
                Create token on GitHub <ExternalLink size={9} />
              </a>
            </div>
          )}

          {/* Saved token indicator */}
          {hasToken && !needsAuth && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={12} /> Token saved — private repos accessible
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleConnect} disabled={loading || !parseGitUrl(url) || needsAuth}>
            {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
            Clone
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
