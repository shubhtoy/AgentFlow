import { useMemo, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAppStore } from '@/store'
import { useCategoryConfig } from '../hooks/useCategoryConfig'
import { refCategory, refName } from '@/lib/constants'
import { Badge } from './ui/badge'
import type { ResourceCategory } from '@/lib/types'

type Part =
  | { type: 'text'; value: string }
  | { type: 'ref'; raw: string }
  | { type: 'resolved'; path: string }

function splitRefs(text: string): Part[] {
  const combined = /\{\{([^}]+)\}\}|\[\[([^\]]+)\]\]/g
  const parts: Part[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = combined.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) })
    if (m[1] != null) parts.push({ type: 'ref', raw: m[1] })
    else if (m[2] != null) parts.push({ type: 'resolved', path: m[2] })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}

function stripFrontmatter(md: string): string {
  if (!md.startsWith('---')) return md
  const end = md.indexOf('---', 3)
  return end === -1 ? md : md.slice(end + 3).trimStart()
}

const TEMPLATE_VAR_HINTS: Record<string, string> = {
  $workflows: 'Replaced with workflow list at export',
  $resources: 'Replaced with resource list at export',
  $directory: 'Replaced with directory guide at export',
  $execution: 'Replaced with execution steps at export',
}

function RefBadge({ raw, invalid, onClick }: { raw: string; invalid?: boolean; onClick?: () => void }) {
  const categoryConfig = useCategoryConfig()
  const data = useAppStore(s => s.data)
  const trimmed = raw.trim()

  // Template variable — resolve to actual content in preview
  if (trimmed.startsWith('$')) {
    if (!data) return <span className="text-muted-foreground italic text-xs">{trimmed}</span>
    let resolved = ''
    switch (trimmed) {
      case '$workflows': {
        const wfs = Object.entries(data.workflows || {})
        resolved = wfs.length > 0
          ? wfs.map(([id, wf]) => `- **${(wf as any).name || id}** — ${(wf as any).description || 'No description'}`).join('\n')
          : '_No workflows defined_'
        break
      }
      case '$resources': {
        const cats = ['instructions', 'capabilities', 'skills', 'memory'] as const
        const lines: string[] = []
        for (const cat of cats) {
          const items = Object.keys((data as any)[cat] || {})
          if (items.length > 0) lines.push(`**${cat}:** ${items.join(', ')}`)
        }
        resolved = lines.length > 0 ? lines.join('\n\n') : '_No resources defined_'
        break
      }
      case '$directory': {
        const cats = ['instructions', 'capabilities', 'skills', 'memory', 'hooks'] as const
        resolved = cats.map(c => `- \`${c}/\` — ${Object.keys((data as any)[c] || {}).length} files`).join('\n')
        break
      }
      case '$execution':
        resolved = '1. Read the current node instructions\n2. Execute the task described\n3. Follow edge conditions to determine the next node\n4. Repeat until workflow completes'
        break
      default:
        resolved = `_Unknown variable: ${trimmed}_`
    }
    return <span className="block text-sm leading-relaxed whitespace-pre-wrap my-2 pl-2 border-l-2 border-primary/20">{resolved}</span>
  }

  const cat = refCategory(raw)
  const name = refName(raw)
  const cfg = categoryConfig[cat]
  const Icon = cfg?.icon

  // Resolve tooltip
  let tooltip = ''
  if (cat === 'output') {
    for (const wf of Object.values(data?.workflows || {})) {
      const node = (wf as any).nodes?.[name]
      if (node?.outputDeclarations?.length) {
        const o = node.outputDeclarations[0]
        tooltip = `${o.name} (${o.format || 'text'})${o.description ? ' — ' + o.description : ''}`
        break
      }
    }
  } else if (data) {
    const resource = (data as any)[cat]?.[name] || (data as any)[cat + 's']?.[name]
    if (resource?.frontmatter?.description) tooltip = resource.frontmatter.description
    else if (resource?.title) tooltip = resource.title
  }

  return (
    <button
      onClick={onClick}
      className={`relative group/tip inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[12px] font-medium
        border transition-colors cursor-pointer align-middle mx-0.5
        ${invalid
          ? 'border-destructive/40 text-destructive line-through bg-destructive/5'
          : 'border-border hover:bg-accent text-foreground/80'
        }`}
    >
      {tooltip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded bg-popover border border-border text-popover-foreground text-[11px] max-w-[250px] text-center opacity-0 translate-y-1 pointer-events-none group-hover/tip:opacity-100 group-hover/tip:translate-y-0 transition-all duration-150 z-50 shadow-md">
          {tooltip}
        </span>
      )}
      {Icon && <Icon size={11} style={{ color: cfg?.primaryColor }} />}
      {name}
    </button>
  )
}

