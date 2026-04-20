'use client'

import { useState, useMemo, useCallback, useEffect, memo } from 'react'
import { Dialog, DialogContent, DialogFooter } from './ui/dialog'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { cn } from '@/lib/utils'
import {
  Search, X, Footprints, GitBranch, Layers, Link2,
  ArrowRight, Check, AlertTriangle, FileText, Settings2,
} from 'lucide-react'
import { useAppStore } from '@/store'
import { useCategoryConfig } from '../hooks/useCategoryConfig'
import { getNodeTypeColor } from '@/lib/constants'
import { getNarrativeScaffolding, DEFAULT_NARRATIVE } from '../utils/narrative'
import type { ResourceCategory, ParsedFile } from '@/lib/types'

const nodeTypeIcons: Record<string, typeof Footprints> = {
  step: Footprints,
  router: GitBranch,
  'sub-workflow': Layers,
}

export interface AttachPayload {
  resourceCategory: string
  resourceName: string
  resourceFilePath?: string
  targetNodeId?: string
}

export interface AttachResourceDialogProps {
  open: boolean
  onClose: () => void
  payload: AttachPayload | null
}

type Step = 'pick-node' | 'configure'
type Mode = 'body' | 'frontmatter'

const METADATA_HINTS: Record<string, string> = {
  capabilities: 'The agent will have access to this capability and can invoke it autonomously during execution.',
  instructions: 'The agent will follow this instruction set when executing the node.',
  runbooks: 'This runbook will be available for routing conditions or user interactions at this node.',
  memory: 'The agent can read from and write to this memory during execution.',
  hooks: 'This hook will trigger automation when the specified event occurs.',
  customFiles: 'This file will be available as structured metadata on the node.',
}

function getWarnings(
  category: string, resourceName: string, nodeType: string,
  nodeRefs: { category: string; name: string }[],
): string[] {
  const w: string[] = []
  if (nodeType === 'router' && ['capabilities', 'instructions', 'memory'].includes(category))
    w.push(`Routers usually only reference conditions and edges. Attaching a ${category.slice(0, -1)} may not have the expected effect.`)
  if (nodeType === 'sub-workflow' && category === 'runbooks')
    w.push('Runbooks are typically attached to steps, not sub-workflows.')
  if (nodeRefs.some(r => r.category === category && r.name === resourceName))
    w.push(`"${resourceName}" is already referenced by this node.`)
  if (category === 'workflows' || category === 'workflow')
    w.push('Workflows cannot be attached as references. Consider using a sub-workflow node instead.')
  return w
}

const WarningBanner = memo(function WarningBanner({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null
  return (
    <div className="flex flex-col gap-1 mb-3">
      {warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2">
          <AlertTriangle size={13} className="text-orange-500 shrink-0 mt-0.5" />
          <span className="text-[11px] text-muted-foreground leading-snug">{w}</span>
        </div>
      ))}
    </div>
  )
})

