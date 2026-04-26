import { memo, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from './ui/dialog'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from './ui/tooltip'
import { Button } from './ui/button'
import { X, HelpCircle, Keyboard, BookOpen } from 'lucide-react'
import { getCategoryConfig } from '@/lib/constants'
import { cn } from '@/lib/utils'

// ── Shortcuts data ──────────────────────────────────────────────────────

interface Shortcut { keys: string[]; label: string }
interface ShortcutGroup { title: string; shortcuts: Shortcut[] }

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
const mod = isMac ? '⌘' : 'Ctrl'

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  { title: 'Navigation', shortcuts: [
    { keys: [mod, 'K'], label: 'Command palette' },
    { keys: [mod, 'B'], label: 'Toggle explorer' },
    { keys: [mod, 'L'], label: 'Toggle elements library' },
    { keys: ['Esc'], label: 'Close panel / drawer' },
  ]},
  { title: 'Editing', shortcuts: [
    { keys: [mod, 'Z'], label: 'Undo' },
    { keys: [mod, '⇧', 'Z'], label: 'Redo' },
    { keys: [mod, 'S'], label: 'Save' },
    { keys: [mod, '1–4'], label: 'Switch drawer tab' },
  ]},
  { title: 'Canvas', shortcuts: [
    { keys: [mod, '+'], label: 'Zoom in' },
    { keys: [mod, '−'], label: 'Zoom out' },
    { keys: [mod, '0'], label: 'Reset zoom' },
    { keys: ['Double-click'], label: 'Add node at position' },
    { keys: ['⌫'], label: 'Delete selected node' },
    { keys: [mod, 'D'], label: 'Duplicate selected node' },
    { keys: ['R'], label: 'Toggle resources' },
    { keys: ['⇧', 'Click'], label: 'Build path trail' },
    { keys: ['Enter'], label: 'Focus mode (when not editing)' },
  ]},
  { title: 'Editor', shortcuts: [
    { keys: ['/'], label: 'Insert reference (slash command)' },
    { keys: ['Visual'], label: 'Rich text editing with ref chips' },
    { keys: ['Source'], label: 'Raw markdown in Monaco editor' },
    { keys: ['↑', '↓'], label: 'Move narrative blocks (hover buttons)' },
    { keys: ['{{'], label: 'Autocomplete refs in source mode' },
  ]},
  { title: 'Files', shortcuts: [
    { keys: ['Drag & Drop'], label: 'Import files into workspace' },
    { keys: ['Upload ↑'], label: 'Click upload button in explorer' },
    { keys: [mod, 'F'], label: 'Find in Monaco editor' },
  ]},
]

// ── Concepts data (derived from constants.ts — single source of truth) ──

interface ConceptEntry {
  key: string
  label: string
  tooltip: string
  ecosystemHint: string
  directory: string
}

const CONCEPTS: ConceptEntry[] = [
  { key: 'instructions', label: 'Instructions', tooltip: 'Reusable agent instructions — project rules and workflow skills', ecosystemHint: 'Cursor Rules · Kiro Steering · SKILL.md · CLAUDE.md conventions', directory: 'instructions/' },
  { key: 'capabilities', label: 'Capabilities', tooltip: 'Tools the agent can use — MCP servers, built-ins, scripts', ecosystemHint: 'MCP tools · shell commands · built-in IDE actions', directory: 'capabilities/' },
  { key: 'skills', label: 'Skills', tooltip: 'Human checkpoints and routing conditions', ecosystemHint: 'Approval gates · branch conditions · pause points', directory: 'skills/' },
  { key: 'memory', label: 'Memory', tooltip: 'Persistent context the agent remembers across sessions', ecosystemHint: 'Facts · decisions · lessons — any agent can read these', directory: 'memory/' },
  { key: 'hooks', label: 'Hooks', tooltip: 'Event-driven automation — runs when files change or tools execute. Click a hook to open the Protocol Panel editor.', ecosystemHint: 'Kiro Hooks · Claude Code Hooks · event triggers · JSON config', directory: 'hooks/' },
  { key: 'workflows', label: 'Workflows', tooltip: 'Agent workflows composed from skills wired together', ecosystemHint: 'Like Kiro Specs · composed Agent Skills', directory: '<workflow>/' },
  { key: 'nodes', label: 'Nodes', tooltip: 'A step in the workflow — agent, gateway, or sub-workflow. Visual mode for rich editing, Source mode for Monaco.', ecosystemHint: 'Each node is a standard Agent Skill (SKILL.md)', directory: '<workflow>/<node>/SKILL.md' },
  { key: 'files', label: 'File Viewer', tooltip: 'Any file type can be imported and viewed. Markdown files get rich editing with refs. Code files open in Monaco with syntax highlighting. CSV, images, and PDFs get native preview.', ecosystemHint: 'Drag & drop · upload · .md .json .yaml .py .ts .csv .pdf and more', directory: '*.*' },
]


