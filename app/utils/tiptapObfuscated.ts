import { Mark, mergeAttributes } from '@tiptap/vue-3'

declare module '@tiptap/vue-3' {
  interface Commands<ReturnType> {
    obfuscated: {
      toggleObfuscated: () => ReturnType
    }
  }
}

export const Obfuscated = Mark.create({
  name: 'obfuscated',

  parseHTML() {
    return [{ tag: 'span[data-obfuscated]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-obfuscated': '', 'class': 'mc-obf' }), 0]
  },

  addCommands() {
    return {
      toggleObfuscated: () => ({ commands }) => commands.toggleMark(this.name)
    }
  }
})
