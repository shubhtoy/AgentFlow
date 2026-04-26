'use client'

import { GitBranch, RefreshCw, FolderGit2, Loader2, Circle, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

export interface RepoInfo {
  name: string
  branch: string
  remoteUrl: string | null
  isClean: boolean
  ahead: number
  behind: number
  modifiedCount: number
}

interface Props {
  repo: RepoInfo | null
  loading: boolean
  syncing: boolean
  onSync: () => void
  onRefresh: () => void
}

export function RepoCard({ repo, loading, syncing, onSync, onRefresh }: Props) {
  if (loading) {
    return (
      <div className="px-3.5 py-4 flex justify-center">
        <Loader2 size={18} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!repo) {
    return (
      <div className="px-3.5 py-6 text-center">
        <FolderGit2 size={24} className="mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground">No repository connected</p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">Clone a repo below to get started</p>
      </div>
    )
  }

  const statusColor = repo.isClean ? 'text-emerald-500' : 'text-amber-500'
  const statusLabel = repo.isClean ? 'Clean' : `${repo.modifiedCount} changed`

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-3 my-2 p-3 rounded-lg border border-border/50 bg-card/50">
        {/* Header: name + branch */}
        <div className="flex items-center gap-2 mb-1.5">
          <FolderGit2 size={14} className="text-muted-foreground shrink-0" />
          <span className="text-[13px] font-semibold truncate flex-1">{repo.name}</span>
          <Badge variant="outline" className="h-5 text-[10px] gap-1 shrink-0">
            <GitBranch size={10} /> {repo.branch}
          </Badge>
        </div>

        {/* Remote URL */}
        {repo.remoteUrl && (
          <p className="text-[10px] text-muted-foreground/60 font-mono truncate mb-2 pl-[22px]">{repo.remoteUrl}</p>
        )}

        {/* Status + counts */}
        <div className="flex items-center gap-2 pl-[22px] mb-2">
          <span className="flex items-center gap-1">
            <Circle size={7} className={statusColor} fill="currentColor" />
            <span className={`text-[11px] font-medium ${statusColor}`}>{statusLabel}</span>
          </span>
          {repo.ahead > 0 && (
            <Tooltip><TooltipTrigger asChild>
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><ArrowUp size={10} />{repo.ahead}</span>
            </TooltipTrigger><TooltipContent className="text-[10px]">{repo.ahead} commit{repo.ahead > 1 ? 's' : ''} ahead</TooltipContent></Tooltip>
          )}
          {repo.behind > 0 && (
            <Tooltip><TooltipTrigger asChild>
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><ArrowDown size={10} />{repo.behind}</span>
            </TooltipTrigger><TooltipContent className="text-[10px]">{repo.behind} commit{repo.behind > 1 ? 's' : ''} behind</TooltipContent></Tooltip>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 pl-[22px]">
          <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5" onClick={onSync} disabled={syncing}>
            {syncing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {syncing ? 'Syncing…' : 'Sync'}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground" onClick={onRefresh} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>
    </TooltipProvider>
  )
}
