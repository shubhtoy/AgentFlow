import { useState, useCallback, useEffect, useRef, useMemo, memo, lazy, Suspense } from 'react'
import { useStore, useAppStore } from '@/store'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { RefChipNode } from '../extensions/RefChipExtension'
import { SlashCommandExtension } from '../extensions/SlashCommandExtension'
import { NarrativeBlockPlugin } from '../extensions/NarrativeBlockPlugin'
import { refCategory, refName } from '@/lib/constants'
import { useCategoryConfig } from '../hooks/useCategoryConfig'
import { getNarrativeScaffolding, DEFAULT_NARRATIVE } from '../utils/narrative'
import { HelpButton } from './HelpButton'
import { Button } from './ui/button'
import { Separator } from './ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip'
import {
  Bold, Italic, Heading1, Heading2, Heading3,
  List, ListOrdered, Code, Quote, Minus, Eye, Pencil,
} from 'lucide-react'
import type { ResourceCategory, ParsedFile } from '@/lib/types'
import { registerAgentFlowTheme } from '@/lib/monaco-theme'
import { Spinner } from './ui/spinner'

const MonacoEditor = lazy(() => import('@monaco-editor/react').then(m => ({ default: m.default })))

function stripFrontmatter(md: string): string { if (!md.startsWith('---')) return md; const end = md.indexOf('---', 3); return end === -1 ? md : md.slice(end + 3).trimStart() }
function extractFrontmatter(md: string): string { if (!md.startsWith('---')) return ''; const end = md.indexOf('---', 3); return end === -1 ? '' : md.slice(0, end + 3) + '\n' }

const REF_TOKEN_RE = /\{\{([^}]+)\}\}/g

const TEMPLATE_VAR_HINTS: Record<string, string> = {
  $workflows: 'Replaced with the list of available workflows at export time',
  $resources: 'Replaced with the list of bundled resources at export time',
  $directory: 'Replaced with the directory structure guide at export time',
  $execution: 'Replaced with execution instructions at export time',
}

function RefBadge({ raw, index }: { raw: string; index: number }) {
  const categoryConfig = useCategoryConfig()
  const data = useAppStore(s => s.data)
  const trimmed = raw.trim()

  // Template variable: {{$varName}}
  if (trimmed.startsWith('$')) {
    const hint = TEMPLATE_VAR_HINTS[trimmed] || 'Dynamic value resolved at export time'
    return (
      <span key={`ref-${index}`} title={hint}
        className="inline-flex items-center h-6 text-[13px] font-medium rounded-full border border-dashed px-2 mx-0.5 align-middle cursor-help border-muted-foreground/30 bg-muted/50 text-muted-foreground">
        ƒ {trimmed.slice(1)}
      </span>
    )
  }

  const cleaned = raw.replace(/^->?\s*/, '').replace(/^<<\s*/, '')
  const cat = refCategory(cleaned); const name = refName(cleaned); const cfg = categoryConfig[cat]
  let prefix = ''; if (raw.startsWith('->')) prefix = '→ '; else if (raw.startsWith('<<')) prefix = '⇠ '
  const condMatch = raw.match(/\|\s*(.+)$/); const condition = condMatch ? condMatch[1].trim() : null
  const displayName = condition ? `${name} | ${condition}` : name

  // Resolve tooltip from parsed data
  let tooltip = ''
  if (cat === 'output') {
    const nodeId = name
    for (const wf of Object.values(data?.workflows || {})) {
      const node = (wf as any).nodes?.[nodeId]
      if (node?.outputDeclarations?.length) {
        const o = node.outputDeclarations[0]
        tooltip = `${o.name} (${o.format || 'text'})${o.description ? ' — ' + o.description : ''}`
        break
      }
    }
    if (!tooltip) tooltip = `Output from ${nodeId}`
  } else if (cat === 'nodes') {
    tooltip = `Edge to node: ${name}`
  } else if (data) {
    const resource = (data as any)[cat]?.[name] || (data as any)[cat + 's']?.[name]
    if (resource?.frontmatter?.description) tooltip = resource.frontmatter.description
    else if (resource?.title) tooltip = resource.title
  }

  return (
    <span key={`ref-${index}`}
      className={`relative group/tip inline-flex items-center h-6 text-[13px] font-medium rounded-full border px-2 mx-0.5 align-middle${tooltip ? ' cursor-help' : ''}`}
      style={{ backgroundColor: cfg?.containerColor, color: cfg?.onColor, borderColor: cfg?.primaryColor }}>
      {prefix}{cfg?.label || cat}/{displayName}
      {tooltip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded bg-popover border border-border text-popover-foreground text-[11px] max-w-[250px] text-center opacity-0 translate-y-1 pointer-events-none group-hover/tip:opacity-100 group-hover/tip:translate-y-0 transition-all duration-150 z-50 shadow-md">
          {tooltip}
        </span>
      )}
    </span>
  )
}

