'use client'

/**
 * Renders tool calls in the CopilotKit chat.
 * Uses useRenderTool (v2 API) for per-tool renderers
 * and a wildcard (*) as a catch-all fallback.
 */

import { useRenderTool, ToolCallStatus } from '@copilotkit/react-core/v2'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import {
  FileText, FolderOpen, Search, CheckCircle,
  Pencil, Terminal, ListTodo, Bot, Wrench,
  Trash2, Eye, MousePointer, ArrowRight, Palette, Library,
  Calculator, Server, Globe, Brain,
  Workflow, Zap, Loader2,
} from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

// ── Shared card component ──

function ToolCard({ icon: Icon, label, status, children }: {
  icon: any; label: string; status: string; children?: React.ReactNode
}) {
  const isRunning = status === ToolCallStatus.InProgress || status === ToolCallStatus.Executing
  const isDone = status === ToolCallStatus.Complete

  return (
    <div className="rounded-lg border border-border/50 bg-card/50 px-3 py-2 text-xs my-1.5 shadow-sm">
      <div className="flex items-center gap-2">
        {isRunning
          ? <Spinner size="sm" className="text-primary shrink-0" />
          : <Icon size={13} className={isDone ? 'text-primary shrink-0' : 'text-muted-foreground shrink-0'} />
        }
        <span className="font-medium truncate flex-1">{label}</span>
        {isDone && !children && <CheckCircle size={11} className="text-green-500 shrink-0" />}
      </div>
      {children && <div className="mt-1.5 pl-[21px] text-muted-foreground">{children}</div>}
    </div>
  )
}

function parseResult(result: any): any {
  if (!result) return null
  try { return typeof result === 'string' ? JSON.parse(result) : result } catch { return null }
}

