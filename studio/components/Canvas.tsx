'use client'

import {
  ReactFlow, Background, MiniMap, MarkerType,
  type Node as RFNode, type Edge as RFEdge, type NodeTypes, type EdgeTypes,
  type Connection,
  useNodesState, useEdgesState, useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useAppStore } from '@/store'
import { Plus, Layers, Footprints, GitBranch, X, Sparkles, Search, ArrowRight, Trash2 } from 'lucide-react'
import { emit } from '@/utils/events'
import { nodeTypes as customNodeTypes, edgeTypes as customEdgeTypes } from './canvas/node-types'
import type { WorkflowNodeData } from './canvas/WorkflowNode'
import type { WorkflowEdgeData } from './canvas/WorkflowEdge'
import { getNodeTypeColor, getCategoryConfig } from '@/lib/constants'
import { elkLayout, gridLayout } from '../utils/auto-layout'
import type { ResourceCategory } from '@/lib/types'
import type { ResourceNodeData } from './canvas/ResourceNode'
import { AttachResourceDialog, type AttachPayload } from './AttachResourceDialog'
import { useCreateNode } from '../utils/node-actions'
import { CanvasContextMenu, type ContextMenuPos, type ContextMenuTarget } from './CanvasContextMenu'
import { Button } from './ui/button'
import { NodeTemplatePicker } from './NodeTemplatePicker'

const nodeTypes: NodeTypes = customNodeTypes as unknown as NodeTypes
const edgeTypes: EdgeTypes = customEdgeTypes as unknown as EdgeTypes

const savedPositions: Record<string, Record<string, { x: number; y: number }>> = {}

function getSavedPositions(wfId: string): Record<string, { x: number; y: number }> {
  if (!savedPositions[wfId]) { try { savedPositions[wfId] = JSON.parse(localStorage.getItem(`af-pos-${wfId}`) || '{}') } catch { savedPositions[wfId] = {} } }
  return savedPositions[wfId]
}

function savePositions(wfId: string, nodes: RFNode[]) {
  const p: Record<string, { x: number; y: number }> = {}; for (const n of nodes) p[n.id] = n.position; savedPositions[wfId] = p; localStorage.setItem(`af-pos-${wfId}`, JSON.stringify(p))
}


function getNarrativeAffixes(frontmatter: Record<string, unknown> | undefined): { prefix?: string; suffix?: string } {
  if (!frontmatter) return {}
  const narrativeTemplate = frontmatter.narrativeTemplate
  if (!narrativeTemplate || typeof narrativeTemplate !== 'object') return {}
  const raw = narrativeTemplate as Record<string, unknown>
  return {
    prefix: typeof raw.prefix === 'string' ? raw.prefix : undefined,
    suffix: typeof raw.suffix === 'string' ? raw.suffix : undefined,
  }
}

function SelectionSyncHandler() {
  const selection = useAppStore(s => s.selection); const reactFlowInstance = useReactFlow(); const prevSelectionRef = useRef<typeof selection>(null)
  useEffect(() => {
    if (!selection || selection === prevSelectionRef.current) return; prevSelectionRef.current = selection
    let canvasNodeId: string | null = null
    if (selection.type === 'node') canvasNodeId = `step:${selection.key}`
    else if (selection.type === 'resource' && selection.category) canvasNodeId = `${selection.category}:${selection.key}`
    if (!canvasNodeId) return; const rfNode = reactFlowInstance.getNode(canvasNodeId)
    if (rfNode) reactFlowInstance.fitView({ nodes: [{ id: canvasNodeId }], duration: 300, padding: 1.5, maxZoom: 1.2 })
  }, [selection, reactFlowInstance])
  return null
}

