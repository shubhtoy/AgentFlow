import { Node, nodeInputRule, nodePasteRule } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { createElement } from 'react'
import { refCategory, refName } from '@/lib/constants'
import { useCategoryConfig } from '../hooks/useCategoryConfig'
import type { SemanticType } from '@/lib/types'
import { useStore } from '../store'

// ── HTML / attribute escaping helpers ────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Ref parsing helpers ──────────────────────────────────────────────

/** Regex matching all ref token forms inside {{ }} */
const REF_PATTERN = /\{\{(.+?)\}\}/g

/** Regex for input rules — matches a typed {{...}} followed by a space or end */
const REF_INPUT_REGEX = /\{\{(.+?)\}\}\s$/

/** Parse the inner ref string to determine semantic type and parts */
function parseRefInner(inner: string): {
  semanticType: SemanticType
  category: string
  refName: string
  condition: string | null
} {
  const trimmed = inner.trim()

  // Data flow: << output.name
  if (trimmed.startsWith('<<')) {
    const rest = trimmed.slice(2).trim()
    return {
      semanticType: 'data_flow',
      category: 'output',
      refName: rest.startsWith('output.') ? rest.slice(7) : rest,
      condition: null,
    }
  }

  // Edge: -> category/name or -> category/name | condition
  if (trimmed.startsWith('->')) {
    const rest = trimmed.slice(2).trim()
    const pipeIdx = rest.indexOf('|')
    if (pipeIdx !== -1) {
      const target = rest.slice(0, pipeIdx).trim()
      const condition = rest.slice(pipeIdx + 1).trim()
      return {
        semanticType: 'edge',
        category: refCategory(target),
        refName: refName(target),
        condition,
      }
    }
    return {
      semanticType: 'edge',
      category: refCategory(rest),
      refName: refName(rest),
      condition: null,
    }
  }

  // Mention: category/name
  return {
    semanticType: 'mention',
    category: refCategory(trimmed),
    refName: refName(trimmed),
    condition: null,
  }
}

// ── React component for rendering the chip ───────────────────────────

function RefChipComponent(props: NodeViewProps) {
  const { node } = props
  const store = useStore()
  const categoryConfig = useCategoryConfig()
  const { raw, semanticType, category, refName: name, condition } = node.attrs as {
    raw: string
    semanticType: SemanticType
    category: string
    refName: string
    condition: string | null
  }

  const cfg = categoryConfig[category]

  // Template variable: {{$varName}}
  if (raw.trim().startsWith('$')) {
    return createElement(
      NodeViewWrapper,
      { as: 'span', style: { display: 'inline' } },
      createElement('span', {
        className: 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[12px] font-medium border border-dashed border-violet-400/50 bg-violet-500/10 text-violet-600 dark:text-violet-400 align-middle mx-0.5 cursor-help',
        title: raw.trim(),
      }, `ƒ ${raw.trim().slice(1)}`)
    )
  }

  // Unknown category — render as red inline code
  if (!cfg) {
    return createElement(
      NodeViewWrapper,
      { as: 'span', style: { display: 'inline' } },
      createElement('span', {
        style: { fontFamily: 'monospace', fontSize: '12px', color: '#B3261E' }, // MD3 error
      }, `{{${raw}}}`)
    )
  }

  const Icon = cfg.icon

  const handleClick = () => {
    // Data flow refs navigate to the source node
    if (semanticType === 'data_flow') {
      store.select({
        type: 'node',
        key: name,
        workflowId: store.activeWf,
      })
      return
    }

    if (category === 'nodes') {
      store.select({
        type: 'node',
        key: name,
        workflowId: store.activeWf,
      })
    } else if (category === 'workflows') {
      store.select({
        type: 'workflow',
        key: name,
      })
    } else if (category === 'output') {
      // Plain {{output}} or {{output.xxx}} — navigate to the node
      store.select({
        type: 'node',
        key: name,
        workflowId: store.activeWf,
      })
    } else {
      store.select({
        type: 'resource',
        category: category as 'instructions' | 'capabilities' | 'runbooks' | 'memory' | 'hooks',
        key: name,
      })
    }
  }

  // Build display content based on semantic type
  let prefix = ''
  let displayName = name
  let suffix = ''

  if (semanticType === 'edge') {
    prefix = '→ '
    if (condition) {
      suffix = ` | ${condition}`
    }
  } else if (semanticType === 'data_flow') {
    prefix = '⇠ '
    displayName = raw.startsWith('<<')
      ? raw.slice(2).trim()
      : `output.${name}`
  }

  // MD3 tonal chip styles from CATEGORY_CONFIG
  const chipStyle: Record<string, string | number> = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    transition: 'filter 150ms',
    cursor: 'pointer',
    verticalAlign: 'baseline',
    userSelect: 'none',
    background: cfg.containerColor,
    color: cfg.onColor,
    border: 'none',
  }

  return createElement(
    NodeViewWrapper,
    {
      as: 'span',
      style: { display: 'inline' },
      'data-type': 'ref-chip',
    },
    createElement(
      'button',
      {
        type: 'button',
        onClick: handleClick,
        style: chipStyle,
        contentEditable: false,
      },
      prefix ? createElement('span', { style: { opacity: 0.7 } }, prefix) : null,
      createElement(Icon, { style: { width: 12, height: 12, flexShrink: 0 } }),
      createElement('span', null, displayName),
      suffix ? createElement('span', { style: { opacity: 0.7 } }, suffix) : null,
    )
  )
}

