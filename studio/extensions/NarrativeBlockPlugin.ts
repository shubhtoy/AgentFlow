import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/**
 * Checks whether a ProseMirror node (paragraph-level) contains at least one
 * refChip child node.
 */
function paragraphContainsRefChip(node: import('@tiptap/pm/model').Node): boolean {
  let found = false
  node.forEach((child) => {
    if (child.type.name === 'refChip') {
      found = true
    }
  })
  return found
}

/**
 * Build a DecorationSet that applies a CSS class to every paragraph
 * containing one or more refChip inline nodes. Adjacent ref-containing
 * paragraphs are grouped into a single visual block.
 *
 * Adds move-up / move-down buttons and a drag handle via widget decorations.
 */
function buildDecorations(doc: import('@tiptap/pm/model').Node): DecorationSet {
  const decorations: Decoration[] = []

  const refParagraphs: { from: number; to: number }[] = []

  doc.forEach((node, offset) => {
    if (node.type.name === 'paragraph' && paragraphContainsRefChip(node)) {
      refParagraphs.push({ from: offset, to: offset + node.nodeSize })
    }
  })

  // Group adjacent paragraphs
  const groups: { from: number; to: number }[] = []
  for (const para of refParagraphs) {
    const last = groups[groups.length - 1]
    if (last && last.to === para.from) {
      last.to = para.to
    } else {
      groups.push({ from: para.from, to: para.to })
    }
  }

  for (const group of groups) {
    doc.nodesBetween(group.from, group.to, (node, pos) => {
      if (node.type.name === 'paragraph' && paragraphContainsRefChip(node)) {
        // Visual styling
        decorations.push(
          Decoration.node(pos, pos + node.nodeSize, {
            class: 'narrative-block',
          }),
        )

        // Controls widget — drag handle + move buttons
        decorations.push(
          Decoration.widget(pos + 1, () => {
            const wrapper = document.createElement('span')
            wrapper.className = 'narrative-move-buttons'
            wrapper.contentEditable = 'false'

            // Drag handle
            const dragHandle = document.createElement('span')
            dragHandle.className = 'narrative-drag-handle'
            dragHandle.innerHTML = '⠿'
            dragHandle.title = 'Drag to reorder'
            dragHandle.draggable = true
            dragHandle.dataset.narrativeDrag = 'true'
            dragHandle.dataset.pos = String(pos)

            const btnUp = document.createElement('button')
            btnUp.type = 'button'
            btnUp.className = 'narrative-move-btn'
            btnUp.innerHTML = '&#8593;'
            btnUp.title = 'Move up'
            btnUp.dataset.narrativeMove = 'up'
            btnUp.dataset.pos = String(pos)

            const btnDown = document.createElement('button')
            btnDown.type = 'button'
            btnDown.className = 'narrative-move-btn'
            btnDown.innerHTML = '&#8595;'
            btnDown.title = 'Move down'
            btnDown.dataset.narrativeMove = 'down'
            btnDown.dataset.pos = String(pos)

            wrapper.appendChild(dragHandle)
            wrapper.appendChild(btnUp)
            wrapper.appendChild(btnDown)
            return wrapper
          }, { side: -1 }),
        )
      }
      return node.isBlock
    })
  }

  return DecorationSet.create(doc, decorations)
}

const narrativeBlockPluginKey = new PluginKey('narrativeBlockDecoration')

/**
 * NarrativeBlockPlugin — a tiptap Extension that visually groups paragraphs
 * containing ref chips with a subtle background, left border, and padding.
 * Adds drag handle + move-up / move-down buttons for reordering narrative statements.
 */