export const MarkdownPreview = memo(function MarkdownPreview({ content, invalidRefs }: {
  content: string
  invalidRefs?: Set<string>
}) {
  const select = useAppStore(s => s.select)
  const activeWf = useAppStore(s => s.activeWf)
  const clean = useMemo(() => stripFrontmatter(content), [content])

  const renderText = (text: string) => {
    const parts = splitRefs(text)
    if (parts.length === 1 && parts[0].type === 'text') return <>{text}</>
    return (
      <>
        {parts.map((p, i) => {
          if (p.type === 'text') return <span key={i}>{p.value}</span>
          if (p.type === 'resolved') {
            return (
              <code key={i} className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 py-0.5 rounded font-mono">
                {p.path}
              </code>
            )
          }
          const isInvalid = invalidRefs?.has(p.raw)
          return (
            <RefBadge
              key={i}
              raw={p.raw}
              invalid={isInvalid}
              onClick={() => {
                const cat = refCategory(p.raw)
                const name = refName(p.raw)
                if (cat === 'output' || cat === 'nodes') {
                  select({ type: 'node', key: name, workflowId: activeWf })
                } else {
                  select({ type: 'resource', category: cat as ResourceCategory, key: name })
                }
              }}
            />
          )
        })}
      </>
    )
  }

  const proc = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === 'string') return renderText(children)
    if (Array.isArray(children)) return children.map((c, i) => <span key={i}>{proc(c)}</span>)
    return children
  }

  return (
    <div className="max-w-none px-4 py-3 text-sm leading-relaxed text-foreground
      [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
      [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5
      [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2.5 [&_h3]:mb-1
      [&_p]:my-1.5
      [&_ul]:pl-5 [&_ul]:my-1.5 [&_ul]:list-disc
      [&_ol]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal
      [&_li]:my-0.5
      [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono
      [&_pre]:bg-zinc-900 [&_pre]:text-zinc-100 [&_pre]:rounded-lg [&_pre]:text-xs [&_pre]:p-3 [&_pre]:my-2
      [&_pre_code]:bg-transparent [&_pre_code]:p-0
      [&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:my-2
      [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline
      [&_strong]:font-semibold [&_strong]:text-foreground
      [&_hr]:border-border [&_hr]:my-3"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{proc(children)}</p>,
          li: ({ children }) => <li>{proc(children)}</li>,
          td: ({ children }) => <td>{proc(children)}</td>,
          th: ({ children }) => <th>{proc(children)}</th>,
          h1: ({ children }) => <h1>{proc(children)}</h1>,
          h2: ({ children }) => <h2>{proc(children)}</h2>,
          h3: ({ children }) => <h3>{proc(children)}</h3>,
          h4: ({ children }) => <h4>{proc(children)}</h4>,
          strong: ({ children }) => <strong>{proc(children)}</strong>,
          em: ({ children }) => <em>{proc(children)}</em>,
          input: (props) => {
            const { type, checked } = props as React.InputHTMLAttributes<HTMLInputElement>
            if (type === 'checkbox') {
              return (
                <input
                  type="checkbox"
                  checked={!!checked}
                  disabled
                  className="size-3.5 rounded border-border accent-primary mr-1.5 align-middle"
                />
              )
            }
            return <input {...props} disabled className="mr-1.5" />
          },
        }}
      >
        {clean}
      </ReactMarkdown>
    </div>
  )
})
