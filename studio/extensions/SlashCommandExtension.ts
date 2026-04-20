import { Extension } from '@tiptap/react'
import { Suggestion } from '@tiptap/suggestion'
import type { SuggestionOptions, SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import type { Editor, Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  Wrench, Brain, Zap, Database, Box,
  ArrowRight, ArrowUpRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CATEGORY_CONFIG } from '@/lib/constants'
import { parseRefInner } from './RefChipExtension'
import type { SlashCommand, ResourceItem, ResourceCategory, WorkflowGraph } from '@/lib/types'

// ── Slash command definitions ────────────────────────────────────────

const SLASH_COMMANDS: SlashCommand[] = [
  // Reference category
  { id: 'ref-capabilities',  title: 'Capability',  description: 'Insert a capability reference',  category: 'reference' },
  { id: 'ref-instructions',  title: 'Instruction', description: 'Insert an instruction reference', category: 'reference' },
  { id: 'ref-runbooks',      title: 'Runbook',     description: 'Insert a runbook reference',     category: 'reference' },
  { id: 'ref-memory',        title: 'Memory',      description: 'Insert a memory reference',      category: 'reference' },
  { id: 'ref-nodes',         title: 'Node',         description: 'Insert a node reference',        category: 'reference' },
  // Edge category
  { id: 'edge-ref',         title: 'Edge',         description: 'Insert an edge reference (→)',   category: 'edge' },
  { id: 'cond-edge-ref',    title: 'Conditional Edge', description: 'Insert a conditional edge (→ … | condition)', category: 'edge' },
  // Data Flow category
  { id: 'data-flow-ref',    title: 'Data Flow',    description: 'Insert a data flow reference (⇠)', category: 'data-flow' },
]

/** Map command id to the resource category key used in WorkflowGraph */
const COMMAND_TO_CATEGORY: Record<string, string> = {
  'ref-capabilities':  'capabilities',
  'ref-instructions':  'instructions',
  'ref-runbooks':      'runbooks',
  'ref-memory':        'memory',
  'ref-nodes':         'nodes',
  'edge-ref':          'nodes',
  'cond-edge-ref':     'nodes',
  'data-flow-ref':     'nodes',
}

/** Get the icon for a slash command */
function commandIcon(cmd: SlashCommand): LucideIcon {
  switch (cmd.id) {
    case 'ref-capabilities':  return Wrench
    case 'ref-instructions':  return Brain
    case 'ref-runbooks':      return Zap
    case 'ref-memory':        return Database
    case 'ref-nodes':         return Box
    case 'edge-ref':          return ArrowRight
    case 'cond-edge-ref':     return ArrowRight
    case 'data-flow-ref':     return ArrowUpRight
    default:                  return Box
  }
}

/** Get the MD3 tonal color for a slash command */
function commandColor(cmd: SlashCommand): string {
  const catKey = COMMAND_TO_CATEGORY[cmd.id]
  if (catKey && CATEGORY_CONFIG[catKey]) return CATEGORY_CONFIG[catKey].primaryColor
  if (cmd.category === 'edge') return CATEGORY_CONFIG.nodes?.primaryColor || '#1565C0'
  if (cmd.category === 'data-flow') return '#79747E' // MD3 outline / neutral
  return '#79747E' // MD3 outline / neutral
}

/** Category display labels */
const CATEGORY_LABELS: Record<string, string> = {
  'reference': 'Reference',
  'edge': 'Edge',
  'data-flow': 'Data Flow',
}

// ── Fuzzy filter ─────────────────────────────────────────────────────

export function fuzzyFilterCommands(commands: SlashCommand[], query: string): SlashCommand[] {
  if (!query) return commands
  const q = query.toLowerCase()
  return commands.filter(cmd =>
    cmd.title.toLowerCase().includes(q) ||
    cmd.category.toLowerCase().includes(q) ||
    cmd.description.toLowerCase().includes(q)
  )
}

// ── Resource item helpers ────────────────────────────────────────────

export function getResourceItems(data: WorkflowGraph | null, activeWf: string, commandId: string): ResourceItem[] {
  if (!data) return []
  const items: ResourceItem[] = []

  const addResources = (category: ResourceCategory, records: Record<string, unknown>) => {
    for (const name of Object.keys(records)) {
      items.push({ name, category, refSyntax: `${category}/${name}` })
    }
  }

  switch (commandId) {
    case 'ref-capabilities':
      addResources('capabilities', data.capabilities)
      break
    case 'ref-instructions':
      addResources('instructions', data.instructions)
      break
    case 'ref-runbooks':
      addResources('runbooks', data.runbooks)
      break
    case 'ref-memory':
      addResources('memory', data.memory)
      break
    case 'ref-nodes': {
      const wf = data.workflows[activeWf]
      if (wf) {
        for (const id of Object.keys(wf.nodes)) {
          items.push({ name: id, category: 'instructions' as ResourceCategory, refSyntax: `nodes/${id}` })
        }
      }
      break
    }
    case 'edge-ref':
    case 'cond-edge-ref': {
      const wf = data.workflows[activeWf]
      if (wf) {
        for (const id of Object.keys(wf.nodes)) {
          items.push({ name: id, category: 'instructions' as ResourceCategory, refSyntax: `nodes/${id}` })
        }
      }
      break
    }
    case 'data-flow-ref': {
      const wf = data.workflows[activeWf]
      if (wf) {
        for (const id of Object.keys(wf.nodes)) {
          items.push({ name: id, category: 'instructions' as ResourceCategory, refSyntax: `output.${id}` })
        }
      }
      break
    }
  }
  return items
}

// ── Insert ref chip into editor ──────────────────────────────────────

function insertRefChip(editor: Editor, range: Range, refSyntax: string, commandId: string) {
  let raw: string
  if (commandId === 'edge-ref') {
    raw = `-> ${refSyntax}`
  } else if (commandId === 'cond-edge-ref') {
    // For conditional edge, insert with a placeholder condition
    raw = `-> ${refSyntax} | condition`
  } else if (commandId === 'data-flow-ref') {
    raw = `<< ${refSyntax}`
  } else {
    raw = refSyntax
  }

  const parsed = parseRefInner(raw)

  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent({
      type: 'refChip',
      attrs: {
        raw,
        semanticType: parsed.semanticType,
        category: parsed.category,
        refName: parsed.refName,
        condition: parsed.condition,
      },
    })
    .insertContent(' ')
    .run()
}

// ── Palette state for the React component ────────────────────────────

interface PaletteState {
  items: SlashCommand[]
  selectedIndex: number
  command: (props: { commandId: string; item?: ResourceItem }) => void
  // Secondary picker state
  secondaryItems: ResourceItem[] | null
  secondaryIndex: number
  activeCommandId: string | null
}

// ── SlashCommandPalette React component ──────────────────────────────

// MD3 palette styles (inline, since this renders outside MUI ThemeProvider)
const paletteContainerStyle: Record<string, string> = {
  background: 'var(--surface-elevated, #FFFBFE)',
  border: '1px solid var(--border-primary, #CAC4D0)',
  borderRadius: '12px',
  boxShadow: '0px 4px 8px 3px rgba(0,0,0,0.15), 0px 1px 3px rgba(0,0,0,0.3)',
  width: '300px',
  overflow: 'hidden',
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  color: 'var(--text-primary, #1C1B1F)',
}

const paletteEmptyTextStyle: Record<string, string> = {
  padding: '12px',
  fontSize: '13px',
  color: 'var(--text-secondary, #79747E)',
}

const paletteSectionHeaderStyle: Record<string, string> = {
  padding: '8px 12px 4px',
  fontSize: '11px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--text-secondary, #79747E)',
  borderBottom: '1px solid var(--border-primary, #CAC4D0)',
}

const paletteSectionHeaderNoBorderStyle: Record<string, string> = {
  ...paletteSectionHeaderStyle,
  borderBottom: 'none',
}

function paletteItemStyle(selected: boolean): Record<string, string> {
  return {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    fontSize: '13px',
    textAlign: 'left',
    transition: 'background 150ms',
    cursor: 'pointer',
    border: 'none',
    background: selected ? 'color-mix(in srgb, var(--text-primary, #1565C0) 12%, transparent)' : 'transparent',
    color: 'var(--text-primary, #1C1B1F)',
  }
}

function SlashCommandPalette(props: { state: PaletteState }) {
  const { state } = props
  const { items, selectedIndex, command, secondaryItems, secondaryIndex, activeCommandId } = state

  // Secondary picker view
  if (secondaryItems !== null && activeCommandId) {
    if (secondaryItems.length === 0) {
      return createElement('div', {
        className: 'slash-command-palette',
        style: paletteContainerStyle,
      },
        createElement('div', {
          style: paletteEmptyTextStyle,
        }, 'No items available')
      )
    }

    return createElement('div', {
      className: 'slash-command-palette',
      style: paletteContainerStyle,
    },
      createElement('div', {
        style: paletteSectionHeaderStyle,
      }, 'Select Item'),
      createElement('div', {
        style: { maxHeight: '208px', overflowY: 'auto', padding: '4px 0' },
      },
        ...secondaryItems.map((item, i) => {
          const catCfg = CATEGORY_CONFIG[item.refSyntax.split('/')[0]] || CATEGORY_CONFIG.nodes
          const Icon = catCfg?.icon || Box
          return createElement('button', {
            key: item.refSyntax,
            style: paletteItemStyle(i === secondaryIndex),
            onMouseDown: (e: MouseEvent) => {
              e.preventDefault()
              command({ commandId: activeCommandId, item })
            },
            onMouseEnter: () => {
              // Visual hover handled by CSS, selection handled by keyboard
            },
          },
            createElement(Icon, { style: { width: 14, height: 14, flexShrink: 0, color: catCfg?.primaryColor || '#79747E' } }),
            createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: 500 } }, item.name),
          )
        })
      )
    )
  }

  // Primary command list view
  if (items.length === 0) {
    return createElement('div', {
      className: 'slash-command-palette',
      style: paletteContainerStyle,
    },
      createElement('div', {
        style: paletteEmptyTextStyle,
      }, 'No matching commands')
    )
  }

  // Group commands by category
  const groups: { label: string; commands: { cmd: SlashCommand; globalIdx: number }[] }[] = []
  const seen = new Set<string>()
  items.forEach((cmd, globalIdx) => {
    if (!seen.has(cmd.category)) {
      seen.add(cmd.category)
      groups.push({
        label: CATEGORY_LABELS[cmd.category] || cmd.category,
        commands: [],
      })
    }
    const group = groups.find(g => g.label === (CATEGORY_LABELS[cmd.category] || cmd.category))!
    group.commands.push({ cmd, globalIdx })
  })

  return createElement('div', {
    className: 'slash-command-palette',
    style: paletteContainerStyle,
  },
    createElement('div', {
      style: { maxHeight: '256px', overflowY: 'auto', padding: '4px 0' },
    },
      ...groups.map(group =>
        createElement('div', { key: group.label },
          createElement('div', {
            style: paletteSectionHeaderNoBorderStyle,
          }, group.label),
          ...group.commands.map(({ cmd, globalIdx }) => {
            const Icon = commandIcon(cmd)
            const color = commandColor(cmd)
            return createElement('button', {
              key: cmd.id,
              style: paletteItemStyle(globalIdx === selectedIndex),
              onMouseDown: (e: MouseEvent) => {
                e.preventDefault()
                command({ commandId: cmd.id })
              },
            },
              createElement(Icon, { style: { width: 14, height: 14, flexShrink: 0, color } }),
              createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: 500 } }, cmd.title),
              createElement('span', { style: { fontSize: '11px', color: 'var(--text-secondary, #79747E)', flexShrink: 0 } }, cmd.description),
            )
          })
        )
      )
    )
  )
}

