import { useEffect, useRef } from 'react'
import {
  Trash2, Copy, Maximize2, GitBranch,
  Scissors, Crosshair, ClipboardCopy, LayoutGrid,
} from 'lucide-react'
import { NodeTemplatePicker } from './NodeTemplatePicker'

export interface ContextMenuPos { x: number; y: number }

export type ContextMenuTarget =
  | { kind: 'pane' }
  | { kind: 'node'; nodeId: string; nodeName: string }
  | { kind: 'resource'; category: string; name: string }
  | { kind: 'edge'; edgeId: string; from: string; to: string; condition?: string }

interface Props {
  pos: ContextMenuPos | null
  target: ContextMenuTarget | null
  onClose: () => void
  onAction: (action: string, payload?: any) => void
}

export function CanvasContextMenu({ pos, target, onClose, onAction }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pos) return
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pos, onClose])

  useEffect(() => {
    if (!pos) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [pos, onClose])

  if (!pos || !target) return null

  // ── Pane menu → delegate to shared NodeTemplatePicker ──
  if (target.kind === 'pane') {
    return (
      <NodeTemplatePicker
        pos={pos}
        onClose={onClose}
        extraItems={
          <>
            <div className="border-t border-border/50 my-1" />
            <button onClick={() => { onAction('auto-layout'); onClose() }} className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-accent text-left text-sm">
              <LayoutGrid size={14} /><span>Auto layout</span>
            </button>
          </>
        }
      />
    )
  }

  // ── Node / Edge menus ──
  const items: { label: string; icon: React.ElementType; action: string; payload?: any; destructive?: boolean; separator?: boolean }[] = []
  if (target.kind === 'node') {
    items.push(
      { label: 'Focus', icon: Maximize2, action: 'focus', payload: target.nodeId },
      { label: 'Duplicate', icon: Copy, action: 'duplicate', payload: target.nodeId },
      { label: 'Copy name', icon: ClipboardCopy, action: 'copy-name', payload: target.nodeName },
      { label: 'Delete', icon: Trash2, action: 'delete', payload: target.nodeId, destructive: true, separator: true },
    )
  } else if (target.kind === 'resource') {
    items.push(
      { label: 'Copy name', icon: ClipboardCopy, action: 'copy-name', payload: target.name },
      { label: 'Duplicate', icon: Copy, action: 'duplicate-resource', payload: { category: target.category, name: target.name } },
      { label: 'Delete', icon: Trash2, action: 'delete-resource', payload: { category: target.category, name: target.name }, destructive: true, separator: true },
    )
  } else {
    items.push({ label: `${target.from} → ${target.to}`, icon: GitBranch, action: 'noop' })
    if (target.condition) items.push({ label: `Condition: ${target.condition}`, icon: Scissors, action: 'noop' })
    items.push({ label: 'Delete edge', icon: Trash2, action: 'delete-edge', payload: target.edgeId, destructive: true, separator: true })
  }

  return (
    <div ref={ref} className="fixed z-[100] min-w-[180px] py-1 rounded-xl bg-popover/95 backdrop-blur-xl border border-border shadow-xl animate-in fade-in-0 zoom-in-95 duration-100" style={{ left: pos.x, top: pos.y }}>
      {items.map((item, i) => (
        <div key={i}>
          {item.separator && i > 0 && <div className="border-t border-border/50 my-1" />}
          <button onClick={() => { if (item.action !== 'noop') { onAction(item.action, item.payload); onClose() } }} disabled={item.action === 'noop'}
            className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${item.action === 'noop' ? 'text-muted-foreground cursor-default' : 'hover:bg-accent'} ${item.destructive ? 'text-destructive hover:text-destructive' : ''}`}>
            <item.icon size={14} /><span className="truncate">{item.label}</span>
          </button>
        </div>
      ))}
    </div>
  )
}