// ── tiptap Node extension ────────────────────────────────────────────

export const RefChipNode = Node.create({
  name: 'refChip',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      raw: { default: '' },
      semanticType: { default: 'mention' as SemanticType },
      category: { default: '' },
      refName: { default: '' },
      condition: { default: null as string | null },
    }
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(`{{${node.attrs.raw}}}`)
        },
        parse: {
          setup(md: any) {
            // Guard: tiptap-markdown calls setup() on every parse(), so avoid
            // pushing duplicate inline rules. Use ruler.at() to replace if
            // the rule already exists, otherwise push a new one.
            const ruleFn = (state: any) => {
              const src = state.src.slice(state.pos)
              const match = src.match(/^\{\{(.+?)\}\}/)
              if (!match) return false

              const inner = match[1]
              const parsed = parseRefInner(inner)

              const token = state.push('ref_chip', '', 0)
              token.content = inner
              token.attrs = {
                raw: inner,
                semanticType: parsed.semanticType,
                category: parsed.category,
                refName: parsed.refName,
                condition: parsed.condition,
              }

              state.pos += match[0].length
              return true
            }

            if (md.inline.ruler.__find__('ref_chip') >= 0) {
              md.inline.ruler.at('ref_chip', ruleFn)
            } else {
              md.inline.ruler.push('ref_chip', ruleFn)
            }

            md.renderer.rules.ref_chip = (tokens: any[], idx: number) => {
              const token = tokens[idx]
              const attrs = token.attrs
              return `<span data-type="ref-chip" data-raw="${escapeAttr(attrs.raw)}" data-semantic-type="${attrs.semanticType}" data-category="${attrs.category}" data-ref-name="${attrs.refName}" data-condition="${attrs.condition || ''}">${escapeHtml(`{{${attrs.raw}}}`)}</span>`
            }
          },
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="ref-chip"]',
        getAttrs: (el) => {
          const dom = el as HTMLElement
          return {
            raw: dom.getAttribute('data-raw') || '',
            semanticType: dom.getAttribute('data-semantic-type') || 'mention',
            category: dom.getAttribute('data-category') || '',
            refName: dom.getAttribute('data-ref-name') || '',
            condition: dom.getAttribute('data-condition') || null,
          }
        },
      },
    ]
  },

  renderHTML({ node }) {
    return [
      'span',
      {
        'data-type': 'ref-chip',
        'data-raw': node.attrs.raw,
        'data-semantic-type': node.attrs.semanticType,
        'data-category': node.attrs.category,
        'data-ref-name': node.attrs.refName,
        'data-condition': node.attrs.condition || '',
      },
      `{{${node.attrs.raw}}}`,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(RefChipComponent, {
      as: 'span',
      className: 'ref-chip-wrapper',
    })
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: REF_INPUT_REGEX,
        type: this.type,
        getAttributes: (match) => {
          const inner = match[1]
          if (!inner) return false
          const parsed = parseRefInner(inner)
          return {
            raw: inner,
            semanticType: parsed.semanticType,
            category: parsed.category,
            refName: parsed.refName,
            condition: parsed.condition,
          }
        },
      }),
    ]
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: REF_PATTERN,
        type: this.type,
        getAttributes: (match) => {
          const inner = match[1]
          if (!inner) return false
          const parsed = parseRefInner(inner)
          return {
            raw: inner,
            semanticType: parsed.semanticType,
            category: parsed.category,
            refName: parsed.refName,
            condition: parsed.condition,
          }
        },
      }),
    ]
  },
})

export { parseRefInner }
export default RefChipNode