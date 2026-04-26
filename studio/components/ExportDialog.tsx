import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { Dialog, DialogContent } from './ui/dialog'
import { FeatureHint } from './onboarding/FeatureHint'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'
import { cn } from '@/lib/utils'
import type { WorkflowGraph } from '@/lib/types'
import {
  Download, FileCode, Sparkles, ChevronDown, ChevronRight,
  FileText, File, Copy, Check, X, Maximize2, Minimize2, FolderOpen,
  Globe,
} from 'lucide-react'
import { useAppStore } from '@/store'
import { api } from '@/lib/api'
import type { PlatformInfo } from '@/lib/api'
import { MarkdownPreview } from './MarkdownPreview'
import type { ExportFormat } from '@/lib/types'
import { registerAgentFlowTheme } from '@/lib/monaco-theme'
import { getLanguage } from '@/lib/file-utils'
import { Spinner } from './ui/spinner'

const MonacoEditor = lazy(() => import('@monaco-editor/react').then(m => ({ default: m.default })))

const FORMAT_INFO: Record<ExportFormat, { icon: typeof FileCode; label: string; desc: string }> = {
  raw:      { icon: FileCode, label: 'Raw',      desc: 'Exact source files — {{}} refs untouched' },
  parsed:   { icon: Sparkles, label: 'Parsed',   desc: 'Same structure — refs resolved to file paths' },
  platform: { icon: Globe,    label: 'Platform',  desc: 'Export to Kiro, Cursor, Claude Code, VS Code, Windsurf, OpenClaw, or Agent Spec' },
}

interface TreeEntry { name: string; path: string; children?: TreeEntry[] }

function buildFileTree(files: Record<string, string>): TreeEntry[] {
  const root: TreeEntry = { name: '', path: '', children: [] }
  for (const filePath of Object.keys(files).sort()) {
    const parts = filePath.split('/')
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (i === parts.length - 1) {
        current.children!.push({ name: part, path: filePath })
      } else {
        let child = current.children!.find(c => c.name === part && c.children)
        if (!child) {
          child = { name: part, path: parts.slice(0, i + 1).join('/'), children: [] }
          current.children!.push(child)
        }
        current = child
      }
    }
  }
  return root.children || []
}

function FileTreeNode({ entry, depth, selectedFile, onSelect }: {
  entry: TreeEntry; depth: number; selectedFile: string | null; onSelect: (p: string) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const isDir = !!entry.children
  const isSelected = !isDir && entry.path === selectedFile

  return (
    <>
      <button
        onClick={() => isDir ? setExpanded(e => !e) : onSelect(entry.path)}
        className={cn(
          'flex items-center gap-1.5 w-full rounded-md py-1 pr-2 text-left transition-colors select-none',
          isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isDir
          ? (expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />)
          : <FileText size={13} className="opacity-50 shrink-0" />
        }
        <span className={cn(
          'text-xs font-mono truncate',
          isDir ? 'font-semibold text-muted-foreground' : isSelected ? 'font-medium' : '',
        )}>
          {entry.name}{isDir ? '/' : ''}
        </span>
      </button>
      {isDir && expanded && entry.children!.map(child => (
        <FileTreeNode key={child.path} entry={child} depth={depth + 1}
          selectedFile={selectedFile} onSelect={onSelect} />
      ))}
    </>
  )
}

interface MappingEntry {
  source: string
  target: string | null
  fidelity: 'direct' | 'transform' | 'lossy' | 'skip'
  note?: string
}

function FidelityBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    direct:    'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    transform: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    lossy:     'bg-orange-500/10 text-orange-600 border-orange-500/20',
    skip:      'bg-muted text-muted-foreground border-border',
  }
  return (
    <Badge variant="outline" className={cn('text-[9px] h-4 px-1 font-medium', styles[level] || styles.skip)}>
      {level}
    </Badge>
  )
}

export interface ExportDialogProps { open: boolean; onClose: () => void }