function resolveRefsInText(text: string): (string | React.ReactElement)[] {
  const parts: (string | React.ReactElement)[] = []; let lastIndex = 0; let match: RegExpExecArray | null
  const re = new RegExp(REF_TOKEN_RE.source, 'g')
  while ((match = re.exec(text)) !== null) { if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index)); parts.push(<RefBadge key={match.index} raw={match[1]} index={match.index} />); lastIndex = re.lastIndex }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex)); return parts
}

function resolveChildRefs(children: React.ReactNode): React.ReactNode {
  if (!children) return children
  if (typeof children === 'string') { const resolved = resolveRefsInText(children); return resolved.length === 1 && typeof resolved[0] === 'string' ? resolved[0] : <>{resolved}</> }
  if (Array.isArray(children)) { return children.map((child, i) => typeof child === 'string' ? <span key={i}>{resolveRefsInText(child)}</span> : child) }
  return children
}

const MarkdownWithRefs = memo(function MarkdownWithRefs({ content }: { content: string }) {
  if (!content) return <p className="text-muted-foreground italic p-4">No content</p>
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
      p: ({ node: _node, children, ...props }) => <p {...props}>{resolveChildRefs(children)}</p>,
      li: ({ node: _node, children, ...props }) => <li {...props}>{resolveChildRefs(children)}</li>,
    }}>{content}</ReactMarkdown>
  )
})

const FormatToolbar = memo(function FormatToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null
  const btn = (active: boolean, onClick: () => void, Icon: typeof Bold, title: string) => (
    <TooltipProvider key={title}><Tooltip><TooltipTrigger asChild>
      <Button variant="ghost" size="icon" className={`h-8 w-8 rounded ${active ? 'text-primary bg-primary/10' : ''}`} onClick={onClick}><Icon size={16} /></Button>
    </TooltipTrigger><TooltipContent>{title}</TooltipContent></Tooltip></TooltipProvider>
  )
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), Bold, 'Bold')}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), Italic, 'Italic')}
      <Separator orientation="vertical" className="mx-0.5 h-5" />
      {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), Heading1, 'Heading 1')}
      {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), Heading2, 'Heading 2')}
      {btn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), Heading3, 'Heading 3')}
      <Separator orientation="vertical" className="mx-0.5 h-5" />
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), List, 'Bullet list')}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), ListOrdered, 'Ordered list')}
      {btn(editor.isActive('codeBlock'), () => editor.chain().focus().toggleCodeBlock().run(), Code, 'Code block')}
      {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), Quote, 'Blockquote')}
      <Button variant="ghost" size="icon" className="h-8 w-8 rounded" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={16} /></Button>
    </div>
  )
})

