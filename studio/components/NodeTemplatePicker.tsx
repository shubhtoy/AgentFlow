import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Plus, ChevronLeft, ChevronRight, FolderOpen, BookOpen } from 'lucide-react'
import { NODE_OPTIONS, useCreateNode, useNodeTemplates, type NodeTypeOption, type TemplateItem } from '../utils/node-actions'
import { useAppStore } from '@/store'
import { getNodeTypeColor } from '@/lib/constants'
import { Button } from './ui/button'
import { Separator } from './ui/separator'

interface Props {
  pos: { x: number; y: number } | null
  flowPos?: { x: number; y: number } | null
  onClose: () => void
  extraItems?: React.ReactNode
  anchor?: 'top' | 'bottom'
}

export function NodeTemplatePicker({ pos, flowPos, onClose, extraItems, anchor = 'bottom' }: Props) {
  const [pickedType, setPickedType] = useState<NodeTypeOption | null>(null)
  const addNode = useCreateNode()
  const { getTemplates, hasTemplates } = useNodeTemplates()
  const resolvedTheme = useAppStore(s => s.resolvedTheme)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { if (!pos) setPickedType(null) }, [pos])
  const close = useCallback(() => { onClose(); setPickedType(null) }, [onClose])

  useEffect(() => {
    if (!pos) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 10)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [pos, close])

  useEffect(() => {
    if (!pos) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [pos, close])

  if (!pos) return null

  const handleTypeClick = (option: NodeTypeOption) => {
    if (!hasTemplates(option.type)) { close(); addNode(option.type, undefined, flowPos ?? undefined) }
    else setPickedType(option)
  }

  const handleTemplateClick = (t: TemplateItem) => {
    close()
    addNode(pickedType!.type, { name: t.name, type: t.type, source: t.source }, flowPos ?? undefined)
  }

  const templates = pickedType ? getTemplates(pickedType.type) : []
  const wsTemplates = templates.filter(t => t.source === 'workspace')
  const libTemplates = templates.filter(t => t.source === 'library')

  const style: React.CSSProperties = (() => {
    const maxH = Math.min(window.innerHeight * 0.7, 500)
    if (anchor === 'top') {
      const bottomOffset = window.innerHeight - pos.y
      return { left: pos.x, bottom: bottomOffset, maxHeight: Math.min(maxH, pos.y - 16) }
    }
    return { left: pos.x, top: pos.y, maxHeight: Math.min(maxH, window.innerHeight - pos.y - 16) }
  })()

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onClick={close} />
      <div
        ref={ref}
        className="fixed z-[9999] w-[260px] flex flex-col rounded-xl bg-popover/95 backdrop-blur-xl border border-border shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100"
        style={style}
      >
        <div className="overflow-y-auto py-1.5">
          {!pickedType ? (
            <>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Add Node</p>
              {NODE_OPTIONS.map(option => {
                const Icon = option.icon
                const color = getNodeTypeColor(option.type, resolvedTheme)
                return (
                  <Button key={option.type} variant="ghost" onClick={() => handleTypeClick(option)}
                    className="w-full justify-start gap-2.5 h-auto px-3 py-2 rounded-none"
                  >
                    <span className="size-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
                      <Icon size={14} style={{ color }} />
                    </span>
                    <span className="flex-1 min-w-0 text-left">
                      <span className="text-sm font-medium block">{option.label}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">{option.description}</span>
                    </span>
                    {hasTemplates(option.type) && <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
                  </Button>
                )
              })}
              {extraItems}
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setPickedType(null)}
                className="w-full justify-start gap-1.5 h-7 px-3 rounded-none text-muted-foreground"
              >
                <ChevronLeft size={14} /> Back
              </Button>
              <Separator className="mx-2" />
              <Button variant="ghost" onClick={() => { close(); addNode(pickedType.type, undefined, flowPos ?? undefined) }}
                className="w-full justify-start gap-2.5 h-auto px-3 py-2 rounded-none"
              >
                <Plus size={14} className="text-muted-foreground" />
                <span className="text-left">
                  <span className="text-sm font-medium block">Blank {pickedType.label}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Start from scratch</span>
                </span>
              </Button>
              {wsTemplates.length > 0 && (
                <>
                  <Separator className="mx-2" />
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Workspace</p>
                  {wsTemplates.map(t => (
                    <TemplateRow key={`ws-${t.name}`} icon={FolderOpen} name={t.name} description={t.description}
                      onClick={() => handleTemplateClick(t)} />
                  ))}
                </>
              )}
              {libTemplates.length > 0 && (
                <>
                  <Separator className="mx-2" />
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Library</p>
                  {libTemplates.map(t => (
                    <TemplateRow key={`lib-${t.name}`} icon={BookOpen} name={t.name} description={t.description}
                      badge="builtin"
                      onClick={() => handleTemplateClick(t)} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}

function TemplateRow({ icon: Icon, name, description, badge, onClick }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  name: string; description?: string; badge?: string; onClick: () => void
}) {
  return (
    <Button variant="ghost" onClick={onClick} className="w-full justify-start gap-2.5 h-auto px-3 py-1.5 rounded-none">
      <Icon size={13} className="text-muted-foreground shrink-0" />
      <span className="flex-1 min-w-0 text-left">
        <span className="text-xs font-medium block truncate">{name}</span>
        {description && <span className="text-[10px] text-muted-foreground font-normal line-clamp-1">{description}</span>}
      </span>
      {badge && <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0">{badge}</span>}
    </Button>
  )
}