export function ExportDialogContent({ onClose }: { onClose?: () => void } = {}) {
  const data = useAppStore(s => s.data)
  const activeWf = useAppStore(s => s.activeWf)
  const showNotification = useAppStore(s => s.showNotification)
  const resolvedTheme = useAppStore(s => s.resolvedTheme)

  const [format, setFormat] = useState<ExportFormat>('raw')
  const [workflow, setWorkflow] = useState(activeWf)
  const [exportScope, setExportScope] = useState<'workflow' | 'workspace'>('workflow')
  const [selectedWfs, setSelectedWfs] = useState<Set<string>>(new Set(activeWf ? [activeWf] : []))
  const [preview, setPreview] = useState<Record<string, string> | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [previewTab, setPreviewTab] = useState<'rendered' | 'source'>('rendered')
  const [fullscreen, setFullscreen] = useState(false)

  // Platform export state
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([])
  const [selectedPlatform, setSelectedPlatform] = useState('')
  const [platformPreview, setPlatformPreview] = useState<{ files: Record<string, string>; warnings: string[]; mappingReport: { exportMappings: MappingEntry[] } } | null>(null)
  const [platformLoading, setPlatformLoading] = useState(false)

  const workflows = useMemo(() => data ? Object.keys(data.workflows) : [], [data])
  const effectiveWorkflow = exportScope === 'workspace' ? undefined : workflow
  const wfName = exportScope === 'workspace' ? 'Entire workspace' : (data?.workflows[workflow]?.name || workflow)

  useEffect(() => {
    if (open) { setWorkflow(activeWf); setSelectedWfs(new Set(activeWf ? [activeWf] : [])); setExportScope('workflow'); setSelectedFile(null); setPreview(null); setPreviewTab('rendered') }
  }, [open, activeWf])

  // Fetch platforms list
  useEffect(() => {
    if (!open) return
    api.getPlatforms()
      .then(d => { setPlatforms(d.platforms || []); if (d.platforms?.length) setSelectedPlatform(d.platforms[0].name) })
      .catch(() => {})
  }, [open])

  // Fetch platform export preview
  useEffect(() => {
    if (!open || format !== 'platform' || !selectedPlatform) return
    let cancelled = false
    setPlatformLoading(true)
    ;(async () => {
      const { requireWorkspace } = await import('@/lib/workspace')
      const w = await requireWorkspace()
      const files = await w.readAll()
      const fileMap = Object.fromEntries(files.map(f => [f.path, f.content]))
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: fileMap, format: selectedPlatform, workflowId: workflow }),
      })
      if (cancelled) return
      if (res.ok) {
        const result = await res.json()
        setPlatformPreview(result as any)
        const keys = Object.keys(result.files).sort()
        if (keys.length) setSelectedFile(keys[0])
      } else {
        setPlatformPreview(null)
      }
    })()
      .catch(() => { if (!cancelled) setPlatformPreview(null) })
      .finally(() => { if (!cancelled) setPlatformLoading(false) })
    return () => { cancelled = true }
  }, [open, format, selectedPlatform, workflow])

  useEffect(() => {
    if (!open || format === 'platform') return
    let cancelled = false
    setPreviewLoading(true)
    setSelectedFile(null)
    api.exportPreview({ workflow: effectiveWorkflow as string, format })
      .then(res => {
        if (cancelled) return
        const files = (res as any).files ?? res
        setPreview(files)
        const keys = Object.keys(files).sort()
        if (keys.length > 0) setSelectedFile(keys[0])
      })
      .catch(() => { if (!cancelled) setPreview(null) })
      .finally(() => { if (!cancelled) setPreviewLoading(false) })
    return () => { cancelled = true }
  }, [open, effectiveWorkflow, format])

  const effectivePreview = format === 'platform' ? (platformPreview?.files || null) : preview
  const effectiveLoading = format === 'platform' ? platformLoading : previewLoading
  const fileTree = useMemo(() => effectivePreview ? buildFileTree(effectivePreview) : [], [effectivePreview])
  const fileCount = effectivePreview ? Object.keys(effectivePreview).length : 0
  const selectedContent = effectivePreview && selectedFile ? effectivePreview[selectedFile] : null
  const isMd = selectedFile?.endsWith('.md') ?? false

  const handleDownload = useCallback(async () => {
    setExporting(true)
    try {
      const exportWf = effectiveWorkflow
      const filename = exportScope === 'workspace' ? `workspace-${format}` : `${workflow}-${format}`
      if (format === 'platform' && selectedPlatform) {
        const w = await (await import('@/lib/workspace')).requireWorkspace()
        const wsFiles = await w.readAll()
        const fileMap = Object.fromEntries(wsFiles.map(f => [f.path, f.content]))
        const res = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: fileMap, format: selectedPlatform, workflowId: exportWf }),
        })
        if (!res.ok) throw new Error('Export failed')
        const result = await res.json()
        const JSZip = (await import('jszip')).default
        const zip = new JSZip()
        for (const [fp, content] of Object.entries(result.files)) zip.file(fp, content as string)
        const blob = await zip.generateAsync({ type: 'blob' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `${filename}-${selectedPlatform}.zip`; a.click()
        URL.revokeObjectURL(url)
        showNotification(`Exported ${wfName} to ${selectedPlatform}`, 'success' as any)
      } else {
        const blob = await api.exportDownload({ workflow: exportWf as string, format })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `${filename}.zip`; a.click()
        URL.revokeObjectURL(url)
        showNotification(`Exported ${wfName} (${format})`, 'success' as any)
      }
      onClose?.()
    } catch { showNotification('Export failed', 'error') }
    setExporting(false)
  }, [effectiveWorkflow, exportScope, workflow, format, selectedPlatform, wfName, showNotification, onClose])

  const handleCopy = useCallback(() => {
    if (!selectedContent) return
    navigator.clipboard.writeText(selectedContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [selectedContent])

  return (
    <div className={cn(
        'p-0 gap-0 overflow-hidden flex flex-col bg-background w-full h-full',
        fullscreen && 'fixed inset-0 z-[9999] rounded-none',
      )}>
        {/* Header */}
        <div className="relative flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 border-b bg-muted/30 shrink-0 flex-wrap">
          <FeatureHint id="export" text="Export to LangGraph, Claude, GitHub Actions, or download as ZIP. Preview the output before exporting." show={true} side="bottom" />
          <div className="size-7 sm:size-9 rounded-lg shrink-0 bg-primary flex items-center justify-center">
            <Download size={16} className="text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold">Export</span>
              <Badge variant="secondary" className="text-[11px] truncate max-w-[120px]">{wfName}</Badge>
            </div>
            <span className="text-[11px] text-muted-foreground truncate block">{FORMAT_INFO[format].desc}</span>
          </div>

          {/* Scope toggle */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
            <button onClick={() => { setExportScope('workflow'); setWorkflow(activeWf) }}
              className={cn('text-[11px] px-2 py-0.5 rounded-md transition-colors font-medium',
                exportScope === 'workflow' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              Workflow
            </button>
            <button onClick={() => setExportScope('workspace')}
              className={cn('text-[11px] px-2 py-0.5 rounded-md transition-colors font-medium',
                exportScope === 'workspace' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              Workspace
            </button>
          </div>

          {exportScope === 'workflow' && workflows.length > 1 && (
            <select value={workflow} onChange={e => setWorkflow(e.target.value)}
              className="text-[11px] border border-input rounded-md px-1.5 py-0.5 bg-background max-w-[140px]">
              {workflows.map(wf => (
                <option key={wf} value={wf}>{data!.workflows[wf].name || wf}</option>
              ))}
            </select>
          )}

          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFullscreen(f => !f)}>
                  {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                  <X size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close (Esc)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b shrink-0">
          <ToggleGroup type="single" value={format} onValueChange={v => { if (v) setFormat(v as ExportFormat) }}>
            {(Object.keys(FORMAT_INFO) as ExportFormat[]).map(f => {
              const info = FORMAT_INFO[f]; const Icon = info.icon
              return (
                <ToggleGroupItem key={f} value={f} className="text-xs gap-1.5 px-3">
                  <Icon size={14} />{info.label}
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>

          {format === 'platform' && platforms.length > 0 && (
            <select value={selectedPlatform} onChange={e => setSelectedPlatform(e.target.value)}
              className="text-xs border border-input rounded-md px-2 py-1 bg-background">
              {platforms.map(p => (
                <option key={p.name} value={p.name}>{p.displayName}</option>
              ))}
            </select>
          )}

          <div className="flex-1" />

          {format === 'platform' && platformPreview?.warnings && platformPreview.warnings.length > 0 && (
            <Badge variant="outline" className="text-[11px] gap-1 text-amber-600">
              {platformPreview.warnings.length} warnings
            </Badge>
          )}

          <Badge variant="outline" className="text-[11px] gap-1">
            <FolderOpen size={12} />{fileCount} files
          </Badge>
          <Button size="sm" onClick={handleDownload} disabled={exporting || !workflow}>
            {exporting ? (
              <><div className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent mr-1.5" />Exporting…</>
            ) : (
              <><Download size={14} className="mr-1.5" />Download ZIP</>
            )}
          </Button>
        </div>

        {/* Split pane: file tree + content viewer */}
        <div className="flex flex-1 overflow-hidden">
          {effectiveLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="size-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : effectivePreview ? (
            <>
              {/* File tree sidebar */}
              <div className="w-60 min-w-[200px] border-r overflow-auto py-1 bg-muted/20">
                {fileTree.map(entry => (
                  <FileTreeNode key={entry.path} entry={entry} depth={0}
                    selectedFile={selectedFile} onSelect={setSelectedFile} />
                ))}
                {format === 'platform' && platformPreview?.mappingReport?.exportMappings && (
                  <div className="border-t mt-2 pt-2 px-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 px-1">Mappings</p>
                    {platformPreview.mappingReport.exportMappings.map((m, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-1 py-0.5 text-[10px]">
                        <FidelityBadge level={m.fidelity} />
                        <span className="truncate text-muted-foreground">{m.source}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Content viewer */}
              <div className="flex-1 flex flex-col min-w-0">
                {selectedFile && (
                  <div className="px-3 py-1 flex items-center gap-2 border-b bg-muted/20 min-h-[38px] shrink-0">
                    <File size={13} className="opacity-50 shrink-0" />
                    <span className="text-xs font-mono truncate flex-1">{selectedFile}</span>

                    {isMd && (
                      <Tabs value={previewTab} onValueChange={v => setPreviewTab(v as 'rendered' | 'source')}>
                        <TabsList className="h-7 p-0.5">
                          <TabsTrigger value="rendered" className="text-[11px] h-6 px-2">Rendered</TabsTrigger>
                          <TabsTrigger value="source" className="text-[11px] h-6 px-2">Source</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    )}

                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
                            {copied ? <Check size={13} /> : <Copy size={13} />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{copied ? 'Copied' : 'Copy content'}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}

                <div className="flex-1 overflow-auto">
                  {selectedContent == null ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <FolderOpen size={32} className="mb-2 opacity-40" />
                      <span className="text-sm">Select a file to preview</span>
                    </div>
                  ) : isMd && previewTab === 'rendered' ? (
                    <MarkdownPreview content={selectedContent} />
                  ) : (
                    <Suspense fallback={<div className="flex items-center justify-center h-full"><Spinner /></div>}>
                      <MonacoEditor
                        height="100%"
                        language={selectedFile ? getLanguage(selectedFile) : 'json'}
                        value={selectedContent}
                        theme={resolvedTheme === 'dark' ? 'agentflow-dark' : 'agentflow-light'}
                        beforeMount={(monaco: any) => registerAgentFlowTheme(monaco)}
                        options={{
                          readOnly: true,
                          minimap: { enabled: false },
                          fontSize: 11,
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                          wordWrap: 'on',
                          tabSize: 2,
                          automaticLayout: true,
                          padding: { top: 8 },
                          fixedOverflowWidgets: true,
                        }}
                      />
                    </Suspense>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-sm text-muted-foreground">No preview available</span>
            </div>
          )}
        </div>
    </div>
  )
}

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent hideClose className="p-0 gap-0 overflow-hidden flex flex-col sm:max-w-4xl h-[82vh] max-h-[82vh]">
        <ExportDialogContent onClose={onClose} />
      </DialogContent>
    </Dialog>
  )
}
