'use client'

import { useState, useMemo, memo, useEffect, useCallback } from 'react'
import {
  AlertTriangle, XCircle, CheckCircle, RefreshCw,
  ChevronDown, ChevronRight, Link2, GitBranch, RotateCcw, Eye,
  Variable, Shield, Box as BoxIcon, ExternalLink,
  Filter, Workflow,
} from 'lucide-react'
import { useAppStore } from '@/store'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import type { ValidationIssue } from '@/lib/types'
import { Spinner } from './ui/spinner'
import { FeatureHint } from './onboarding/FeatureHint'

/* ── Issue type config ─────────────────────────────────────────────── */

const ISSUE_TYPE_CONFIG: Record<string, { icon: typeof XCircle; label: string }> = {
  broken_ref:             { icon: Link2,     label: 'Broken Ref' },
  broken_data_flow:       { icon: Link2,     label: 'Data Flow' },
  ambiguous_ref:          { icon: Link2,     label: 'Ambiguous Ref' },
  missing_condition:      { icon: GitBranch, label: 'Missing Condition' },
  router_non_conditional: { icon: GitBranch, label: 'Router Edge' },
  malformed_variable:     { icon: Variable,  label: 'Malformed Var' },
  schema:                 { icon: Shield,    label: 'Schema' },
  cycle:                  { icon: RotateCcw, label: 'Cycle' },
  unreachable:            { icon: Eye,       label: 'Unreachable' },
  unknown_category:       { icon: BoxIcon,   label: 'Unknown Category' },
  identity:               { icon: Shield,    label: 'Identity' },
  context_budget:         { icon: BoxIcon,   label: 'Context Budget' },
  context_input_broken:   { icon: Link2,     label: 'Context Input' },
  context_input_scope:    { icon: BoxIcon,   label: 'Context Scope' },
  output_declaration:     { icon: BoxIcon,   label: 'Output Decl' },
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function getIssueWorkflow(issue: ValidationIssue): string {
  return issue.workflow || 'workspace'
}

function getIssueTypes(issues: ValidationIssue[]): string[] {
  const set = new Set<string>()
  issues.forEach(i => { if (i.type) set.add(i.type) })
  return Array.from(set).sort()
}

function getIssueWorkflows(issues: ValidationIssue[]): string[] {
  const set = new Set<string>()
  issues.forEach(i => set.add(getIssueWorkflow(i)))
  return Array.from(set).sort()
}

/* ── Issue Row ─────────────────────────────────────────────────────── */

const IssueRow = memo(function IssueRow({
  issue, severity, onNavigate,
}: {
  issue: ValidationIssue; severity: 'error' | 'warning'
  onNavigate?: (issue: ValidationIssue) => void
}) {
  const config = ISSUE_TYPE_CONFIG[issue.type || '']
  const Icon = config?.icon || (severity === 'error' ? XCircle : AlertTriangle)
  const filePath = issue.filePath || issue.source || ''
  const clickable = !!(onNavigate && (issue.workflow || issue.nodes?.length || issue.filePath || issue.ref))

  return (
    <div
      onClick={clickable ? () => onNavigate!(issue) : undefined}
      className={`group flex items-start gap-2.5 px-3 py-2 border-b border-border/20 last:border-b-0 transition-colors ${
        clickable ? 'cursor-pointer hover:bg-accent/40' : ''
      }`}
    >
      <div className={`mt-px shrink-0 ${severity === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
        <Icon size={12} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] leading-relaxed text-foreground/85">{issue.message}</p>
        <div className="flex flex-wrap items-center gap-1 mt-1">
          {config && (
            <Badge variant="secondary" className="text-[9px] h-[14px] px-1 font-normal rounded-sm">
              {config.label}
            </Badge>
          )}
          {issue.ref && (
            <Badge variant={severity === 'error' ? 'destructive' : 'outline'} className="text-[9px] h-[14px] px-1 font-mono rounded-sm">
              {issue.ref}
            </Badge>
          )}
          {filePath && (
            <span className="text-[9px] text-muted-foreground/70 font-mono truncate max-w-[180px]">
              {filePath.length > 30 ? '…' + filePath.slice(-28) : filePath}
            </span>
          )}
          {clickable && (
            <ExternalLink size={8} className="text-muted-foreground/30 group-hover:text-primary transition-colors ml-auto shrink-0" />
          )}
        </div>
      </div>
    </div>
  )
})

/* ── Workflow Group ─────────────────────────────────────────────────── */

const WorkflowGroup = memo(function WorkflowGroup({
  workflowId, errors, warnings, defaultOpen, onNavigate,
}: {
  workflowId: string; errors: ValidationIssue[]; warnings: ValidationIssue[]
  defaultOpen: boolean; onNavigate?: (issue: ValidationIssue) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const total = errors.length + warnings.length
  if (total === 0) return null

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left transition-colors hover:bg-accent/30"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <Workflow size={11} className="text-muted-foreground" />
        <span className="text-[11px] font-medium flex-1 truncate">{workflowId}</span>
        {errors.length > 0 && (
          <Badge variant="secondary" className="h-[14px] text-[9px] px-1 bg-red-500/10 text-red-400 rounded-sm">
            {errors.length}
          </Badge>
        )}
        {warnings.length > 0 && (
          <Badge variant="secondary" className="h-[14px] text-[9px] px-1 bg-amber-500/10 text-amber-400 rounded-sm">
            {warnings.length}
          </Badge>
        )}
      </button>
      {open && (
        <div className="ml-2 mr-2 mb-1 rounded-md border border-border/30 overflow-hidden bg-card/20">
          {errors.map((issue, i) => (
            <IssueRow key={`e-${i}`} issue={issue} severity="error" onNavigate={onNavigate} />
          ))}
          {warnings.map((issue, i) => (
            <IssueRow key={`w-${i}`} issue={issue} severity="warning" onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
})

/* ── Dead export kept for compat ───────────────────────────────────── */

export function ValidationPanel() {
  return null
}

/* ── Main Panel Content ────────────────────────────────────────────── */

export function ValidationPanelContent() {
  const validationResult = useAppStore(s => s.validationResult)
  const validate = useAppStore(s => s.validate)
  const openFocus = useAppStore(s => s.openFocus)
  const activeWf = useAppStore(s => s.activeWf)
  const data = useAppStore(s => s.data)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<'all' | 'error' | 'warning'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [workflowFilter, setWorkflowFilter] = useState<string>(() => activeWf || '')

  const allIssues = useMemo(() => {
    if (!validationResult) return { errors: [], warnings: [] }
    return { errors: validationResult.errors, warnings: validationResult.warnings }
  }, [validationResult])

  const errorCount = allIssues.errors.length
  const warnCount = allIssues.warnings.length
  const totalCount = errorCount + warnCount
  const isClean = validationResult && totalCount === 0

  // Available filter options
  const availableTypes = useMemo(() => getIssueTypes([...allIssues.errors, ...allIssues.warnings]), [allIssues])
  const availableWorkflows = useMemo(() => getIssueWorkflows([...allIssues.errors, ...allIssues.warnings]), [allIssues])

  // Filtered issues
  const filtered = useMemo(() => {
    let errors = allIssues.errors
    let warnings = allIssues.warnings

    if (severityFilter === 'error') warnings = []
    if (severityFilter === 'warning') errors = []

    if (typeFilter) {
      errors = errors.filter(i => i.type === typeFilter)
      warnings = warnings.filter(i => i.type === typeFilter)
    }
    if (workflowFilter) {
      errors = errors.filter(i => getIssueWorkflow(i) === workflowFilter)
      warnings = warnings.filter(i => getIssueWorkflow(i) === workflowFilter)
    }
    return { errors, warnings }
  }, [allIssues, severityFilter, typeFilter, workflowFilter])

  // Group by workflow
  const groupedByWorkflow = useMemo(() => {
    const map = new Map<string, { errors: ValidationIssue[]; warnings: ValidationIssue[] }>()
    filtered.errors.forEach(i => {
      const wf = getIssueWorkflow(i)
      if (!map.has(wf)) map.set(wf, { errors: [], warnings: [] })
      map.get(wf)!.errors.push(i)
    })
    filtered.warnings.forEach(i => {
      const wf = getIssueWorkflow(i)
      if (!map.has(wf)) map.set(wf, { errors: [], warnings: [] })
      map.get(wf)!.warnings.push(i)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const filteredTotal = filtered.errors.length + filtered.warnings.length
  const hasFilters = severityFilter !== 'all' || typeFilter || workflowFilter

  const handleValidate = useCallback(async () => {
    setValidating(true); setError(null)
    try { await validate() } catch (err) { setError(err instanceof Error ? err.message : 'Validation failed') }
    setValidating(false)
  }, [validate])

  const handleIssueNavigate = useCallback((issue: ValidationIssue) => {
    const wfId = issue.workflow || activeWf
    if (!wfId || !data) return
    const wf = data.workflows[wfId]

    let nodeId: string | null = null
    if (wf) {
      if (issue.nodes?.length) nodeId = issue.nodes[0]
      if (!nodeId && issue.filePath) {
        for (const [id, node] of Object.entries(wf.nodes)) {
          if (id === issue.filePath || node.primaryFile?.filePath === issue.filePath || node.primaryFile?.relativePath === issue.filePath) {
            nodeId = id; break
          }
        }
      }
      if (!nodeId && issue.ref && wf.nodes[issue.ref]) nodeId = issue.ref
    }

    if (nodeId && wf?.nodes[nodeId]) {
      openFocus({ type: 'node', nodeId, workflowId: wfId })
    } else if (issue.filePath) {
      // Fall back to selecting the file in the explorer
      const selectFile = useAppStore.getState().selectFile
      if (selectFile) selectFile(issue.filePath)
    }
  }, [activeWf, data, openFocus])

  // Auto-validate on mount
  useEffect(() => {
    if (!validationResult && !validating) handleValidate()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // External refresh
  useEffect(() => {
    const onRefresh = () => handleValidate()
    window.addEventListener('agentflow:validation-refresh', onRefresh)
    return () => window.removeEventListener('agentflow:validation-refresh', onRefresh)
  }, [handleValidate])

  const clearFilters = useCallback(() => {
    setSeverityFilter('all'); setTypeFilter(''); setWorkflowFilter('')
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary bar */}
      <div className="relative flex items-center gap-2 px-3 py-1.5 border-b border-border/30 shrink-0">
        <FeatureHint id="validation" text="Checks for broken references, missing fields, unreachable nodes, and graph structure issues." show={!validating} side="bottom" />
        {validating ? (
          <Spinner size="sm" className="text-primary" />
        ) : errorCount > 0 ? (
          <XCircle size={12} className="text-red-400" />
        ) : warnCount > 0 ? (
          <AlertTriangle size={12} className="text-amber-400" />
        ) : validationResult ? (
          <CheckCircle size={12} className="text-emerald-400" />
        ) : (
          <CheckCircle size={12} className="text-muted-foreground/50" />
        )}
        <span className="text-[10px] text-muted-foreground flex-1">
          {validating ? 'Validating…'
            : validationResult
              ? totalCount > 0
                ? `${errorCount} error${errorCount !== 1 ? 's' : ''} · ${warnCount} warning${warnCount !== 1 ? 's' : ''}`
                : 'All clear'
              : 'Not validated'}
        </span>
        <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[9px]" onClick={handleValidate} disabled={validating}>
          <RefreshCw size={10} className={validating ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Filters — only show when there are issues */}
      {totalCount > 0 && (
        <div className="px-2 py-1.5 border-b border-border/20 space-y-1.5 shrink-0">
          {/* Severity chips */}
          <div className="flex items-center gap-1">
            <Filter size={9} className="text-muted-foreground/50 shrink-0" />
            {(['all', 'error', 'warning'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                  severityFilter === s
                    ? s === 'error' ? 'bg-red-500/15 text-red-400'
                      : s === 'warning' ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-primary/15 text-primary'
                    : 'text-muted-foreground/60 hover:bg-accent/40'
                }`}
              >
                {s === 'all' ? `All (${totalCount})` : s === 'error' ? `Errors (${errorCount})` : `Warnings (${warnCount})`}
              </button>
            ))}
          </div>

          {/* Workflow filter chips */}
          {availableWorkflows.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {availableWorkflows.map(wf => (
                <button
                  key={wf}
                  onClick={() => setWorkflowFilter(workflowFilter === wf ? '' : wf)}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                    workflowFilter === wf
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground/60 hover:bg-accent/40'
                  }`}
                >
                  <Workflow size={8} />
                  {wf}
                </button>
              ))}
            </div>
          )}

          {/* Type filter chips */}
          {availableTypes.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {availableTypes.map(t => {
                const cfg = ISSUE_TYPE_CONFIG[t]
                return (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                      typeFilter === t
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground/60 hover:bg-accent/40'
                    }`}
                  >
                    {cfg?.label || t}
                  </button>
                )
              })}
            </div>
          )}

          {/* Active filter summary */}
          {hasFilters && (
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground/60">
                {filteredTotal} of {totalCount} issues
              </span>
              <button onClick={clearFilters} className="text-[9px] text-primary hover:underline">
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="overflow-auto flex-1">
        {error && (
          <div className="flex flex-col items-center py-6 gap-2 px-3">
            <XCircle size={20} className="text-red-400" />
            <p className="text-[10px] text-destructive text-center">{error}</p>
            <Button variant="outline" size="sm" className="h-5 text-[9px]" onClick={handleValidate} disabled={validating}>
              Retry
            </Button>
          </div>
        )}

        {validating && !validationResult && !error && (
          <div className="flex flex-col items-center py-10 gap-2">
            <Spinner size="lg" className="text-primary" />
            <p className="text-[10px] text-muted-foreground">Running validation…</p>
          </div>
        )}

        {!validationResult && !validating && !error && (
          <div className="flex flex-col items-center py-10 gap-2">
            <CheckCircle size={20} className="text-muted-foreground/30" />
            <p className="text-[10px] text-muted-foreground">Click validate to check your workflow</p>
          </div>
        )}

        {isClean && !error && (
          <div className="flex flex-col items-center py-10 gap-2">
            <CheckCircle size={24} className="text-emerald-400" />
            <p className="text-[10px] text-muted-foreground">No issues found</p>
          </div>
        )}

        {!error && validationResult && filteredTotal > 0 && (
          <div className="py-0.5">
            {groupedByWorkflow.map(([wfId, { errors, warnings }]) => (
              <WorkflowGroup
                key={wfId}
                workflowId={wfId}
                errors={errors}
                warnings={warnings}
                defaultOpen={groupedByWorkflow.length <= 3}
                onNavigate={handleIssueNavigate}
              />
            ))}
          </div>
        )}

        {!error && validationResult && totalCount > 0 && filteredTotal === 0 && (
          <div className="flex flex-col items-center py-8 gap-2">
            <Filter size={18} className="text-muted-foreground/30" />
            <p className="text-[10px] text-muted-foreground">No issues match filters</p>
            <button onClick={clearFilters} className="text-[10px] text-primary hover:underline">Clear filters</button>
          </div>
        )}
      </div>
    </div>
  )
}