export function Canvas() {
  const data = useAppStore(s => s.data); const activeWf = useAppStore(s => s.activeWf); const select = useAppStore(s => s.select)
  const isIdentitySelected = useAppStore(s => s.selection?.type === 'identity')
  const setActiveWf = useAppStore(s => s.setActiveWf)
  const drillIntoSubWorkflow = useAppStore(s => s.drillIntoSubWorkflow)
  const deleteNode = useAppStore(s => s.deleteNode); const duplicateNode = useAppStore(s => s.duplicateNode)
  const save = useAppStore(s => s.save); const reload = useAppStore(s => s.reload); const showNotification = useAppStore(s => s.showNotification)
  const addFromLibrary = useAppStore(s => s.addFromLibrary)
  const setDrawerOpen = useAppStore(s => s.setDrawerOpen); const openFocus = useAppStore(s => s.openFocus)
  const resolvedTheme = useAppStore(s => s.resolvedTheme)
  const addNode = useCreateNode()
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>([]); const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>([])
  const isDark = resolvedTheme === 'dark'
  const reactFlowWrapper = useRef<HTMLDivElement>(null); const reactFlowInstance = useReactFlow()
  const [attachPayload, setAttachPayload] = useState<AttachPayload | null>(null)
  const [dropHover, setDropHover] = useState(false)
  const [clickTrail, setClickTrail] = useState<string[]>([])
  const [ctxPos, setCtxPos] = useState<ContextMenuPos | null>(null)
  const [ctxTarget, setCtxTarget] = useState<ContextMenuTarget | null>(null)
  const [dblClickPos, setDblClickPos] = useState<{ x: number; y: number } | null>(null)
  const [dblClickFlowPos, setDblClickFlowPos] = useState<{ x: number; y: number } | null>(null)
  const [edgePopover, setEdgePopover] = useState<{ x: number; y: number; from: string; to: string; condition?: string; edgeId: string } | null>(null)

  const selectRef = useRef(select); selectRef.current = select
  const edgesRef = useRef(edges); edgesRef.current = edges
  const setDrawerOpenRef = useRef(setDrawerOpen); setDrawerOpenRef.current = setDrawerOpen
  const openFocusModalRef = useRef(openFocus); openFocusModalRef.current = openFocus
  const drillIntoSubWorkflowRef = useRef(drillIntoSubWorkflow); drillIntoSubWorkflowRef.current = drillIntoSubWorkflow

  const wf = activeWf ? data?.workflows[activeWf] : null
  const primaryColor = 'var(--node-step)'

  const buildGraph = useCallback(() => {
    if (!data) { setNodes([]); setEdges([]); return }

    // ── Workspace view: show all workflows as nodes ──
    if (!activeWf) {
      const entries = Object.entries(data.workflows)
      const rfNodes: RFNode[] = []

      // Workspace identity node
      if (data.descriptorFile) {
        rfNodes.push({
          id: 'workspace-identity',
          type: 'step',
          position: { x: entries.length > 1 ? 150 : 0, y: 0 },
          data: { id: 'workspace-identity', nodeType: 'step', name: (data.descriptorFile as any)?.frontmatter?.name || 'Workspace', status: 'idle', entry: true } as unknown as Record<string, unknown>,
        })
      }

      // Workflow nodes
      entries.forEach(([id, wfDef], i) => {
        rfNodes.push({
          id: `step:${id}`,
          type: 'step',
          position: { x: (i % 4) * 300, y: 200 + Math.floor(i / 4) * 200 },
          data: { id, nodeType: 'sub-workflow', name: (wfDef as any).name || id, status: 'idle' } as unknown as Record<string, unknown>,
        })
      })

      // Edges from workspace identity to each workflow
      const rfEdges: RFEdge[] = data.descriptorFile ? entries.map(([id]) => ({
        id: `workspace-identity->${id}`,
        source: 'workspace-identity',
        target: `step:${id}`,
        type: 'workflow',
      })) : []

      setNodes(rfNodes); setEdges(rfEdges); return
    }

    if (!wf) { setNodes([]); setEdges([]); return }
    const rfNodes: RFNode[] = []; const rfEdges: RFEdge[] = []
    const catConfig = getCategoryConfig(isDark ? 'dark' : 'light')

    // ── Workflow step nodes ──
    for (const [id, node] of Object.entries(wf.nodes)) {
      const rfType = node.nodeType === 'router' ? 'router' : node.nodeType === 'sub-workflow' ? 'sub-workflow' : 'step'
      const { prefix, suffix } = getNarrativeAffixes(node.frontmatter)
      const nodeData: WorkflowNodeData = {
        id, name: node.name, nodeType: rfType as WorkflowNodeData['nodeType'],
        description: (node as any).description,
        toolCount: (node as any).toolCount ?? 0,
        refCounts: (() => {
          const counts = { instructions: 0, capabilities: 0, skills: 0, memory: 0 }
          for (const ref of node.allRefs || []) {
            const cat = ref.category as keyof typeof counts
            if (cat in counts) counts[cat]++
          }
          return counts
        })(),
        contextFileCount: node.contextFiles?.length ?? 0,
        status: (node as any).status ?? 'idle',
        isEntry: wf.entryPoints?.includes(id) ?? false,
        prefix, suffix,
      }
      rfNodes.push({ id: `step:${id}`, type: rfType, position: { x: 0, y: 0 }, data: nodeData as unknown as Record<string, unknown> })
    }

    // ── Edges + condition gate nodes ──
    for (const edge of wf.edges) {
      if (edge.condition) {
        // Conditional edge: insert a condition gate node between source and target
        const condName = edge.condition
        const condId = `cond:${edge.from}-${condName}-${edge.to}`
        const cfg = catConfig['skills'] ?? catConfig['instructions']

        const condData: ResourceNodeData = {
          id: condId, name: condName, category: 'condition',
          label: 'Condition', color: '#f59e0b',
          description: edge.condition,
          subType: undefined,
          ecosystemHint: cfg?.ecosystemHint,
          compact: false,
        }
        rfNodes.push({ id: condId, type: 'resource', position: { x: 0, y: 0 }, data: condData as unknown as Record<string, unknown> })

        // Edge: source → condition gate
        rfEdges.push({
          id: `flow:${edge.from}-${condId}`, source: `step:${edge.from}`, target: condId, type: 'custom',
          data: { label: condName, edgeType: 'condition-in' } as Record<string, unknown>,
          markerEnd: { type: MarkerType.ArrowClosed, color: isDark ? '#fbbf24' : '#f59e0b', width: 16, height: 16 },
        })
        // Edge: condition gate → target
        rfEdges.push({
          id: `flow:${condId}-${edge.to}`, source: condId, target: `step:${edge.to}`, type: 'custom',
          data: { label: edge.to, edgeType: 'condition-out' } as Record<string, unknown>,
          markerEnd: { type: MarkerType.ArrowClosed, color: isDark ? '#fbbf24' : '#f59e0b', width: 16, height: 16 },
        })
      } else {
        // Unconditional edge
        const edgeData: WorkflowEdgeData = { condition: edge.condition, label: edge.to }
        rfEdges.push({
          id: `flow:${edge.from}-${edge.to}`, source: `step:${edge.from}`, target: `step:${edge.to}`, type: 'custom',
          data: edgeData as Record<string, unknown>,
          markerEnd: { type: MarkerType.ArrowClosed, color: primaryColor, width: 20, height: 20 },
        })
      }
    }

    // ── Layout ──
    // gridLayout/elkLayout use `step:` prefix internally, so we need to map condition nodes
    const stepIds = Object.keys(wf.nodes)
    const condNodeIds = rfNodes.filter(n => n.id.startsWith('cond:')).map(n => n.id)
    // Include condition nodes as if they were steps for layout purposes
    const allLayoutIds = [...stepIds, ...condNodeIds]

    const positions = gridLayout(allLayoutIds)
    const saved = getSavedPositions(activeWf)
    for (const n of rfNodes) {
      const key = n.id.startsWith('step:') ? n.id : `step:${n.id}`
      n.position = saved[n.id] || positions[key] || { x: 0, y: 0 }
    }
    setNodes(rfNodes); setEdges(rfEdges)

    // Async ELK layout on initial load (no saved positions)
    if (Object.keys(saved).length === 0) {
      const elkEdgeDefs = rfEdges.map(e => ({
        from: e.source.replace(/^step:/, ''),
        to: e.target.replace(/^step:/, ''),
        sourceRef: {} as any,
      }))
      elkLayout(allLayoutIds, elkEdgeDefs).then(elkPos => {
        setNodes(prev => prev.map(n => {
          const key = n.id.startsWith('step:') ? n.id : `step:${n.id}`
          return elkPos[key] ? { ...n, position: elkPos[key] } : n
        }))
      }).catch(() => {})
    }
  }, [wf, data, activeWf, setNodes, setEdges, isDark, primaryColor])

  // ── Focus + Dim ──
  useEffect(() => {
    if (!wf || clickTrail.length === 0) {
      setNodes(prev => {
        if (prev.every(n => !n.className)) return prev
        return prev.map(n => ({ ...n, className: '' }))
      })
      setEdges(prev => {
        if (prev.every(e => !e.style?.opacity)) return prev
        return prev.map(e => ({
          ...e,
          style: { ...e.style, opacity: undefined, stroke: undefined, strokeWidth: undefined, transition: undefined },
        }))
      })
      return
    }

    const focusSet = new Set(clickTrail)
    // Build set of React Flow node IDs for matching against edge source/target
    const focusNodeIds = new Set(clickTrail.map(id =>
      id.startsWith('cond:') ? id : `step:${id}`
    ))

    // Pre-compute active edges and neighbor nodes from current edges
    const activeEdgeIds = new Set<string>()
    const neighborNodeIds = new Set<string>()

    // We need current edges to compute — read from nodes/edges state directly
    for (const e of edgesRef.current) {
      const srcIsFocused = focusNodeIds.has(e.source) || focusSet.has(e.source)
      const tgtIsFocused = focusNodeIds.has(e.target) || focusSet.has(e.target)

      if (srcIsFocused || tgtIsFocused) {
        activeEdgeIds.add(e.id)
        if (srcIsFocused) neighborNodeIds.add(e.target)
        if (tgtIsFocused) neighborNodeIds.add(e.source)
      }
    }

    // Apply to edges — active edges keep their original color but brighter, inactive dim
    setEdges(prev => prev.map(e => ({
      ...e,
      style: {
        ...e.style,
        opacity: activeEdgeIds.has(e.id) ? 1 : 0.06,
        strokeWidth: activeEdgeIds.has(e.id) ? 3 : undefined,
        transition: 'opacity 0.3s ease-out',
      },
    })))

    // Apply to nodes
    setNodes(prev => prev.map(n => {
      const isFocused = focusNodeIds.has(n.id)
      const isNeighbor = neighborNodeIds.has(n.id)
      const lastTrailId = clickTrail[clickTrail.length - 1]
      const lastNodeId = lastTrailId?.startsWith('cond:') ? lastTrailId : `step:${lastTrailId}`
      return {
        ...n,
        className: isFocused
          ? (n.id === lastNodeId ? 'af-node-focused' : 'af-node-neighbor')
          : isNeighbor
            ? 'af-node-neighbor'
            : 'af-node-dimmed',
      }
    }))
  }, [clickTrail, wf, setNodes, setEdges])

  // ── Click Trail: sequential clicks build focus group ──
  const handleTrailClick = useCallback((stepId: string) => {
    setClickTrail(prev => {
      // Don't add the same node twice in a row
      if (prev.length > 0 && prev[prev.length - 1] === stepId) return prev
      return [...prev, stepId]
    })
  }, [])

  const clearTrail = useCallback(() => {
    setClickTrail([])
    setNodes(prev => prev.map(n => ({ ...n, className: '' })))
    setEdges(prev => prev.map(e => ({
      ...e,
      style: { ...e.style, opacity: undefined, strokeWidth: undefined, transition: undefined },
    })))
  }, [setNodes, setEdges])

  const onConnect = useCallback(async (connection: Connection) => {
    if (!wf || !data || !connection.source || !connection.target) return
    const sourceId = connection.source.replace(/^step:/, ''); const targetId = connection.target.replace(/^step:/, '')
    const sourceNode = wf.nodes[sourceId]; const targetNode = wf.nodes[targetId]
    if (!sourceNode || !targetNode) return
    if (wf.edges.find(e => e.from === sourceId && e.to === targetId)) { showNotification('Duplicate edge', 'warning'); return }
    const newContent = sourceNode.primaryFile.rawContent + `\n{{-> nodes/${targetNode.name}}}\n`
    await save(sourceNode.primaryFile.filePath, newContent); await reload()
  }, [wf, data, save, reload, showNotification])

  const handleAutoLayout = useCallback(async () => {
    if (!wf || !data) return
    delete savedPositions[activeWf]; localStorage.removeItem(`af-pos-${activeWf}`)
    // Include condition gate nodes in layout
    const condIds = nodes.filter(n => n.id.startsWith('cond:')).map(n => n.id)
    const allIds = [...Object.keys(wf.nodes), ...condIds]
    const allEdgeDefs = edges.map(e => ({
      from: e.source.replace(/^step:/, ''),
      to: e.target.replace(/^step:/, ''),
      sourceRef: {} as any,
    }))
    const elkPos = await elkLayout(allIds, allEdgeDefs)
    setNodes(prev => prev.map(n => {
      const key = n.id.startsWith('step:') ? n.id : `step:${n.id}`
      return elkPos[key] ? { ...n, position: elkPos[key] } : n
    }))
    requestAnimationFrame(() => reactFlowInstance.fitView({ duration: 400, padding: 0.05, maxZoom: 2.5 }))
  }, [wf, data, activeWf, setNodes, nodes, edges, reactFlowInstance])

  useEffect(() => {
    buildGraph()
    requestAnimationFrame(() => reactFlowInstance.fitView({ duration: 400, padding: 0.05, maxZoom: 2.5 }))
  }, [buildGraph, reactFlowInstance])

  useEffect(() => {
    const onAutoLayout = () => handleAutoLayout(); const onFitView = () => reactFlowInstance.fitView({ duration: 400, padding: 0.05, maxZoom: 2.5 })
    window.addEventListener('agentflow:auto-layout', onAutoLayout); window.addEventListener('agentflow:fit-view', onFitView)
    return () => { window.removeEventListener('agentflow:auto-layout', onAutoLayout); window.removeEventListener('agentflow:fit-view', onFitView) }
  }, [handleAutoLayout, reactFlowInstance])

  const handlePaneDoubleClick = useCallback((event: React.MouseEvent) => {
    setDblClickPos({ x: event.clientX, y: event.clientY })
    setDblClickFlowPos(reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY }))
  }, [reactFlowInstance])

  useEffect(() => { const handler = (e: Event) => { const detail = (e as CustomEvent).detail as AttachPayload; if (detail) setAttachPayload(detail) }; window.addEventListener('agentflow:attach-resource', handler); return () => window.removeEventListener('agentflow:attach-resource', handler) }, [])

  // Node toolbar CustomEvents (delete, duplicate, focus)
  useEffect(() => {
    const onDelete = async (e: Event) => {
      const nodeId = (e as CustomEvent).detail
      if (!activeWf || !nodeId) return
      try {
        await deleteNode(activeWf, nodeId)
        await reload()
        showNotification(`Deleted "${nodeId}"`, 'info')
      } catch { showNotification('Failed to delete node', 'error') }
    }
    const onDuplicate = async (e: Event) => {
      const nodeId = (e as CustomEvent).detail
      if (!activeWf || !nodeId) return
      try {
        await duplicateNode(activeWf, nodeId)
        await reload()
        showNotification(`Duplicated "${nodeId}"`, 'info')
      } catch { showNotification('Failed to duplicate node', 'error') }
    }
    const onFocus = (e: Event) => {
      const nodeId = (e as CustomEvent).detail
      if (nodeId && activeWf) openFocus({ type: 'node', nodeId, workflowId: activeWf })
    }
    window.addEventListener('node:delete', onDelete)
    window.addEventListener('node:duplicate', onDuplicate)
    window.addEventListener('node:focus', onFocus)
    return () => {
      window.removeEventListener('node:delete', onDelete)
      window.removeEventListener('node:duplicate', onDuplicate)
      window.removeEventListener('node:focus', onFocus)
    }
  }, [activeWf, deleteNode, duplicateNode, reload, showNotification, openFocus])

  // Resource toolbar CustomEvents (delete, duplicate)
  useEffect(() => {
    const onResDelete = async (e: Event) => {
      const { category, name } = (e as CustomEvent).detail ?? {}
      if (!category || !name || !data) return
      const file = (data[category as keyof typeof data] as Record<string, any>)?.[name]
      if (!file?.relativePath) { showNotification('Resource file not found', 'error'); return }
      try {
        await save(file.relativePath, '') // clear content to trigger deletion
        await reload()
        showNotification(`Deleted "${name}"`, 'info')
      } catch { showNotification('Failed to delete resource', 'error') }
    }
    const onResDuplicate = async (e: Event) => {
      const { category, name } = (e as CustomEvent).detail ?? {}
      if (!category || !name || !data) return
      const file = (data[category as keyof typeof data] as Record<string, any>)?.[name]
      if (!file?.relativePath || !file?.rawContent) { showNotification('Resource file not found', 'error'); return }
      const newPath = file.relativePath.replace(/\.md$/, '-copy.md')
      try {
        await save(newPath, file.rawContent)
        await reload()
        showNotification(`Duplicated "${name}"`, 'info')
      } catch { showNotification('Failed to duplicate resource', 'error') }
    }
    window.addEventListener('resource:delete', onResDelete)
    window.addEventListener('resource:duplicate', onResDuplicate)
    return () => {
      window.removeEventListener('resource:delete', onResDelete)
      window.removeEventListener('resource:duplicate', onResDuplicate)
    }
  }, [data, save, reload, showNotification])

  const { setNodeRef: setCanvasDropRef } = useDroppable({ id: 'drop:canvas', data: { type: 'canvas-background' } })

  const handleNativeDragOver = useCallback((e: React.DragEvent) => { if (e.dataTransfer.types.includes('application/agentflow-resource') || e.dataTransfer.types.includes('application/agentflow-library') || e.dataTransfer.types.includes('application/agentflow-workflow')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDropHover(true) } }, [])

  const handleNativeDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the canvas entirely (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropHover(false)
  }, [])

  const handleNativeDrop = useCallback(async (e: React.DragEvent) => {
    setDropHover(false)

    // Drop a workflow → create a sub-workflow node
    const rawWorkflow = e.dataTransfer.getData('application/agentflow-workflow')
    if (rawWorkflow && activeWf) {
      e.preventDefault()
      try {
        const p = JSON.parse(rawWorkflow)
        const name = (p.name || p.id).replace(/[^a-zA-Z0-9-]/g, '-')
        const flowPos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY })
        // Pre-save position so buildGraph picks it up
        try {
          const key = `af-pos-${activeWf}`
          const saved = JSON.parse(localStorage.getItem(key) || '{}')
          saved[`step:${name}`] = flowPos
          localStorage.setItem(key, JSON.stringify(saved))
        } catch { /* best-effort */ }
        await useAppStore.getState().createNode(activeWf, name, 'sub-workflow', p.id)
        useAppStore.getState().select({ type: 'node', key: name, workflowId: activeWf })
        showNotification(`Added "${p.name || p.id}" — double-click to navigate`, 'success')
      } catch {
        showNotification('Failed to create workflow node', 'error')
      }
      return
    }

    const rawResource = e.dataTransfer.getData('application/agentflow-resource')
    if (rawResource) {
      e.preventDefault()
      try {
        const p = JSON.parse(rawResource)
        setAttachPayload({ resourceCategory: p.category, resourceName: p.name, resourceFilePath: p.filePath })
      } catch {
        showNotification('Unable to attach dropped resource. Invalid payload.', 'warning')
      }
      return
    }
    const rawLibrary = e.dataTransfer.getData('application/agentflow-library')
    if (rawLibrary) {
      e.preventDefault()
      try {
        const p = JSON.parse(rawLibrary)
        const entryType = p.entryType
        const cat = entryType.endsWith('s') ? entryType : entryType + 's'
        // Auto-install library item to workspace, then open attach dialog
        try {
          await addFromLibrary(entryType, p.name)
          showNotification(`Installed "${p.name}" to workspace`, 'info')
        } catch {
          // May already be installed — continue to attach
        }
        setAttachPayload({ resourceCategory: cat, resourceName: p.name })
      } catch {
        showNotification('Unable to attach dropped library item.', 'warning')
      }
    }
  }, [showNotification, addFromLibrary])

  const hasNodes = wf && Object.keys(wf.nodes).length > 0

  // Edge click → show popover
  const handleEdgeClick = useCallback((_e: React.MouseEvent, edge: RFEdge) => {
    const fromId = edge.source.replace(/^step:/, '')
    const toId = edge.target.replace(/^step:/, '')
    const edgeData = edge.data as WorkflowEdgeData | undefined
    const rect = reactFlowWrapper.current?.getBoundingClientRect()
    if (!rect) return
    setEdgePopover({
      x: _e.clientX - rect.left,
      y: _e.clientY - rect.top,
      from: wf?.nodes[fromId]?.name || fromId,
      to: wf?.nodes[toId]?.name || toId,
      condition: edgeData?.condition,
      edgeId: edge.id,
    })
  }, [wf])

  // Close edge popover on pane click
  const handlePaneClick = useCallback(() => {
    select(null)
    setEdgePopover(null)
    if (clickTrail.length > 0) clearTrail()
  }, [select, clickTrail, clearTrail])

  // Context menu handlers
  const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: RFNode) => {
    e.preventDefault()
    setCtxPos({ x: e.clientX, y: e.clientY })
    if (node.type === 'resource') {
      const d = node.data as unknown as ResourceNodeData
      setCtxTarget({ kind: 'resource', category: d.category, name: d.name })
    } else {
      const id = node.id.replace(/^step:/, '')
      setCtxTarget({ kind: 'node', nodeId: id, nodeName: wf?.nodes[id]?.name || id })
    }
  }, [wf])

  const handlePaneContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.preventDefault()
    const clientX = 'clientX' in e ? e.clientX : 0
    const clientY = 'clientY' in e ? e.clientY : 0
    setCtxPos({ x: clientX, y: clientY })
    setCtxTarget({ kind: 'pane' })
  }, [])

  const handleEdgeContextMenu = useCallback((e: React.MouseEvent, edge: RFEdge) => {
    e.preventDefault()
    const fromId = edge.source.replace(/^step:/, '')
    const toId = edge.target.replace(/^step:/, '')
    const edgeData = edge.data as WorkflowEdgeData | undefined
    setCtxPos({ x: e.clientX, y: e.clientY })
    setCtxTarget({ kind: 'edge', edgeId: edge.id, from: wf?.nodes[fromId]?.name || fromId, to: wf?.nodes[toId]?.name || toId, condition: edgeData?.condition })
  }, [wf])

  const handleCtxAction = useCallback(async (action: string, payload?: any) => {
    if (action === 'delete' && activeWf && payload) {
      try { await deleteNode(activeWf, payload); await reload(); showNotification(`Deleted "${payload}"`, 'info') } catch { showNotification('Failed to delete', 'error') }
    } else if (action === 'duplicate' && activeWf && payload) {
      try { await duplicateNode(activeWf, payload); await reload(); showNotification(`Duplicated "${payload}"`, 'info') } catch { showNotification('Failed to duplicate', 'error') }
    } else if (action === 'focus' && activeWf && payload) {
      openFocus({ type: 'node', nodeId: payload, workflowId: activeWf })
    } else if (action === 'copy-name' && payload) {
      navigator.clipboard.writeText(payload).then(() => showNotification('Copied', 'info')).catch(() => {})
    } else if (action === 'auto-layout') {
      window.dispatchEvent(new CustomEvent('agentflow:auto-layout'))
    } else if (action === 'delete-edge' && payload && wf) {
      // Parse edge id: "flow:fromId-toId"
      const match = (payload as string).match(/^flow:(.+)-(.+)$/)
      if (match) {
        const [, fromId, toId] = match
        const sourceNode = wf.nodes[fromId]
        const targetNode = wf.nodes[toId]
        if (sourceNode && targetNode) {
          const raw = sourceNode.primaryFile.rawContent
          // Remove the edge reference line
          const refPattern = new RegExp(`\\n?\\{\\{->\\s*nodes/${targetNode.name}(\\s*\\|[^}]*)?\\}\\}`, 'g')
          const newContent = raw.replace(refPattern, '')
          try { await save(sourceNode.primaryFile.filePath, newContent); await reload(); showNotification('Edge deleted', 'info') } catch { showNotification('Failed to delete edge', 'error') }
        }
      }
    } else if (action === 'delete-resource' && payload && data) {
      const { category, name } = payload
      const file = (data[category as keyof typeof data] as Record<string, any>)?.[name]
      if (file?.relativePath) {
        try { await save(file.relativePath, ''); await reload(); showNotification(`Deleted "${name}"`, 'info') } catch { showNotification('Failed to delete resource', 'error') }
      }
    } else if (action === 'duplicate-resource' && payload && data) {
      const { category, name } = payload
      const file = (data[category as keyof typeof data] as Record<string, any>)?.[name]
      if (file?.relativePath && file?.rawContent) {
        const newPath = file.relativePath.replace(/\.md$/, '-copy.md')
        try { await save(newPath, file.rawContent); await reload(); showNotification(`Duplicated "${name}"`, 'info') } catch { showNotification('Failed to duplicate resource', 'error') }
      }
    }
  }, [activeWf, deleteNode, duplicateNode, reload, showNotification, openFocus, select, reactFlowInstance, wf, save, data])

  return (
    <div data-tour="canvas" ref={(el) => { setCanvasDropRef(el); if (reactFlowWrapper.current !== el) (reactFlowWrapper as React.RefObject<HTMLDivElement | null>).current = el }} className="relative h-full min-h-0 w-full" onDragOver={handleNativeDragOver} onDragLeave={handleNativeDragLeave} onDrop={handleNativeDrop}>
      {/* Drop zone overlay */}
      {dropHover && (
        <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-primary/5 border-2 border-dashed border-primary/40 rounded-lg" />
          <div className="relative bg-card/90 backdrop-blur-sm border border-primary/30 rounded-xl px-6 py-4 shadow-lg text-center">
            <Plus size={24} className="mx-auto mb-1 text-primary" />
            <p className="text-sm font-medium">Drop to attach</p>
            <p className="text-xs text-muted-foreground">Resource will be linked to a node</p>
          </div>
        </div>
      )}
      {/* Workspace identity badge */}
      {/* Workflow identity badge */}
      {/* Workflow identity badge (workflow view only) */}
      {activeWf && wf && (
        <button
          onClick={() => select({ type: 'identity', key: `${activeWf}/AGENTS.md` })}
          className={`absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-sm transition-all ${
            isIdentitySelected
              ? 'bg-primary/15 border-primary/40 text-primary shadow-[0_0_12px_rgba(99,102,241,0.25)]'
              : 'bg-card/80 border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isIdentitySelected ? 'bg-primary shadow-[0_0_6px_rgba(99,102,241,0.5)]' : 'bg-muted-foreground/40'}`} />
          {String((wf as any).name || activeWf)}
        </button>
      )}
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        onNodeDragStop={(_e, _n, allNodes) => savePositions(activeWf, allNodes)}
        onNodeClick={(e, node) => {
          if (e.metaKey || e.ctrlKey) return
          const raw = node.id
          setEdgePopover(null)

          // Workspace view: clicking a workflow node navigates to it
          if (!activeWf) {
            if (raw === 'workspace-identity') {
              select({ type: 'identity', key: 'AGENTS.md' })
              return
            }
            const wfId = raw.replace(/^step:/, '')
            setActiveWf(wfId)
            return
          }

          if (raw.startsWith('step:')) {
            const stepId = raw.replace(/^step:/, '')
            handleTrailClick(stepId)
            select({ type: 'node', key: stepId, workflowId: activeWf })
          } else if (raw.startsWith('cond:')) {
            // Condition gate — show edge popover with condition info
            handleTrailClick(raw)
            const d = node.data as unknown as ResourceNodeData
            // Parse source/target from condId format: cond:{from}-{condName}-{to}
            const parts = raw.replace(/^cond:/, '').split('-')
            const fromId = parts[0] || ''
            const toId = parts[parts.length - 1] || ''
            const rect = reactFlowWrapper.current?.getBoundingClientRect()
            if (rect) {
              setEdgePopover({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                from: wf?.nodes[fromId]?.name || fromId,
                to: wf?.nodes[toId]?.name || toId,
                condition: d?.description || d?.name,
                edgeId: raw,
              })
            }
          } else {
            // Other resource nodes
            const d = node.data as unknown as ResourceNodeData
            if (d?.category && d?.name) {
              select({ type: 'resource', category: d.category as any, key: d.name })
            }
          }
        }}
        onNodeDoubleClick={(_e, node) => {
          if (node.type === 'resource') return
          const id = node.id.replace(/^step:/, '')
          const n = wf?.nodes[id]
          if (n?.nodeType === 'sub-workflow') {
            const linkedWf = n.subWorkflow?.id || (n as any).frontmatter?.workflow
            if (linkedWf && data?.workflows[linkedWf]) {
              drillIntoSubWorkflow(linkedWf)
              return
            }
          }
          openFocus({ type: 'node', nodeId: id, workflowId: activeWf })
        }}
        onEdgeClick={handleEdgeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        onPaneClick={handlePaneClick} onDoubleClick={handlePaneDoubleClick} fitView fitViewOptions={{ padding: 0.05, maxZoom: 2.5 }}
        minZoom={0.2} maxZoom={2} zoomOnScroll zoomOnPinch panOnScroll={false} proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'custom' }} connectionLineStyle={{ stroke: primaryColor, strokeWidth: 2.5, strokeDasharray: '6 3' }}
        connectionRadius={20} colorMode={isDark ? 'dark' : 'light'} className="h-full w-full !bg-background">
        <SelectionSyncHandler />
        <Background color={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.10)'} gap={20} size={1.5} />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          zoomStep={10}
          offsetScale={8}
          nodeBorderRadius={10}
          nodeStrokeWidth={1}
          nodeColor={(n) => {
            if (n.type === 'resource') {
              const d = n.data as unknown as ResourceNodeData
              return d?.color ?? '#888'
            }
            if (n.type === 'router') return getNodeTypeColor('router', resolvedTheme)
            if (n.type === 'sub-workflow') return getNodeTypeColor('sub-workflow', resolvedTheme)
            return getNodeTypeColor('step', resolvedTheme, primaryColor)
          }}
          nodeStrokeColor={(n) => n.selected ? 'var(--primary)' : 'transparent'}
          bgColor={isDark ? 'hsl(220 10% 9%)' : 'hsl(0 0% 98%)'}
          maskColor={isDark ? 'rgba(0,0,0,0.4)' : 'rgba(240,240,240,0.7)'}
          maskStrokeColor={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}
          maskStrokeWidth={1.5}
          onNodeClick={(_e, node) => {
            if (node.type === 'step' || node.type === 'router' || node.type === 'sub-workflow') {
              const nodeId = node.id.replace('step:', '')
              window.dispatchEvent(new CustomEvent('node:focus', { detail: nodeId }))
            }
          }}
          className="!rounded-xl !border !border-border/30 !shadow-sm"
          style={{ width: 280, height: 180, marginRight: 12, marginBottom: 32 }}
        />
      </ReactFlow>

      {/* Empty state — welcome screen */}
      {activeWf && (!wf || !hasNodes) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="pointer-events-auto w-full max-w-[480px] px-6">
            {/* Hero */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 mb-5">
                <Sparkles size={28} className="text-primary" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight mb-2">
                {wf ? 'Start building' : 'Welcome to AgentFlow'}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[340px] mx-auto">
                {wf
                  ? 'Add your first node to define what this workflow does.'
                  : 'Design AI agent workflows visually. Import a template or start from scratch.'}
              </p>
            </div>

            {/* Primary actions */}
            <div className="space-y-2.5 mb-6">
              <button onClick={() => emit('agentflow:show-flow')}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-primary/[0.08] hover:bg-primary/[0.14] border border-primary/20 hover:border-primary/30 transition-all text-left group">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/15 group-hover:bg-primary/20 transition-colors shrink-0">
                  <Sparkles size={16} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">Ask AI to build it</div>
                  <div className="text-[11px] text-muted-foreground/70">Describe what you want — Flow designs the workflow</div>
                </div>
              </button>
              <button onClick={() => emit('agentflow:show-discover')}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-card/80 hover:bg-accent/80 border border-border/50 hover:border-border transition-all text-left group">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted/50 group-hover:bg-muted transition-colors shrink-0">
                  <Search size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">Browse skills</div>
                  <div className="text-[11px] text-muted-foreground/70">34k+ pre-built agent skills from skills.sh</div>
                </div>
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-[10px] text-muted-foreground/40 uppercase tracking-widest font-medium">or add a node</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {/* Manual node creation */}
            <div className="flex gap-2 justify-center">
              {([
                { type: 'step', label: 'Step', icon: Footprints },
                { type: 'router', label: 'Gateway', icon: GitBranch },
                { type: 'sub-workflow', label: 'Workflow', icon: Layers },
              ] as const).map(tmpl => {
                const color = getNodeTypeColor(tmpl.type, resolvedTheme)
                return (
                  <button key={tmpl.type} onClick={() => {
                    const center = reactFlowInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
                    addNode(tmpl.type, undefined, center); setDrawerOpen(true)
                  }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/40 bg-card/50 hover:bg-accent hover:border-primary/30 transition-all text-xs font-medium"
                  >
                    <tmpl.icon size={15} style={{ color }} />
                    {tmpl.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <AttachResourceDialog open={!!attachPayload} onClose={() => setAttachPayload(null)} payload={attachPayload} />

      {/* Edge click popover */}
      {edgePopover && (
        <div
          className="absolute z-50 pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-150"
          style={{ left: edgePopover.x, top: edgePopover.y }}
        >
          <div className="bg-popover/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl min-w-[220px] -translate-x-1/2 -translate-y-full mb-2 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {edgePopover.condition ? (
                  <><GitBranch size={12} className="text-amber-500" /><span>Conditional</span></>
                ) : (
                  <><ArrowRight size={12} /><span>Connection</span></>
                )}
              </div>
              <button
                onClick={() => setEdgePopover(null)}
                className="size-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground transition-colors"
              >
                <X size={12} />
              </button>
            </div>

            {/* Route */}
            <div className="flex items-center gap-2 px-3 py-1 text-sm">
              <span className="font-medium truncate max-w-[100px]">{edgePopover.from}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium truncate max-w-[100px]">{edgePopover.to}</span>
            </div>

            {/* Condition text */}
            {edgePopover.condition && (
              <div className="mx-3 my-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{edgePopover.condition}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1 px-2 py-2 border-t border-border/50 mt-1">
              <button
                onClick={() => {
                  handleCtxAction('delete-edge', edgePopover.edgeId)
                  setEdgePopover(null)
                }}
                className="flex items-center gap-1.5 text-xs text-destructive hover:bg-destructive/10 px-2.5 py-1.5 rounded-md transition-colors"
              >
                <Trash2 size={12} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context menu */}
      <CanvasContextMenu
        pos={ctxPos}
        target={ctxTarget}
        onClose={() => { setCtxPos(null); setCtxTarget(null) }}
        onAction={handleCtxAction}
      />

      {/* Double-click node picker */}
      <NodeTemplatePicker pos={dblClickPos} flowPos={dblClickFlowPos} onClose={() => { setDblClickPos(null); setDblClickFlowPos(null) }} />

      {/* Trail / path trace bar */}
      {clickTrail.length >= 2 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
          <div className="flex items-center gap-1.5 bg-background/90 backdrop-blur-xl border border-border/50 rounded-full shadow-lg px-3 py-1.5">
            {clickTrail.map((id, i) => (
              <span key={`${id}-${i}`} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground text-xs">→</span>}
                <span className="text-xs font-medium truncate max-w-[80px]">{wf?.nodes[id]?.name ?? id}</span>
              </span>
            ))}
            <Button variant="ghost" size="icon" className="size-5 ml-1" onClick={clearTrail}>
              <X size={12} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
