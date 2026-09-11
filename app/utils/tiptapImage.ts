import { Node, mergeAttributes } from '@tiptap/vue-3'

/**
 * A picture in a post.
 *
 * Written here rather than pulled from @tiptap/extension-image because the only
 * thing we need from it is a node with a src and an alt, and the project already
 * writes its own extensions this way — see tiptapObfuscated.
 *
 * The node stores the address the upload returned; the server decides what HTML
 * it becomes, so nothing here is a security boundary. See shared/utils/post-doc.
 */
declare module '@tiptap/vue-3' {
  interface Commands<ReturnType> {
    postImage: {
      setPostImage: (attrs: { src: string, alt?: string }) => ReturnType
    }
  }
}

export const PostImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'img[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)]
  },

  addCommands() {
    return {
      setPostImage: attrs => ({ commands }) =>
        commands.insertContent({ type: this.name, attrs }),
    }
  },
})
