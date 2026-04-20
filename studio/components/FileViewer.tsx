'use client'

import { useCallback, lazy, Suspense } from 'react'
import { useAppStore } from '@/store'
import { isMarkdown, isEditable, getLanguage } from '@/lib/file-utils'
import { registerAgentFlowTheme } from '@/lib/monaco-theme'
import { Editor } from './Editor'
import { Spinner } from './ui/spinner'
import { FileText, FileWarning } from 'lucide-react'

const MonacoEditor = lazy(() => import('@monaco-editor/react').then(m => ({ default: m.default })))

interface FileViewerProps {
  path: string
  content: string
  onSave?: (content: string) => void
  className?: string
}

/**
 * Unified file viewer/editor.
 *  - .md + onSave → TipTap (rich editing with refs, slash commands)
 *  - editable text → Monaco (syntax highlighted)
 *  - binary/unsupported → clean error card
 */
export function FileViewer({ path, content, onSave, className }: FileViewerProps) {
  if (isMarkdown(path) && onSave) {
    return (
      <div className={className}>
        <Editor filePath={path} content={content} />
      </div>
    )
  }
  if (isEditable(path)) {
    return <CodeEditor path={path} content={content} onSave={onSave} className={className} />
  }
  return <UnsupportedFile path={path} className={className} />
}

function CodeEditor({ path, content, onSave, className }: {
  path: string; content: string; onSave?: (content: string) => void; className?: string
}) {
  const resolvedTheme = useAppStore(s => s.resolvedTheme)
  const language = getLanguage(path)

  const handleChange = useCallback((value: string | undefined) => {
    if (value !== undefined && onSave) onSave(value)
  }, [onSave])

  return (
    <div className={className} style={{ minHeight: 200 }}>
      <Suspense fallback={<div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-2"><Spinner /><span className="text-xs text-muted-foreground">Loading editor…</span></div>}>
        <MonacoEditor
          height="100%"
          language={language}
          value={content}
          theme={resolvedTheme === 'dark' ? 'agentflow-dark' : 'agentflow-light'}
          onChange={handleChange}
          beforeMount={registerAgentFlowTheme}
          options={{
            readOnly: !onSave,
            minimap: { enabled: false },
            fontSize: 13,
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
    </div>
  )
}

function UnsupportedFile({ path, className }: { path: string; className?: string }) {
  const fileName = path.split('/').pop() ?? path
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() : 'FILE'

  return (
    <div className={`flex flex-col items-center justify-center gap-4 p-8 ${className ?? ''}`}>
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
        <FileWarning className="w-8 h-8 text-muted-foreground/40" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">{fileName}</p>
        <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{ext}</span>
      </div>
      <p className="text-xs text-muted-foreground/60 text-center max-w-[240px]">
        This file type can't be previewed or edited in the studio
      </p>
    </div>
  )
}
