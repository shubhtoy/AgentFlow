'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { ConnectionStatus, type AuthState } from './git/ConnectionStatus'
import { RepoCard, type RepoInfo } from './git/RepoCard'
import { ChangesList, type FileChange } from './git/ChangesList'
import { CloneInput } from './git/CloneInput'
import { useAppStore } from '@/store'

export function GitPanel() {
  const [auth, setAuth] = useState<AuthState>({ username: null, provider: null, transport: 'https' })
  const [repo, setRepo] = useState<RepoInfo | null>(null)
  const [changes, setChanges] = useState<FileChange[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const loadedRef = useRef(false)
  const connectRepo = useAppStore(s => s.connectRepo)
  const reload = useAppStore(s => s.reload)

  const loadRepo = useCallback(async () => {
    setLoading(true)
    try {
      const { getStatus } = await import('@/lib/git-client')
      const status = await getStatus()
      if (status.files > 0) {
        setRepo({ name: 'workspace', branch: status.branch, remoteUrl: null, isClean: true, ahead: 0, behind: 0, modifiedCount: 0 })
        setChanges([])
      } else {
        setRepo(null); setChanges([])
      }
    } catch { setRepo(null) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (!loadedRef.current) { loadedRef.current = true; loadRepo() } }, [loadRepo])

  useEffect(() => {
    const onRefresh = () => { loadedRef.current = false; loadRepo() }
    window.addEventListener('agentflow:git-refresh', onRefresh)
    return () => window.removeEventListener('agentflow:git-refresh', onRefresh)
  }, [loadRepo])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    try { await loadRepo() }
    finally { setSyncing(false) }
  }, [loadRepo])

  const handleClone = useCallback(async (url: string) => {
    const name = url.split('/').pop()?.replace('.git', '') || 'repo'
    await connectRepo({ url, name, branch: 'main', role: 'primary', repoType: 'public' })
    loadedRef.current = false
    await loadRepo()
    await reload()
  }, [connectRepo, loadRepo, reload])

  const handleCommit = useCallback(async (message: string) => {
    const token = localStorage.getItem('af-git-token') || undefined
    const { commitAndPush } = await import('@/lib/git-client')
    await commitAndPush(message, token)
    await loadRepo()
  }, [loadRepo])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ConnectionStatus auth={auth} onAuthChange={setAuth} />
      <div className="flex-1 overflow-y-auto">
        <RepoCard repo={repo} loading={loading} syncing={syncing} onSync={handleSync} onRefresh={loadRepo} />
        <ChangesList files={changes} onCommit={handleCommit} />
      </div>
      <CloneInput onClone={handleClone} />
    </div>
  )
}

export { GitPanel as GitPanelContent }
export function GitActionButton() { return null }