// ── Suggestion render function ───────────────────────────────────────

function createSuggestionRenderer(
  getData: () => WorkflowGraph | null,
  getActiveWf: () => string,
) {
  return () => {
    let root: Root | null = null
    let container: HTMLDivElement | null = null
    let selectedIndex = 0
    let items: SlashCommand[] = []
    let commandFn: ((props: { commandId: string; item?: ResourceItem }) => void) | null = null

    // Secondary picker state
    let secondaryItems: ResourceItem[] | null = null
    let secondaryIndex = 0
    let activeCommandId: string | null = null

    function renderPalette() {
      if (!root) return
      root.render(
        createElement(SlashCommandPalette, {
          state: {
            items,
            selectedIndex,
            command: commandFn || (() => {}),
            secondaryItems,
            secondaryIndex,
            activeCommandId,
          },
        })
      )
    }

    function showSecondaryPicker(cmdId: string, props: SuggestionProps<SlashCommand>) {
      const data = getData()
      const activeWf = getActiveWf()
      activeCommandId = cmdId
      secondaryItems = getResourceItems(data, activeWf, cmdId)
      secondaryIndex = 0
      commandFn = ({ commandId, item }: { commandId: string; item?: ResourceItem }) => {
        if (item) {
          insertRefChip(props.editor, props.range, item.refSyntax, commandId)
        }
      }
      renderPalette()
    }

    return {
      onStart(props: SuggestionProps<SlashCommand>) {
        items = props.items
        selectedIndex = 0
        secondaryItems = null
        secondaryIndex = 0
        activeCommandId = null

        container = document.createElement('div')
        container.style.position = 'absolute'
        container.style.zIndex = '50'
        document.body.appendChild(container)
        root = createRoot(container)

        commandFn = ({ commandId }: { commandId: string }) => {
          const cmd = SLASH_COMMANDS.find(c => c.id === commandId)
          if (!cmd) return
          // Resource-type commands show secondary picker
          if (cmd.category === 'reference' || cmd.category === 'edge' || cmd.category === 'data-flow') {
            showSecondaryPicker(commandId, props)
          }
        }

        // Position the popup
        if (props.clientRect) {
          const rect = props.clientRect()
          if (rect && container) {
            container.style.left = `${rect.left}px`
            container.style.top = `${rect.bottom + 4}px`
          }
        }

        renderPalette()
      },

      onUpdate(props: SuggestionProps<SlashCommand>) {
        // If we're in secondary picker mode, don't update the primary list
        if (secondaryItems !== null) {
          // Update position
          if (props.clientRect && container) {
            const rect = props.clientRect()
            if (rect) {
              container.style.left = `${rect.left}px`
              container.style.top = `${rect.bottom + 4}px`
            }
          }
          // Update the command function with new range
          commandFn = ({ commandId, item }: { commandId: string; item?: ResourceItem }) => {
            if (item) {
              insertRefChip(props.editor, props.range, item.refSyntax, commandId)
            }
          }
          return
        }

        items = props.items
        selectedIndex = 0

        commandFn = ({ commandId }: { commandId: string }) => {
          const cmd = SLASH_COMMANDS.find(c => c.id === commandId)
          if (!cmd) return
          if (cmd.category === 'reference' || cmd.category === 'edge' || cmd.category === 'data-flow') {
            showSecondaryPicker(commandId, props)
          }
        }

        if (props.clientRect && container) {
          const rect = props.clientRect()
          if (rect) {
            container.style.left = `${rect.left}px`
            container.style.top = `${rect.bottom + 4}px`
          }
        }

        renderPalette()
      },

      onKeyDown({ event }: SuggestionKeyDownProps) {
        // Handle secondary picker keyboard navigation
        if (secondaryItems !== null) {
          if (event.key === 'ArrowDown') {
            secondaryIndex = Math.min(secondaryIndex + 1, secondaryItems.length - 1)
            renderPalette()
            return true
          }
          if (event.key === 'ArrowUp') {
            secondaryIndex = Math.max(secondaryIndex - 1, 0)
            renderPalette()
            return true
          }
          if (event.key === 'Enter') {
            const item = secondaryItems[secondaryIndex]
            if (item && commandFn && activeCommandId) {
              commandFn({ commandId: activeCommandId, item })
            }
            return true
          }
          if (event.key === 'Escape') {
            // Go back to primary list
            secondaryItems = null
            secondaryIndex = 0
            activeCommandId = null
            renderPalette()
            return true
          }
          return false
        }

        // Primary list keyboard navigation
        if (event.key === 'ArrowDown') {
          selectedIndex = Math.min(selectedIndex + 1, items.length - 1)
          renderPalette()
          return true
        }
        if (event.key === 'ArrowUp') {
          selectedIndex = Math.max(selectedIndex - 1, 0)
          renderPalette()
          return true
        }
        if (event.key === 'Enter') {
          const cmd = items[selectedIndex]
          if (cmd && commandFn) {
            commandFn({ commandId: cmd.id })
          }
          return true
        }
        if (event.key === 'Escape') {
          return true // Let suggestion plugin handle dismissal
        }
        return false
      },

      onExit() {
        if (root) {
          root.unmount()
          root = null
        }
        if (container) {
          container.remove()
          container = null
        }
        selectedIndex = 0
        items = []
        secondaryItems = null
        secondaryIndex = 0
        activeCommandId = null
        commandFn = null
      },
    }
  }
}

// ── tiptap Extension ─────────────────────────────────────────────────

export const slashCommandPluginKey = new PluginKey('slashCommand')

export interface SlashCommandExtensionOptions {
  suggestion: Partial<SuggestionOptions<SlashCommand>>
  getData: () => WorkflowGraph | null
  getActiveWf: () => string
}

export const SlashCommandExtension = Extension.create<SlashCommandExtensionOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        allowSpaces: false,
        startOfLine: false,
        allowedPrefixes: [' ', '\n', null] as unknown as string[],
      },
      getData: () => null,
      getActiveWf: () => '',
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommand>({
        editor: this.editor,
        pluginKey: slashCommandPluginKey,
        char: this.options.suggestion.char || '/',
        allowSpaces: false,
        startOfLine: false,
        allowedPrefixes: this.options.suggestion.allowedPrefixes as string[] || null,
        items: ({ query }) => {
          return fuzzyFilterCommands(SLASH_COMMANDS, query)
        },
        command: () => {
          // Commands are handled in the render callbacks (secondary picker flow)
        },
        render: createSuggestionRenderer(
          this.options.getData,
          this.options.getActiveWf,
        ),
      }),
    ]
  },
})

export { SLASH_COMMANDS }
export default SlashCommandExtension
