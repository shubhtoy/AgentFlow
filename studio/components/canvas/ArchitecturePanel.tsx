import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Wrench, PlayCircle, Database, X } from 'lucide-react'
import { useAppStore } from '@/store'
import { useCategoryConfig } from '../../hooks/useCategoryConfig'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ResourceCategory, ParsedFile } from '@/lib/types'

const CATEGORIES: { key: ResourceCategory; icon: typeof BookOpen }[] = [
  { key: 'instructions', icon: BookOpen },
  { key: 'capabilities', icon: Wrench },
  { key: 'skills', icon: PlayCircle },
  { key: 'memory', icon: Database },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function ArchitecturePanel({ open, onClose }: Props) {
  const data = useAppStore(s => s.data)
  const activeWf = useAppStore(s => s.activeWf)
  const select = useAppStore(s => s.select)
  const categoryConfig = useCategoryConfig()
  const wf = data?.workflows[activeWf]

  // Compute which resources are used by the active workflow
  const usedResources = useMemo(() => {
    if (!wf || !data) return new Map<ResourceCategory, { name: string; file?: ParsedFile; usedBy: string[] }[]>()
    const result = new Map<ResourceCategory, Map<string, string[]>>()
    for (const cat of CATEGORIES) result.set(cat.key, new Map())

    // Refs from nodes
    for (const [stepId, node] of Object.entries(wf.nodes)) {
      for (const ref of node.allRefs || []) {
        const cat = ref.category as ResourceCategory
        const bucket = result.get(cat)
        if (bucket && ref.name) {
          if (!bucket.has(ref.name)) bucket.set(ref.name, [])
          bucket.get(ref.name)!.push(node.name)
        }
      }
    }
    // Conditions from edges
    for (const edge of wf.edges) {
      if (!edge.condition) continue
      const sep = edge.condition.indexOf('/')
      if (sep <= 0) continue
      const cat = edge.condition.slice(0, sep) as ResourceCategory
      const name = edge.condition.slice(sep + 1)
      const bucket = result.get(cat)
      if (bucket && name) {
        if (!bucket.has(name)) bucket.set(name, [])
        const fromNode = wf.nodes[edge.from]
        if (fromNode) bucket.get(name)!.push(fromNode.name)
      }
    }

    // Convert to sorted arrays with file references
    const final = new Map<ResourceCategory, { name: string; file?: ParsedFile; usedBy: string[] }[]>()
    for (const [cat, bucket] of result) {
      const items = [...bucket.entries()]
        .map(([name, usedBy]) => ({
          name,
          file: (data[cat] as Record<string, ParsedFile>)?.[name],
          usedBy: [...new Set(usedBy)],
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
      if (items.length > 0) final.set(cat, items)
    }
    return final
  }, [wf, data])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="absolute top-3 right-3 bottom-20 z-30 pointer-events-auto w-[300px]"
        >
          <div className="h-full rounded-xl bg-background/90 backdrop-blur-xl border border-border/50 shadow-[0_8px_32px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 shrink-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Architecture</span>
              <Button variant="ghost" size="icon" className="size-6" onClick={onClose}>
                <X size={12} />
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-3">
                {CATEGORIES.map(({ key, icon: Icon }) => {
                  const items = usedResources.get(key)
                  if (!items || items.length === 0) return null
                  const cfg = categoryConfig[key]
                  return (
                    <div key={key}>
                      <div className="flex items-center gap-1.5 px-1 mb-1">
                        <Icon size={12} style={{ color: cfg?.primaryColor }} />
                        <span className="text-[11px] font-semibold" style={{ color: cfg?.primaryColor }}>
                          {cfg?.label}
                        </span>
                        <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-auto">
                          {items.length}
                        </Badge>
                      </div>
                      <div className="space-y-0.5">
                        {items.map(item => (
                          <button
                            key={item.name}
                            onClick={() => select({ type: 'resource', category: key, key: item.name })}
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-accent/50 transition-colors group"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium truncate flex-1">{item.name}</span>
                              {item.file?.frontmatter?.type && (
                                <Badge variant="outline" className="text-[8px] h-3.5 px-1 shrink-0"
                                  style={{ borderColor: `${cfg?.primaryColor}30`, color: cfg?.primaryColor }}>
                                  {String(item.file.frontmatter.type)}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {item.usedBy.length === 1
                                ? item.usedBy[0]
                                : `${item.usedBy.length} nodes`}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {usedResources.size === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    No resources referenced in this workflow
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
