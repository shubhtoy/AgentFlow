import { useCallback, useMemo, memo, lazy, Suspense } from 'react'
import { X, FileText, ArrowRight, ArrowLeft, CornerDownRight } from 'lucide-react'
import { useCategoryConfig } from '../hooks/useCategoryConfig'
import { getNodeTypeColor } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { isMarkdown, hasPreview, getMimeType } from '@/lib/file-utils'
import { Editor } from './Editor'
import { FileViewer } from './FileViewer'
import { FrontmatterForm } from './FrontmatterForm'
import { MarkdownPreview } from './MarkdownPreview'
import { Spinner } from './ui/spinner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from './ui/tooltip'
import type { ParsedFile, Ref, ValidationIssue, NodeDef, WorkflowDef } from '@/lib/types'

// ── Header ──────────────────────────────────────────────────────────────

export const DetailHeader = memo(function DetailHeader({ name, typeBadge, filePath, onClose, actions }: {
  name: string
  typeBadge: string | null
  filePath: string
  onClose?: () => void
  actions?: React.ReactNode
}) {
  const categoryConfig = useCategoryConfig()
  const cat = typeBadge ? categoryConfig[typeBadge] : null
  const CatIcon = cat?.icon

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border/50 bg-card/80 shrink-0">
      {CatIcon && (
        <div
          className="size-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${cat?.primaryColor}18` }}
        >
          <CatIcon size={16} style={{ color: cat?.primaryColor }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate leading-tight">{name || 'Untitled'}</p>
        <p className="text-[11px] text-muted-foreground font-mono truncate">{filePath}</p>
      </div>
      {actions}
      {onClose && (
        <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose}>
          <X size={14} />
        </Button>
      )}
    </div>
  )
})

// ── Validation banner ───────────────────────────────────────────────────

export const ValidationBanner = memo(function ValidationBanner({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) return null
  const errors = issues.filter(i => (i as any).severity === 'error')
  const warnings = issues.filter(i => (i as any).severity === 'warning')

  return (
    <div className={cn(
      'px-3 py-2 border-b text-xs font-medium',
      errors.length > 0
        ? 'border-destructive/20 bg-destructive/5 text-destructive'
        : 'border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400',
    )}>
      <div className="space-y-1">
        {errors.map((e, i) => (
          <p key={`e-${i}`} className="flex items-start gap-1.5">
            <span className="shrink-0 mt-0.5">✕</span>
            <span>{e.message}{e.field ? ` (${e.field})` : ''}</span>
          </p>
        ))}
        {warnings.map((w, i) => (
          <p key={`w-${i}`} className="flex items-start gap-1.5 text-amber-600 dark:text-amber-400">
            <span className="shrink-0 mt-0.5">⚠</span>
            <span>{w.message}{(w as any).field ? ` (${(w as any).field})` : ''}</span>
          </p>
        ))}
      </div>
    </div>
  )
})


// ── References list ─────────────────────────────────────────────────────

export const ReferencesList = memo(function ReferencesList({ refs, onNavigate, sourceNodeId }: {
  refs: Ref[]
  onNavigate?: (ref: Ref) => void
  sourceNodeId?: string
}) {
  const categoryConfig = useCategoryConfig()
  const grouped = useMemo(() => {
    const groups: Record<string, Ref[]> = {}
    for (const r of refs) {
      const key = r.semanticType ?? 'mention'
      ;(groups[key] ??= []).push(r)
    }
    return groups
  }, [refs])

  const labels: Record<string, string> = { edge: 'Edges', mention: 'Mentions', data_flow: 'Data Flows' }

  if (refs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <FileText size={32} className="mb-2 opacity-40" />
        <p className="text-xs">No references</p>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-3">
      {Object.entries(grouped).map(([type, items]) => {
        if (items.length === 0) return null
        return (
          <div key={type}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              {labels[type] ?? type} ({items.length})
            </p>
            <div className="space-y-0.5">
              {items.map((ref, i) => {
                const cfg = categoryConfig[ref.category]
                const CatIcon = cfg?.icon
                return (
                  <button
                    key={`${ref.raw}-${i}`}
                    onClick={() => onNavigate?.(ref)}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-[13px] hover:bg-accent transition-colors"
                  >
                    {CatIcon && <CatIcon size={14} style={{ color: cfg?.primaryColor }} />}
                    <span className="truncate flex-1 font-medium">{ref.name}</span>
                    {ref.condition && (
                      <span className="text-[10px] text-muted-foreground">{ref.condition}</span>
                    )}
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5" style={{ backgroundColor: cfg?.containerColor, color: cfg?.onColor }}>
                      {cfg?.label ?? ref.category}
                    </Badge>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
})

// ── Connections (paths) ─────────────────────────────────────────────────

export const ConnectionsList = memo(function ConnectionsList({ node, wf, onNavigate }: {
  node: NodeDef
  wf: WorkflowDef
  onNavigate: (nodeId: string) => void
}) {
  const isDark = document.documentElement.classList.contains('dark')
  const theme = isDark ? 'dark' : 'light'
  const incoming = wf.edges.filter(e => e.to === node.id)
  const outgoing = wf.edges.filter(e => e.from === node.id)

  if (incoming.length === 0 && outgoing.length === 0) {
    return <p className="text-xs text-muted-foreground py-2 px-3">No connections</p>
  }

  const renderEdge = (e: { from: string; to: string; condition?: string }, direction: 'in' | 'out') => {
    const targetId = direction === 'in' ? e.from : e.to
    const targetNode = wf.nodes[targetId]
    const color = getNodeTypeColor(targetNode?.nodeType || 'step', theme)
    const Icon = direction === 'in' ? ArrowLeft : ArrowRight

    return (
      <button
        key={`${e.from}-${e.to}`}
        onClick={() => onNavigate(targetId)}
        className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded-md text-xs hover:bg-accent transition-colors"
      >
        <Icon size={12} style={{ color }} />
        <span className="font-medium truncate">{targetNode?.name || targetId}</span>
        {e.condition && (
          <Badge variant="outline" className="text-[10px] h-4 px-1 ml-auto">{e.condition}</Badge>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-2 px-3 py-2">
      {incoming.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Incoming</p>
          {incoming.map(e => renderEdge(e, 'in'))}
        </div>
      )}
      {outgoing.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Outgoing</p>
          {outgoing.map(e => renderEdge(e, 'out'))}
        </div>
      )}
    </div>
  )
})

// ── Reachable nodes ─────────────────────────────────────────────────────

export const ReachableNodes = memo(function ReachableNodes({ wf, nodeId, onNavigate }: {
  wf: WorkflowDef
  nodeId: string
  onNavigate: (id: string) => void
}) {
  const isDark = document.documentElement.classList.contains('dark')
  const theme = isDark ? 'dark' : 'light'

  const reachable = useMemo(() => {
    const visited = new Set<string>()
    const queue = [nodeId]
    while (queue.length) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)
      for (const e of wf.edges) {
        if (e.from === current && !visited.has(e.to)) queue.push(e.to)
      }
    }
    visited.delete(nodeId)
    return Array.from(visited)
  }, [wf, nodeId])

  if (reachable.length === 0) {
    return <p className="text-xs text-muted-foreground py-2 px-3">No reachable nodes</p>
  }

  return (
    <div className="flex flex-wrap gap-1 px-3 py-2">
      {reachable.map(id => {
        const n = wf.nodes[id]
        if (!n) return null
        const color = getNodeTypeColor(n.nodeType, theme)
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border hover:bg-accent transition-colors"
            style={{ borderColor: `${color}33`, color }}
          >
            <CornerDownRight size={10} />
            {n.name}
          </button>
        )
      })}
    </div>
  )
})


// ── Tabbed detail content ───────────────────────────────────────────────

// ── DocViewer preview for non-md previewable files ──────────────────────

const LazyDocViewer = lazy(() =>
  import('@cyntler/react-doc-viewer').then(mod => ({
    default: function DocViewerPreviewInner({ uri, fileName }: { uri: string; fileName: string }) {
      const DocViewer = mod.default
      const { DocViewerRenderers } = mod
      return (
        <DocViewer
          documents={[{ uri, fileName }]}
          pluginRenderers={DocViewerRenderers}
          config={{ header: { disableHeader: true } }}
          style={{ background: 'transparent', minHeight: 300, height: '100%', overflow: 'auto' }}
        />
      )
    },
  }))
)

function DocViewerPreview({ path, content }: { path: string; content: string }) {
  const blob = useMemo(() => {
    const mime = getMimeType(path)
    return URL.createObjectURL(new Blob([content], { type: mime }))
  }, [content, path])

  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Spinner /></div>}>
      <LazyDocViewer uri={blob} fileName={path.split('/').pop() ?? path} />
    </Suspense>
  )
}

// ── Detail tabs ─────────────────────────────────────────────────────────

export function NodeDetailTabs({ file, allRefs, onRefNavigate, sourceNodeId, tab, onTabChange, onSave }: {
  file: ParsedFile | null
  allRefs: Ref[]
  onRefNavigate?: (ref: Ref) => void
  sourceNodeId?: string
  tab: string
  onTabChange: (tab: string) => void
  onSave?: (filePath: string, content: string) => void
}) {
  const handleFrontmatterSave = useCallback((yamlBlock: string) => {
    if (!file || !onSave) return
    const raw = file.rawContent
    let body = raw
    if (raw.trimStart().startsWith('---')) {
      const end = raw.indexOf('---', raw.indexOf('---') + 3)
      body = end === -1 ? raw : raw.slice(end + 3)
    }
    onSave(file.relativePath, yamlBlock + body.replace(/^\n/, ''))
  }, [file, onSave])

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Select a node or resource to view details</p>
      </div>
    )
  }

  return (
    <Tabs value={tab} onValueChange={onTabChange} className="flex flex-col flex-1 min-h-0">
      <TabsList className="w-full rounded-none border-b border-border/50 h-9 bg-transparent px-1 justify-start shrink-0">
        <TabsTrigger value="content" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
          Content
        </TabsTrigger>
        {isMarkdown(file.relativePath) && (
          <TabsTrigger value="properties" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
            Properties
          </TabsTrigger>
        )}
        {allRefs.length > 0 && (
          <TabsTrigger value="references" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
            Refs
          </TabsTrigger>
        )}
        {hasPreview(file.relativePath) && (
          <TabsTrigger value="preview" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
            Preview
          </TabsTrigger>
        )}
      </TabsList>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {tab === 'content' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {isMarkdown(file.relativePath) ? (
              <Editor filePath={file.relativePath} content={file.rawContent} />
            ) : (
              <FileViewer
                path={file.relativePath}
                content={file.rawContent}
                onSave={onSave ? (c) => onSave(file.relativePath, c) : undefined}
                className="flex-1"
              />
            )}
          </div>
        )}
        {tab === 'properties' && (
          <ScrollArea className="flex-1 min-h-0">
            <FrontmatterForm file={file} onSave={handleFrontmatterSave} />
          </ScrollArea>
        )}
        {tab === 'references' && (
          <ScrollArea className="flex-1 min-h-0">
            <ReferencesList refs={allRefs} onNavigate={onRefNavigate} sourceNodeId={sourceNodeId} />
          </ScrollArea>
        )}
        {tab === 'preview' && hasPreview(file.relativePath) && (
          isMarkdown(file.relativePath) ? (
            <ScrollArea className="flex-1 min-h-0">
              <MarkdownPreview content={file.rawContent} />
            </ScrollArea>
          ) : (
            <div className="flex-1 overflow-auto min-h-0">
              <DocViewerPreview path={file.relativePath} content={file.rawContent} />
            </div>
          )
        )}
      </div>
    </Tabs>
  )
}