export const NarrativeBlockPlugin = Extension.create({
  name: 'narrativeBlockDecoration',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: narrativeBlockPluginKey,
        state: {
          init(_, { doc }) {
            return buildDecorations(doc)
          },
          apply(tr, oldDecorations, _oldState, newState) {
            if (!tr.docChanged) return oldDecorations
            return buildDecorations(newState.doc)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state) as DecorationSet
          },
          handleDOMEvents: {
            mousedown(view, event) {
              const target = event.target as HTMLElement
              if (!target.dataset?.narrativeMove) return false

              event.preventDefault()
              event.stopPropagation()

              const direction = target.dataset.narrativeMove as 'up' | 'down'
              const pos = parseInt(target.dataset.pos || '0', 10)
              const { doc, tr } = view.state
              const node = doc.nodeAt(pos)
              if (!node) return true

              if (direction === 'up') {
                if (pos === 0) return true
                const $pos = doc.resolve(pos)
                const indexInParent = $pos.index($pos.depth)
                if (indexInParent === 0) return true
                const prevNode = $pos.parent.child(indexInParent - 1)
                const prevPos = pos - prevNode.nodeSize
                const currentSlice = node.copy(node.content)
                const newTr = tr
                  .delete(pos, pos + node.nodeSize)
                  .insert(prevPos, currentSlice)
                view.dispatch(newTr)
              } else {
                const nextPos = pos + node.nodeSize
                const nextNode = doc.nodeAt(nextPos)
                if (!nextNode) return true
                const currentSlice = node.copy(node.content)
                const newTr = tr
                  .delete(pos, pos + node.nodeSize)
                  .insert(pos + nextNode.nodeSize, currentSlice)
                view.dispatch(newTr)
              }

              return true
            },

            // ── Drag-and-drop for narrative blocks ──
            dragstart(view, event) {
              const target = event.target as HTMLElement
              if (!target.dataset?.narrativeDrag) return false

              const pos = parseInt(target.dataset.pos || '0', 10)
              const node = view.state.doc.nodeAt(pos)
              if (!node) return false

              // Store the source position in the drag data
              event.dataTransfer?.setData('application/narrative-block-pos', String(pos))
              event.dataTransfer!.effectAllowed = 'move'

              // Create a ghost element for the drag image
              const ghost = document.createElement('div')
              ghost.textContent = node.textContent.slice(0, 60) + (node.textContent.length > 60 ? '…' : '')
              ghost.style.cssText = 'position:fixed;top:-999px;padding:6px 12px;background:#f5f5f5;border-radius:6px;font-size:13px;max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:1px solid #ddd;'
              document.body.appendChild(ghost)
              event.dataTransfer?.setDragImage(ghost, 0, 0)
              requestAnimationFrame(() => ghost.remove())

              return false // let the browser handle the drag visual
            },

            dragover(view, event) {
              if (!event.dataTransfer?.types.includes('application/narrative-block-pos')) return false
              event.preventDefault()
              event.dataTransfer!.dropEffect = 'move'

              // Highlight drop target
              const coords = { left: event.clientX, top: event.clientY }
              const posAtCoords = view.posAtCoords(coords)
              if (posAtCoords) {
                const $pos = view.state.doc.resolve(posAtCoords.pos)
                // Find the nearest top-level block
                const depth = $pos.depth
                if (depth > 0) {
                  const blockStart = $pos.before(1)
                  const blockNode = view.state.doc.nodeAt(blockStart)
                  if (blockNode) {
                    // Add a visual indicator via a CSS class on the DOM node
                    const domNode = view.nodeDOM(blockStart) as HTMLElement | null
                    // Clear previous indicators
                    view.dom.querySelectorAll('.narrative-drop-target').forEach(el =>
                      el.classList.remove('narrative-drop-target'),
                    )
                    if (domNode && domNode instanceof HTMLElement) {
                      domNode.classList.add('narrative-drop-target')
                    }
                  }
                }
              }

              return true
            },

            dragleave(view, _event) {
              view.dom.querySelectorAll('.narrative-drop-target').forEach(el =>
                el.classList.remove('narrative-drop-target'),
              )
              return false
            },

            drop(view, event) {
              // Clean up drop indicators
              view.dom.querySelectorAll('.narrative-drop-target').forEach(el =>
                el.classList.remove('narrative-drop-target'),
              )

              const rawPos = event.dataTransfer?.getData('application/narrative-block-pos')
              if (!rawPos) return false

              event.preventDefault()
              event.stopPropagation()

              const sourcePos = parseInt(rawPos, 10)
              const sourceNode = view.state.doc.nodeAt(sourcePos)
              if (!sourceNode) return false

              // Find the drop target position
              const coords = { left: event.clientX, top: event.clientY }
              const posAtCoords = view.posAtCoords(coords)
              if (!posAtCoords) return true

              const $drop = view.state.doc.resolve(posAtCoords.pos)
              // Get the top-level block position at the drop point
              let targetPos = $drop.depth > 0 ? $drop.before(1) : posAtCoords.pos

              // Don't drop on self
              if (targetPos === sourcePos) return true

              const { tr } = view.state
              const nodeCopy = sourceNode.copy(sourceNode.content)

              if (targetPos > sourcePos) {
                // Dropping below: delete source first, then insert
                // After deletion, positions shift by -sourceNode.nodeSize
                tr.delete(sourcePos, sourcePos + sourceNode.nodeSize)
                const adjustedTarget = targetPos - sourceNode.nodeSize
                const targetNode = tr.doc.nodeAt(adjustedTarget)
                const insertPos = targetNode
                  ? adjustedTarget + targetNode.nodeSize
                  : adjustedTarget
                tr.insert(insertPos, nodeCopy)
              } else {
                // Dropping above: insert first, then delete
                tr.insert(targetPos, nodeCopy)
                // Source position shifted by +nodeCopy.nodeSize
                const adjustedSource = sourcePos + nodeCopy.nodeSize
                tr.delete(adjustedSource, adjustedSource + sourceNode.nodeSize)
              }

              view.dispatch(tr)
              return true
            },
          },
        },
      }),
    ]
  },
})

export { buildDecorations, paragraphContainsRefChip }
export default NarrativeBlockPlugin