export function Editor({ filePath, content }: { filePath: string; content: string }) {
  const { save, data, activeWf } = useStore()
  const markDirty = useAppStore(s => s.markDirty)
  const resolvedTheme = useAppStore(s => s.resolvedTheme)
  const [editing, setEditing] = useState(true)
  const [mode, setMode] = useState<'visual' | 'source'>('visual')
  const [textValue, setTextValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const cursorPosRef = useRef<number | null>(null)
  const fm = useMemo(() => extractFrontmatter(content), [content])
  const body = useMemo(() => stripFrontmatter(content), [content])

  const extensionConfig = useRef({ getData: () => data, getActiveWf: () => activeWf })
  extensionConfig.current.getData = () => data; extensionConfig.current.getActiveWf = () => activeWf

  const extensions = useMemo(() => [
    StarterKit, Placeholder.configure({ placeholder: 'Start writing… Type / to insert a reference' }),
    Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: true }), RefChipNode,
    SlashCommandExtension.configure({ getData: () => extensionConfig.current.getData(), getActiveWf: () => extensionConfig.current.getActiveWf() }),
    NarrativeBlockPlugin,
  ], [])

  const editor = useEditor({ extensions, content: body, immediatelyRender: false, onUpdate: () => { setDirty(true); markDirty() } }, [body])

  useEffect(() => {
    if (editor && !editor.isDestroyed) { const storage = editor.storage as unknown as Record<string, { getMarkdown: () => string }>; const md = storage.markdown.getMarkdown(); if (md !== body) { editor.commands.setContent(body); setDirty(false) } }
    setTextValue(body)
  }, [body])

  const getMarkdown = useCallback((): string => {
    if (mode === 'source') return textValue
    if (editor && !editor.isDestroyed) { const storage = editor.storage as unknown as Record<string, { getMarkdown: () => string }>; return storage.markdown.getMarkdown() }
    return body
  }, [mode, textValue, editor, body])

  const handleSave = useCallback(async () => { setSaving(true); const md = getMarkdown(); await save(filePath, fm + md); setDirty(false); setSaving(false) }, [filePath, fm, getMarkdown, save])

  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave() } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [handleSave])

  // Listen for global save from status bar button
  useEffect(() => { const h = () => { if (dirty) handleSave() }; window.addEventListener('agentflow:global-save', h); return () => window.removeEventListener('agentflow:global-save', h) }, [handleSave, dirty])

  const toggleEditing = useCallback(() => {
    if (editing) { if (editor && !editor.isDestroyed) cursorPosRef.current = editor.state.selection.from; setEditing(false) }
    else { setEditing(true); requestAnimationFrame(() => { if (editor && !editor.isDestroyed && cursorPosRef.current !== null) { const pos = Math.min(cursorPosRef.current, editor.state.doc.content.size); editor.commands.focus(); editor.commands.setTextSelection(pos) } }) }
  }, [editing, editor])

  const switchToSource = useCallback(() => { if (editor && !editor.isDestroyed) { const storage = editor.storage as unknown as Record<string, { getMarkdown: () => string }>; setTextValue(storage.markdown.getMarkdown()) }; setMode('source') }, [editor])
  const switchToVisual = useCallback(() => { if (editor && !editor.isDestroyed) editor.commands.setContent(textValue); setMode('visual') }, [editor, textValue])

  const previewContent = useMemo(() => getMarkdown(), [getMarkdown])

  return (
    <div className="flex-1 flex flex-col border-t border-border min-h-0 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center px-3 py-1 border-b border-border gap-2 shrink-0 bg-background min-h-[40px]">
        {editing && (
          <div className="flex border border-border rounded-md overflow-hidden">
            <button onClick={switchToVisual} className={`px-3 py-1 text-[13px] ${mode === 'visual' ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}>Visual</button>
            <button onClick={switchToSource} className={`px-3 py-1 text-[13px] ${mode === 'source' ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}>Source</button>
          </div>
        )}
        <span className="text-xs text-muted-foreground font-mono truncate flex-1 min-w-0">{filePath.split('/').slice(-2).join('/')}</span>
        {editing && dirty && <div className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" title="Unsaved changes" />}
        <TooltipProvider><Tooltip><TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className={`h-8 w-8 ${editing ? 'text-primary' : ''}`} onClick={toggleEditing}>{editing ? <Eye size={18} /> : <Pencil size={18} />}</Button>
        </TooltipTrigger><TooltipContent>{editing ? 'Preview' : 'Edit'}</TooltipContent></Tooltip></TooltipProvider>
      </div>
      {editing && mode === 'visual' && editor && (
        <div className="flex items-center px-3 py-1 border-b border-border shrink-0 bg-card min-h-[36px]">
          <FormatToolbar editor={editor} /><div className="flex-1" /><HelpButton context="editor" size={14} />
        </div>
      )}
      <div className="flex-1 overflow-y-auto min-h-0 relative"
        onDragOver={(e: React.DragEvent) => { if (e.dataTransfer.types.includes('application/agentflow-resource') || e.dataTransfer.types.includes('application/agentflow-library')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }}
        onDrop={(e: React.DragEvent) => {
          if (!editor || editor.isDestroyed) return
          const rawResource = e.dataTransfer.getData('application/agentflow-resource')
          if (rawResource) { e.preventDefault(); try { const payload = JSON.parse(rawResource); const category = payload.category || 'customFiles'; const refPath = category === 'customFiles' ? payload.name : `${category}/${payload.name}`; editor.chain().focus().insertContent(`{{${refPath}}} `).run(); setDirty(true); markDirty() } catch {} return }
          const rawLibrary = e.dataTransfer.getData('application/agentflow-library')
          if (rawLibrary) { e.preventDefault(); try { const payload = JSON.parse(rawLibrary); if (payload.entryType === 'workflow') { useAppStore.getState().showNotification(`"${payload.name}" is a workflow and can't be inserted as a reference.`, 'warning'); return }; const category = payload.entryType.endsWith('s') ? payload.entryType : payload.entryType + 's'; editor.chain().focus().insertContent(`{{${category}/${payload.name}}} `).run(); setDirty(true); markDirty() } catch {} }
        }}>
        {!editing ? (
          <div className="px-6 py-5 text-[15px] leading-relaxed prose prose-sm dark:prose-invert max-w-none"><MarkdownWithRefs content={previewContent} /></div>
        ) : mode === 'visual' ? (
          <EditorContent editor={editor} style={{ padding: '20px 24px', fontSize: '0.9375rem', lineHeight: 1.7, minHeight: '100%', color: 'inherit' }} />
        ) : (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Spinner /></div>}>
            <MonacoEditor
              height="100%"
              language="agentflow"
              value={textValue}
              theme={resolvedTheme === 'dark' ? 'agentflow-dark' : 'agentflow-light'}
              onChange={v => { if (v !== undefined) { setTextValue(v); setDirty(true); markDirty() } }}
              beforeMount={(monaco) => registerAgentFlowTheme(monaco, () => {
                const d = useAppStore.getState().data
                if (!d) return []
                const names: string[] = []
                for (const cat of ['instructions', 'capabilities', 'runbooks', 'memory'] as const) {
                  for (const key of Object.keys(d[cat])) names.push(`${cat}/${key}`)
                }
                return names
              })}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 2,
                automaticLayout: true,
                padding: { top: 8 },
                fixedOverflowWidgets: true,
                quickSuggestions: { other: true, strings: true, comments: false },
                suggestOnTriggerCharacters: true,
              }}
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}
