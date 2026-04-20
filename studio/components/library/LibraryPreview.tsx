import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { ScrollArea } from '../ui/scroll-area'
import { Separator } from '../ui/separator'
import {
  Workflow,
  Wrench,
  BookOpen,
  FileText,
  MessageSquare,
  Brain,
  Loader2,
  Plus,
  ExternalLink,
  Check,
} from 'lucide-react'
import { useAppStore } from '@/store'
import { registerAgentFlowTheme } from '@/lib/monaco-theme'

const MonacoEditor = lazy(() => import('@monaco-editor/react').then(m => ({ default: m.default })))

const TYPE_ICON_MAP: Record<string, typeof Workflow> = {
  workflow: Workflow,
  tool: Wrench,
  skill: BookOpen,
  template: FileText,
  interaction: MessageSquare,
  memory: Brain,
}

interface LibraryPreviewProps {
  entry: any | null
  open: boolean
  onClose: () => void
  onAdd?: (entry: any) => void
  isInstalled?: boolean
}

export function LibraryPreview({ entry, open, onClose, onAdd, isInstalled }: LibraryPreviewProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const resolvedTheme = useAppStore(s => s.resolvedTheme)

  useEffect(() => {
    if (!entry || !open) { setContent(null); return }
    setLoading(true)
    fetch(`/api/library/${entry.type}/${entry.name}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setContent(d?.content ?? 'No content available.'))
      .catch(() => setContent('Failed to load content.'))
      .finally(() => setLoading(false))
  }, [entry, open])

  const handleAdd = useCallback(async () => {
    if (!entry || !onAdd) return
    setAdding(true)
    try {
      await onAdd(entry)
    } finally {
      setAdding(false)
    }
  }, [entry, onAdd])

  if (!entry) return null

  const Icon = TYPE_ICON_MAP[entry.type] || FileText

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <DialogTitle className="text-base">{entry.name}</DialogTitle>
            <Badge variant="outline" className="text-[10px]">{entry.type}</Badge>
            {entry.pattern && (
              <Badge variant="secondary" className="text-[10px]">{entry.pattern}</Badge>
            )}
          </div>
          <DialogDescription className="text-xs">
            {entry.description}
          </DialogDescription>
        </DialogHeader>

        {/* Metadata row */}
        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          {entry.domain && <span>Domain: <strong className="text-foreground">{entry.domain}</strong></span>}
          {entry.complexity && <span>Complexity: <strong className="text-foreground">{entry.complexity}</strong></span>}
          {entry.path && <span className="flex items-center gap-0.5"><ExternalLink className="h-2.5 w-2.5" />{entry.path}</span>}
        </div>

        {/* Tags */}
        {entry.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entry.tags.map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <Separator />

        {/* Content preview */}
        <ScrollArea className="flex-1 min-h-0 max-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
              <MonacoEditor
                height="400px"
                language="markdown"
                value={content ?? ''}
                theme={resolvedTheme === 'dark' ? 'agentflow-dark' : 'agentflow-light'}
                beforeMount={registerAgentFlowTheme}
                options={{ readOnly: true, minimap: { enabled: false }, lineNumbers: 'off', scrollBeyondLastLine: false, wordWrap: 'on', fontSize: 12, automaticLayout: true, fixedOverflowWidgets: true }}
              />
            </Suspense>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {onAdd && !isInstalled && (
            <Button onClick={handleAdd} disabled={adding}>
              {adding ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-3.5 w-3.5" />}
              {adding ? 'Adding...' : 'Add to Workspace'}
            </Button>
          )}
          {isInstalled && (
            <Button variant="secondary" disabled>
              <Check className="mr-2 h-3.5 w-3.5 text-green-600" />
              Installed
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