export function AttachResourceDialog({ open, onClose, payload }: AttachResourceDialogProps) {
  const data = useAppStore(s => s.data)
  const activeWf = useAppStore(s => s.activeWf)
  const save = useAppStore(s => s.save)
  const reload = useAppStore(s => s.reload)
  const showNotification = useAppStore(s => s.showNotification)
  const categoryConfig = useCategoryConfig()
  const isDark = document.documentElement.classList.contains('dark')

  const [step, setStep] = useState<Step>('pick-node')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<Mode>('body')
  const [fmKey, setFmKey] = useState('')
  const [fmValue, setFmValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && payload) {
      setSearch('')
      setSaving(false)
      setMode('body')
      if (payload.targetNodeId) {
        setSelectedNodeId(payload.targetNodeId)
        setStep('configure')
      } else {
        setSelectedNodeId(null)
        setStep('pick-node')
      }
      setFmKey(payload.resourceCategory)
      setFmValue(payload.resourceName)
    }
  }, [open, payload])

  const wf = data?.workflows[activeWf]

  const resourceFile: ParsedFile | null = useMemo(() => {
    if (!data || !payload) return null
    const cat = payload.resourceCategory as ResourceCategory
    const catMap = data[cat] as Record<string, ParsedFile> | undefined
    return catMap?.[payload.resourceName] ?? null
  }, [data, payload])

  const narrative = useMemo(() => {
    if (!payload) return { prefix: '', suffix: '' }
    const cat = payload.resourceCategory as ResourceCategory
    if (resourceFile) return getNarrativeScaffolding({ frontmatter: resourceFile.frontmatter, category: cat })
    return DEFAULT_NARRATIVE[cat] ?? { prefix: '', suffix: '' }
  }, [payload, resourceFile])

  const refSyntax = payload ? `{{${payload.resourceCategory}/${payload.resourceName}}}` : ''
  const narrativeLine = useMemo(() => {
    const parts: string[] = []
    if (narrative.prefix) parts.push(narrative.prefix)
    parts.push(refSyntax)
    if (narrative.suffix) parts.push(narrative.suffix)
    return parts.join(' ')
  }, [narrative, refSyntax])

  const nodes = useMemo(() => {
    if (!wf) return []
    return Object.entries(wf.nodes).map(([id, node]) => ({
      id, name: node.name, type: node.nodeType || 'step',
    }))
  }, [wf])

  const filteredNodes = useMemo(() => {
    if (!search.trim()) return nodes
    const q = search.toLowerCase()
    return nodes.filter(n => n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q))
  }, [nodes, search])

  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !wf) return null
    const node = wf.nodes[selectedNodeId]
    if (!node) return null
    return { id: selectedNodeId, name: node.name, type: node.nodeType || 'step', node }
  }, [selectedNodeId, wf])

  const resCfg = payload ? (categoryConfig[payload.resourceCategory] ?? categoryConfig.nodes) : null
  const warnings = useMemo(() => {
    if (!payload || !selectedNode) return []
    return getWarnings(payload.resourceCategory, payload.resourceName, selectedNode.type, selectedNode.node.allRefs)
  }, [payload, selectedNode])

  const handlePickNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId)
    setStep('configure')
  }, [])

  const handleBack = useCallback(() => {
    if (payload?.targetNodeId) onClose()
    else setStep('pick-node')
  }, [payload, onClose])

  const handleApply = useCallback(async () => {
    if (!payload || !selectedNode || !wf) return
    setSaving(true)
    try {
      const node = wf.nodes[selectedNode.id]
      if (!node) throw new Error('Node not found')
      const primaryFile = node.primaryFile
      if (!primaryFile) throw new Error('Node has no primary file')
      let newContent = primaryFile.rawContent

      if (mode === 'body') {
        newContent = newContent.trimEnd() + '\n\n' + narrativeLine + '\n'
      } else {
        const key = fmKey.trim()
        const value = fmValue.trim()
        if (!key || !value) {
          showNotification('Key and value are required', 'warning')
          setSaving(false)
          return
        }
        if (newContent.startsWith('---')) {
          const endIdx = newContent.indexOf('---', 3)
          if (endIdx !== -1) {
            const fmBlock = newContent.slice(4, endIdx)
            const body = newContent.slice(endIdx + 3)
            const lines = fmBlock.split('\n')
            let found = false
            const updatedLines = lines.map(line => {
              const match = line.match(new RegExp(`^${key}\\s*:`))
              if (match) {
                found = true
                const existing = line.slice(line.indexOf(':') + 1).trim()
                if (existing.startsWith('[')) {
                  const inner = existing.slice(1, -1)
                  return `${key}: [${inner}, ${value}]`
                }
                return existing ? `${key}: ${existing}, ${value}` : `${key}: ${value}`
              }
              return line
            })
            if (!found) updatedLines.push(`${key}: ${value}`)
            newContent = `---\n${updatedLines.join('\n')}---${body}`
          }
        } else {
          newContent = `---\n${key}: ${value}\n---\n${newContent}`
        }
      }

      await save(primaryFile.filePath, newContent)
      await reload()
      const msg = mode === 'body'
        ? `Added reference to "${selectedNode.name}"`
        : `Added "${fmKey.trim()}: ${fmValue.trim()}" to "${selectedNode.name}" metadata`
      showNotification(msg, 'info')
      onClose()
    } catch (err) {
      showNotification(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
    } finally {
      setSaving(false)
    }
  }, [payload, selectedNode, wf, mode, fmKey, fmValue, narrativeLine, save, reload, showNotification, onClose])

  if (!payload) return null

  const metadataHint = METADATA_HINTS[payload.resourceCategory] || 'This value will be stored as structured metadata on the node.'
  const accentColor = getNodeTypeColor('step', isDark ? 'dark' : 'light')

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden" hideClose>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
          <div className="w-8 h-8 rounded-lg shrink-0 bg-primary flex items-center justify-center">
            <Link2 size={16} className="text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold">
              {step === 'pick-node' ? 'Attach to Node' : 'How to Attach'}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {resCfg && (
                <Badge variant="secondary" className="text-[11px] gap-1 h-5">
                  <resCfg.icon size={10} />
                  {payload.resourceName}
                </Badge>
              )}
              {step === 'configure' && selectedNode && (
                <>
                  <ArrowRight size={12} className="text-muted-foreground" />
                  <Badge variant="outline" className="text-[11px] h-5"
                    style={{ borderColor: `${getNodeTypeColor(selectedNode.type, isDark ? 'dark' : 'light')}40` }}>
                    {selectedNode.name}
                  </Badge>
                </>
              )}
            </div>
          </div>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                  <X size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {step === 'pick-node' ? (
          /* Step 1: Pick a target node */
          <div>
            <div className="px-3 py-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search nodes…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                  className="h-8 pl-8 text-[13px]"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-80 overflow-auto px-1 pb-1">
              {filteredNodes.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {search ? 'No matching nodes' : 'No nodes in workflow'}
                </p>
              ) : (
                filteredNodes.map(node => {
                  const Icon = nodeTypeIcons[node.type] || Footprints
                  const nodeColor = getNodeTypeColor(node.type, isDark ? 'dark' : 'light')
                  return (
                    <button key={node.id} onClick={() => handlePickNode(node.id)}
                      className="flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 hover:bg-accent transition-colors text-left">
                      <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: `${nodeColor}15` }}>
                        <Icon size={14} style={{ color: nodeColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] font-semibold block truncate">{node.name}</span>
                        <span className="text-[11px] block" style={{ color: nodeColor }}>
                          {node.type === 'sub-workflow' ? 'Workflow' : node.type === 'router' ? 'Gateway' : 'Agent'}
                        </span>
                      </div>
                      <ArrowRight size={14} className="text-muted-foreground" />
                    </button>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          /* Step 2: Configure how to attach */
          <div className="px-4 py-3">
            <WarningBanner warnings={warnings} />

            {/* Option 1: Add to content */}
            <button onClick={() => setMode('body')}
              className={cn(
                'w-full text-left border rounded-lg p-3 mb-3 transition-all',
                mode === 'body'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30',
              )}>
              <div className="flex items-start gap-2">
                <div className={cn('mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                  mode === 'body' ? 'border-primary' : 'border-muted-foreground/40')}>
                  {mode === 'body' && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <FileText size={14} className="text-primary shrink-0" />
                    <span className="text-[13px] font-semibold">Add to content</span>
                    <Badge variant="secondary" className="text-[9px] h-4 px-1">Recommended</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug mb-2">
                    Inserts a reference into the node's instructions. The agent sees this inline and follows it as part of the step's narrative.
                  </p>
                  <div className="bg-muted rounded-md px-3 py-1.5 text-[11px] flex flex-wrap items-center gap-1">
                    {narrative.prefix && <span className="text-muted-foreground">{narrative.prefix}</span>}
                    <Badge variant="secondary" className="text-[10px] gap-0.5">
                      {resCfg && <resCfg.icon size={9} />}
                      {payload.resourceName}
                    </Badge>
                    {narrative.suffix && <span className="text-muted-foreground">{narrative.suffix}</span>}
                  </div>
                </div>
              </div>
            </button>

            {/* Option 2: Add to metadata */}
            <button onClick={() => setMode('frontmatter')}
              className={cn(
                'w-full text-left border rounded-lg p-3 transition-all',
                mode === 'frontmatter'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30',
              )}>
              <div className="flex items-start gap-2">
                <div className={cn('mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                  mode === 'frontmatter' ? 'border-primary' : 'border-muted-foreground/40')}>
                  {mode === 'frontmatter' && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Settings2 size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-[13px] font-semibold">Add to metadata</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{metadataHint}</p>
                  {mode === 'frontmatter' ? (
                    <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
                      <Input value={fmKey} onChange={e => setFmKey(e.target.value)}
                        placeholder="key" className="h-7 text-[11px] font-mono flex-1" />
                      <span className="text-muted-foreground self-center text-xs">:</span>
                      <Input value={fmValue} onChange={e => setFmValue(e.target.value)}
                        placeholder="value" className="h-7 text-[11px] font-mono flex-1" />
                    </div>
                  ) : (
                    <div className="bg-muted rounded-md px-3 py-1.5 mt-2 font-mono text-[11px] text-muted-foreground truncate">
                      {fmKey}: {fmValue}
                    </div>
                  )}
                </div>
              </div>
            </button>
          </div>
        )}

        {step === 'configure' && (
          <DialogFooter className="px-4 py-3 border-t">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              {payload.targetNodeId ? 'Cancel' : 'Back'}
            </Button>
            <Button size="sm" onClick={handleApply}
              disabled={saving || (mode === 'frontmatter' && (!fmKey.trim() || !fmValue.trim()))}>
              {saving ? (
                <><div className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent mr-1.5" /> Saving…</>
              ) : (
                <><Check size={14} className="mr-1.5" /> {mode === 'body' ? 'Add to Content' : 'Add to Metadata'}</>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