export function CopilotToolRenderers() {

  // ── DeepAgent filesystem tools ──

  useRenderTool({ name: 'read_file', parameters: z.any(), render: ({ status, parameters, result }) => {
    const r = parseResult(result)
    return <ToolCard icon={FileText} label={`Read ${parameters?.path || '...'}`} status={status}>
      {r?.error ? <span className="text-destructive">{r.error}</span>
        : r?.content ? <span>{r.content.split('\n').length} lines · {r.content.length} chars</span> : null}
    </ToolCard>
  }}, [])

  useRenderTool({ name: 'write_file', parameters: z.any(), render: ({ status, parameters }) =>
    <ToolCard icon={FileText} label={`Write ${parameters?.path || '...'}`} status={status} />
  }, [])

  useRenderTool({ name: 'edit_file', parameters: z.any(), render: ({ status, parameters }) =>
    <ToolCard icon={Pencil} label={`Edit ${parameters?.path || '...'}`} status={status} />
  }, [])

  useRenderTool({ name: 'ls', parameters: z.any(), render: ({ status, parameters, result }) => {
    const r = parseResult(result)
    return <ToolCard icon={FolderOpen} label={`List ${parameters?.path || '.'}`} status={status}>
      {r?.entries ? <span>{r.entries.length} items</span> : r?.error ? <span className="text-destructive">{r.error}</span> : null}
    </ToolCard>
  }}, [])

  useRenderTool({ name: 'glob', parameters: z.any(), render: ({ status, parameters, result }) => {
    const r = parseResult(result)
    return <ToolCard icon={Search} label={`Find ${parameters?.pattern || '...'}`} status={status}>
      {r?.matches ? <span>{r.matches.length} files</span> : null}
    </ToolCard>
  }}, [])

  useRenderTool({ name: 'grep', parameters: z.any(), render: ({ status, parameters, result }) => {
    const r = parseResult(result)
    return <ToolCard icon={Search} label={`Grep "${parameters?.pattern || '...'}"${parameters?.path ? ` in ${parameters.path}` : ''}`} status={status}>
      {r?.matches ? <span>{r.matches.length} matches</span> : null}
    </ToolCard>
  }}, [])

  useRenderTool({ name: 'execute', parameters: z.any(), render: ({ status, parameters, result }) => {
    const r = parseResult(result)
    const cmd = (parameters?.command || '').slice(0, 80)
    return <ToolCard icon={Terminal} label={cmd || 'Shell command'} status={status}>
      {r?.error ? <span className="text-destructive">{r.error}</span>
        : r?.exitCode !== undefined ? <span>Exit {r.exitCode}{r.truncated ? ' (truncated)' : ''}</span> : null}
    </ToolCard>
  }}, [])

  // ── DeepAgent planning + subagents ──

  useRenderTool({ name: 'write_todos', parameters: z.any(), render: ({ status, parameters }) => {
    const todos = parameters?.todos || parameters?.tasks || []
    return <ToolCard icon={ListTodo} label="Update plan" status={status}>
      {Array.isArray(todos) && todos.length > 0 && (
        <ul className="space-y-0.5 mt-0.5">
          {todos.slice(0, 8).map((t: any, i: number) => {
            const text = typeof t === 'string' ? t : t?.task || t?.description || JSON.stringify(t)
            const done = typeof t === 'object' && (t?.done || t?.status === 'done')
            return <li key={i} className={`flex items-start gap-1.5 ${done ? 'line-through opacity-50' : ''}`}>
              <span className="mt-0.5">{done ? '✓' : '○'}</span>
              <span>{text}</span>
            </li>
          })}
          {todos.length > 8 && <li className="opacity-50">+{todos.length - 8} more</li>}
        </ul>
      )}
    </ToolCard>
  }}, [])

  useRenderTool({ name: 'task', parameters: z.any(), render: ({ status, parameters, result }) => {
    const r = parseResult(result)
    const name = parameters?.name || parameters?.description?.slice(0, 50) || '...'
    const isRunning = status === ToolCallStatus.InProgress || status === ToolCallStatus.Executing
    return (
      <div className="rounded-lg border border-border/50 bg-card/50 px-3 py-2 text-xs my-1.5 shadow-sm">
        <div className="flex items-center gap-2">
          {isRunning
            ? <Spinner size="sm" className="text-primary shrink-0" />
            : <Bot size={13} className={status === ToolCallStatus.Complete ? 'text-primary shrink-0' : 'text-muted-foreground shrink-0'} />}
          <span className="font-medium truncate flex-1">Subagent: {name}</span>
          {status === ToolCallStatus.Complete && <CheckCircle size={11} className="text-green-500 shrink-0" />}
        </div>
        {parameters?.instructions && (
          <p className="mt-1 pl-[21px] text-muted-foreground line-clamp-2">{parameters.instructions}</p>
        )}
        {r && (
          <div className="mt-1.5 pl-[21px] text-muted-foreground space-y-0.5">
            {r.error && <span className="text-destructive">{r.error}</span>}
            {r.result && <p className="line-clamp-3">{typeof r.result === 'string' ? r.result : JSON.stringify(r.result).slice(0, 200)}</p>}
            {r.output && <p className="line-clamp-3">{typeof r.output === 'string' ? r.output : JSON.stringify(r.output).slice(0, 200)}</p>}
          </div>
        )}
      </div>
    )
  }}, [])

  // ── Frontend tools ──

  useRenderTool({ name: 'createFile', parameters: z.any(), render: ({ status, parameters }) =>
    <ToolCard icon={FileText} label={`Create ${parameters?.path || '...'}`} status={status} />
  }, [])

  useRenderTool({ name: 'editFile', parameters: z.any(), render: ({ status, parameters }) =>
    <ToolCard icon={Pencil} label={`Edit ${parameters?.path || '...'}`} status={status} />
  }, [])

  useRenderTool({ name: 'deleteFile', parameters: z.any(), render: ({ status, parameters }) =>
    <ToolCard icon={Trash2} label={`Delete ${parameters?.path || '...'}`} status={status} />
  }, [])

  useRenderTool({ name: 'validateWorkspace', parameters: z.any(), render: ({ status, result }) => {
    const r = parseResult(result)
    return <ToolCard icon={CheckCircle} label="Validate workspace" status={status}>
      {r && (() => {
        const errs = r.errors?.length || 0
        const warns = r.warnings?.length || 0
        return <span className="flex gap-1.5">
          {errs > 0 && <Badge variant="outline" className="h-4 text-[0.55rem] text-destructive border-destructive/30">{errs} errors</Badge>}
          {warns > 0 && <Badge variant="outline" className="h-4 text-[0.55rem] text-orange-500 border-orange-300">{warns} warnings</Badge>}
          {errs === 0 && warns === 0 && <span className="text-green-600">✓ clean</span>}
        </span>
      })()}
    </ToolCard>
  }}, [])

  useRenderTool({ name: 'calculateTokens', parameters: z.any(), render: ({ status, result }) => {
    const r = parseResult(result)
    return <ToolCard icon={Calculator} label="Calculate tokens" status={status}>
      {r?.totalTokens ? <span>{r.totalTokens.toLocaleString()} tokens</span> : null}
    </ToolCard>
  }}, [])

  useRenderTool({ name: 'addFromLibrary', parameters: z.any(), render: ({ status, parameters }) =>
    <ToolCard icon={Library} label={`Add ${parameters?.type || ''} ${parameters?.name || '...'}`} status={status} />
  }, [])

  useRenderTool({ name: 'selectNode', parameters: z.any(), render: ({ status, parameters }) =>
    <ToolCard icon={MousePointer} label={`Select ${parameters?.nodeId || '...'}`} status={status} />
  }, [])

  useRenderTool({ name: 'focusNode', parameters: z.any(), render: ({ status, parameters }) =>
    <ToolCard icon={Eye} label={`Focus ${parameters?.nodeId || '...'}`} status={status} />
  }, [])

  useRenderTool({ name: 'switchWorkflow', parameters: z.any(), render: ({ status, parameters }) =>
    <ToolCard icon={ArrowRight} label={`Switch to ${parameters?.workflowId || '...'}`} status={status} />
  }, [])

  useRenderTool({ name: 'setTheme', parameters: z.any(), render: ({ status, parameters }) =>
    <ToolCard icon={Palette} label={`Theme: ${parameters?.mode || ''} ${parameters?.palette || ''}`} status={status} />
  }, [])

  // ── MCP tools ──

  useRenderTool({ name: 'listMcpServers', parameters: z.any(), render: ({ status }) =>
    <ToolCard icon={Server} label="List MCP servers" status={status} />
  }, [])

  useRenderTool({ name: 'discoverMcpTools', parameters: z.any(), render: ({ status, parameters }) =>
    <ToolCard icon={Server} label={`Discover tools: ${parameters?.name || '...'}`} status={status} />
  }, [])

  // ── Catch-all for any tool not explicitly handled ──

  useRenderTool({ name: 'webSearch', parameters: z.any(), render: ({ status, parameters, result }) => {
    const r = parseResult(result)
    return <ToolCard icon={Globe} label={`Search: ${(parameters?.query || '').slice(0, 40)}`} status={status}>
      {Array.isArray(r) && r.length > 0 && (
        <div className="space-y-0.5 mt-1">
          {r.slice(0, 3).map((item: any, i: number) => (
            <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block text-primary hover:underline truncate text-[10px]">{item.title}</a>
          ))}
        </div>
      )}
      {r?.error && <span className="text-destructive">{r.error}</span>}
    </ToolCard>
  }}, [])

  useRenderTool({ name: 'readMemory', parameters: z.any(), render: ({ status, parameters }) =>
    <ToolCard icon={Brain} label={`Read memory: ${parameters?.name || '...'}`} status={status} />
  }, [])

  useRenderTool({ name: 'writeMemory', parameters: z.any(), render: ({ status, parameters }) =>
    <ToolCard icon={Brain} label={`Remember: ${(parameters?.entry || '').slice(0, 40)}`} status={status} />
  }, [])

  useRenderTool({ name: 'listWorkflows', parameters: z.any(), render: ({ status, result }) => {
    const r = parseResult(result)
    return <ToolCard icon={Workflow} label="Discover workflows" status={status}>
      {r?.workflows && <span>{r.workflows.length} workflow{r.workflows.length !== 1 ? 's' : ''}: {r.workflows.map((w: any) => w.name || w.id).join(', ')}</span>}
    </ToolCard>
  }}, [])

  useRenderTool({ name: 'activateNode', parameters: z.any(), render: ({ status, parameters, result }) => {
    const r = parseResult(result)
    const label = parameters?.nodeId ? `${parameters.workflowId}/${parameters.nodeId}` : '...'
    return <ToolCard icon={Zap} label={`Activate: ${label}`} status={status}>
      {r?.name && <span className="font-medium">{r.name}</span>}
      {r?.type && <span className="ml-1 opacity-60">({r.type})</span>}
      {r?.edges?.length > 0 && <span className="block mt-0.5 opacity-60">→ {r.edges.map((e: any) => e.toName || e.to).join(', ')}</span>}
    </ToolCard>
  }}, [])

  useRenderTool({
    name: '*',
    render: ({ name, status, parameters }) => {
      const label = name.replace(/_/g, ' ').replace(/^mcp\s+/, '🔌 ')
      return <ToolCard icon={Wrench} label={label} status={status}>
        {parameters && typeof parameters === 'object' && Object.keys(parameters).length > 0 && (
          <span className="font-mono text-[10px] opacity-60 truncate block">
            {Object.entries(parameters).slice(0, 3).map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`).join(' · ')}
          </span>
        )}
      </ToolCard>
    },
  }, [])

  return null
}
