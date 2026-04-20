'use client'

/**
 * FlowChatPanel — headless CopilotKit + shadcn UI chat.
 * Uses useAgent/useCopilotKit for agent logic, renders with our own components.
 * Supports: markdown, tool call display, streaming, scroll, avatar.
 */

import { useState, useCallback, useRef, useEffect, memo } from 'react'
import {
  useAgent,
  useCopilotKit,
  UseAgentUpdate,
} from '@copilotkit/react-core/v2'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  RotateCcw, Settings, Send, Square,
  Wrench, CheckCircle, Loader2,
} from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { FlowAvatar } from './FlowAvatar'
import { ModelPicker } from './ModelPicker'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { emit } from '@/utils/events'

// ── Markdown message (memoized) ───────────────────────────────────────

const Md = memo(({ content }: { content: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      pre: ({ children }) => <pre className="bg-background/80 rounded-md p-2 overflow-x-auto text-[11px] my-1">{children}</pre>,
      code: ({ children, className }) =>
        className ? <code className={className}>{children}</code>
                  : <code className="bg-background/60 rounded px-1 py-0.5 text-[11px]">{children}</code>,
      a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>,
    }}
  >
    {content}
  </ReactMarkdown>
))
Md.displayName = 'Md'

// ── Tool call card ────────────────────────────────────────────────────

function ToolCard({ name, args, result, done }: { name: string; args?: string; result?: string; done: boolean }) {
  const label = name.replace(/_/g, ' ')
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 px-2.5 py-1.5 text-[11px] my-1">
      <div className="flex items-center gap-1.5">
        {done
          ? <CheckCircle size={11} className="text-green-500 shrink-0" />
          : <Spinner size="sm" className="text-primary shrink-0" />}
        <Wrench size={11} className="text-muted-foreground shrink-0" />
        <span className="font-medium truncate">{label}</span>
      </div>
      {result && (
        <p className="mt-1 pl-[22px] text-muted-foreground line-clamp-2 break-words">{
          result.length > 200 ? result.slice(0, 200) + '…' : result
        }</p>
      )}
    </div>
  )
}

// ── Message renderer ──────────────────────────────────────────────────

function Message({ msg, toolResults }: {
  msg: any
  toolResults: Map<string, string>
}) {
  if (msg.role === 'tool') return null // rendered inline with assistant

  const isUser = msg.role === 'user'
  const content = typeof msg.content === 'string' ? msg.content : ''
  const toolCalls = msg.toolCalls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && <FlowAvatar size="sm" className="mt-0.5 shrink-0" />}
      <div className={`max-w-[85%] space-y-1 ${isUser ? 'items-end' : ''}`}>
        {content && (
          <div className={`rounded-xl px-3 py-2 text-xs leading-relaxed break-words ${
            isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
          }`}>
            {isUser ? content : <Md content={content} />}
          </div>
        )}
        {toolCalls?.map(tc => (
          <ToolCard
            key={tc.id}
            name={tc.function.name}
            args={tc.function.arguments}
            result={toolResults.get(tc.id)}
            done={toolResults.has(tc.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────

export function FlowChatPanel() {
  const { agent } = useAgent({ updates: [UseAgentUpdate.OnMessagesChanged, UseAgentUpdate.OnRunStatusChanged] })
  const { copilotkit } = useCopilotKit()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const [threadId] = useState(() => {
    if (typeof window === 'undefined') return crypto.randomUUID()
    const saved = sessionStorage.getItem('af-flow-thread')
    if (saved) return saved
    const id = crypto.randomUUID()
    sessionStorage.setItem('af-flow-thread', id)
    return id
  })

  useEffect(() => {
    agent.threadId = threadId
    copilotkit.connectAgent({ agent }).catch(console.error)
    return () => { agent.detachActiveRun().catch(() => {}) }
  }, [threadId])

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
  }, [agent.messages.length, agent.isRunning])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || agent.isRunning) return
    setInput('')
    agent.addMessage({ id: crypto.randomUUID(), role: 'user', content: text })
    try { await copilotkit.runAgent({ agent }) } catch (e) { console.error(e) }
  }, [input, agent, copilotkit])

  const stop = useCallback(() => {
    try { copilotkit.stopAgent({ agent }) } catch { agent.abortRun() }
  }, [agent, copilotkit])

  // Build tool result lookup
  const messages = agent.messages as any[]
  const toolResults = new Map<string, string>()
  for (const m of messages) {
    if (m.role === 'tool' && m.toolCallId) toolResults.set(m.toolCallId, m.content || '')
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/30 shrink-0">
          {agent.isRunning && (
            <div className="flex items-center gap-1 text-[11px] text-primary">
              <Spinner size="sm" /><span>Thinking…</span>
            </div>
          )}
          <div className="flex-1" />
          <ModelPicker />
          <Separator orientation="vertical" className="h-4 mx-0.5" />
          <Tooltip><TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
              const id = crypto.randomUUID()
              sessionStorage.setItem('af-flow-thread', id)
              window.location.reload()
            }}><RotateCcw size={11} /></Button>
          </TooltipTrigger><TooltipContent side="bottom" className="text-xs">New chat</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => emit('agentflow:show-settings')}>
              <Settings size={11} />
            </Button>
          </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Settings</TooltipContent></Tooltip>
        </div>

        {/* Messages */}
        <ScrollArea ref={scrollRef} className="flex-1 min-h-0">
          <div className="p-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                <FlowAvatar size="lg" />
                <p className="text-sm font-semibold">Flow</p>
                <p className="text-[11px] text-muted-foreground">
                  Ask me to build, edit, validate, or follow workflows.
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <Message key={msg.id || i} msg={msg} toolResults={toolResults} />
            ))}
            {agent.isRunning && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex gap-2">
                <FlowAvatar size="sm" className="mt-0.5 shrink-0" />
                <div className="rounded-xl bg-muted px-3 py-2">
                  <Spinner size="sm" className="text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="shrink-0 border-t border-border/30 p-2">
          <div className="flex items-end gap-1.5">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ask Flow…"
              rows={1}
              className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary/50 max-h-[80px] overflow-auto"
            />
            {agent.isRunning ? (
              <Button size="icon" variant="destructive" className="h-8 w-8 shrink-0" onClick={stop}>
                <Square size={12} />
              </Button>
            ) : (
              <Button size="icon" className="h-8 w-8 shrink-0" onClick={send} disabled={!input.trim()}>
                <Send size={12} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