// ── Shared components ───────────────────────────────────────────────────

const KeyChip = memo(function KeyChip({ k }: { k: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded text-xs font-mono font-semibold bg-muted border border-border shadow-[0_1px_0_rgba(0,0,0,0.08)] dark:shadow-[0_1px_0_rgba(255,255,255,0.05)]">
      {k}
    </kbd>
  )
})

// ── Tab: Shortcuts ──────────────────────────────────────────────────────

function ShortcutsTab() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2">
      {SHORTCUT_GROUPS.map((group) => (
        <div key={group.title} className="px-5 py-3 border-b border-border">
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2 block">
            {group.title}
          </span>
          <div className="flex flex-col gap-1.5">
            {group.shortcuts.map((sc) => (
              <div key={sc.label} className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-[13px] text-muted-foreground">{sc.label}</span>
                <div className="flex gap-1 shrink-0">
                  {sc.keys.map((k, i) => <KeyChip key={i} k={k} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab: Concepts ───────────────────────────────────────────────────────

function ConceptsTab() {
  const catConfig = getCategoryConfig('dark') // icons only, color handled inline
  return (
    <div className="px-5 py-3 space-y-3 max-h-[400px] overflow-auto">
      <p className="text-[12px] text-muted-foreground leading-relaxed">
        AgentFlow organizes agent resources into categories. Each maps to concepts you may know from other platforms.
      </p>
      {CONCEPTS.map((c) => {
        const cfg = catConfig[c.key]
        const Icon = cfg?.icon
        return (
          <div key={c.key} className="flex gap-2.5 py-1.5">
            {Icon && (
              <div className="size-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: `${cfg.primaryColor}18` }}>
                <Icon size={14} style={{ color: cfg.primaryColor }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold">{c.label}</span>
                <code className="text-[10px] text-muted-foreground/60 font-mono">{c.directory}</code>
              </div>
              <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">{c.tooltip}</p>
              <p className="text-[11px] text-muted-foreground/60 leading-snug mt-0.5">{c.ecosystemHint}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main dialog ─────────────────────────────────────────────────────────

type HelpTab = 'shortcuts' | 'concepts'

export interface KeyboardShortcutsDialogProps {
  open: boolean
  onClose: () => void
}

export function KeyboardShortcutsDialog({ open, onClose }: KeyboardShortcutsDialogProps) {
  const [tab, setTab] = useState<HelpTab>('shortcuts')

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md overflow-hidden p-0" hideClose>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b bg-muted/30">
          <div className="w-8 h-8 rounded-lg shrink-0 bg-primary flex items-center justify-center">
            <HelpCircle size={16} className="text-primary-foreground" />
          </div>
          <DialogHeader className="flex-1 space-y-0">
            <DialogTitle className="text-[15px] font-semibold">Help</DialogTitle>
          </DialogHeader>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                  <X size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-5">
          {([
            { id: 'shortcuts' as HelpTab, label: 'Shortcuts', icon: Keyboard },
            { id: 'concepts' as HelpTab, label: 'Concepts', icon: BookOpen },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border-b-2 transition-colors -mb-px',
                tab === t.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'shortcuts' ? <ShortcutsTab /> : <ConceptsTab />}
      </DialogContent>
    </Dialog>
  )
}
