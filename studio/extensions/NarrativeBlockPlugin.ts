import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

function paragraphContainsRefChip(node: PMNode): boolean {
  let found = false
  node.forEach(c => { if (c.type.name === 'refChip') found = true })
  return found
}

function buildDecorations(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = []
  doc.forEach((node, offset) => {
    if (node.type.name === 'paragraph' && paragraphContainsRefChip(node)) {
      decorations.push(Decoration.node(offset, offset + node.nodeSize, { class: 'narrative-block' }))
    }
  })
  return DecorationSet.create(doc, decorations)
}

const pluginKey = new PluginKey('narrativeBlockHighlight')

export const NarrativeBlockPlugin = Extension.create({
  name: 'narrativeBlockDecoration',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        state: {
          init(_, { doc }) { return buildDecorations(doc) },
          apply(tr, old, _oldState, newState) {
            return tr.docChanged ? buildDecorations(newState.doc) : old
          },
        },
        props: {
          decorations(state) { return this.getState(state) as DecorationSet },
        },
      }),
    ]
  },
})

export { buildDecorations, paragraphContainsRefChip }
export default NarrativeBlockPlugin
