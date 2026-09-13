import { Node, mergeAttributes } from '@tiptap/vue-3'

/**
 * A boxed aside — the "heads up" a release note always needs.
 *
 * Written here rather than pulled in, for the same reason as PostImage: it is a
 * block with one attribute, and the project already writes its own extensions
 * this way.
 *
 * The tone is a word, not a colour: the server maps it to a class from a fixed
 * list, so nothing an author types can reach the page's styling.
 *
 * To add a tone: one entry in CALLOUT_TONES and one rule in main.css.
 */
export const CALLOUT_TONES = ['info', 'warn', 'success'] as const
export type CalloutTone = typeof CALLOUT_TONES[number]

declare module '@tiptap/vue-3' {
  interface Commands<ReturnType> {
    callout: {
      toggleCallout: (tone?: CalloutTone) => ReturnType
    }
  }
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      tone: {
        default: 'info',
        parseHTML: element => element.getAttribute('data-tone') ?? 'info',
        renderHTML: attrs => ({ 'data-tone': String(attrs.tone ?? 'info') }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '', 'class': 'callout' }), 0]
  },

  addCommands() {
    return {
      toggleCallout: (tone = 'info') => ({ commands, editor }) =>
        (editor.isActive(this.name)
          ? commands.lift(this.name)
          : commands.wrapIn(this.name, { tone })),
    }
  },
})
