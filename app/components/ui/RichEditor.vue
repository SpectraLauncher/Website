<script setup lang="ts">
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'

const props = defineProps<{
  /** Where a picked file is sent. The endpoint answers with { url }. */
  uploadTo: string
  rows?: number
}>()

// The editor's own JSON, not HTML: the server renders it, so nothing a browser
// composes is ever stored or echoed back. See shared/utils/post-doc.
const doc = defineModel<Record<string, any>>({ default: () => ({ type: 'doc', content: [] }) })

const { t } = useI18n()
const toast = useToast()

const editor = shallowRef<Editor>()
const file = useTemplateRef<HTMLInputElement>('file')
const busy = ref(false)
const dropping = ref(false)

onMounted(() => {
  editor.value = new Editor({
    extensions: [StarterKit, PostImage, Callout],
    content: doc.value,
    editorProps: {
      attributes: {
        class: `prose prose-invert max-w-none px-4 py-3 focus:outline-none min-h-[${(props.rows ?? 12) * 1.6}rem]`,
      },
    },
    onUpdate: ({ editor }) => { doc.value = editor.getJSON() },
  })
})

onBeforeUnmount(() => editor.value?.destroy())

// A picture is uploaded the moment it is picked, so the document only ever
// holds an address the store already has — a body referring to a file that was
// never sent would render a broken image on the published page.
async function upload(chosen: File | null | undefined) {
  if (!chosen || busy.value) return

  busy.value = true

  try {
    const { url } = await $fetch<{ url: string }>(props.uploadTo, {
      method: 'POST',
      body: chosen,
      headers: { 'content-type': chosen.type },
    })

    editor.value?.chain().focus().setPostImage({ src: url, alt: '' }).run()
  }
  catch (e: any) {
    toast.add({
      title: e?.data?.statusMessage || t('auth.genericError'),
      color: 'error',
      icon: 'i-pixelarticons-warning-box',
    })
  }
  finally {
    busy.value = false
    if (file.value) file.value.value = ''
  }
}

function drop(event: DragEvent) {
  dropping.value = false
  upload(event.dataTransfer?.files?.[0])
}

// pixelarticons draws no B, I or S, and a letter in its own weight is what
// every editor uses for those anyway. The rest keep icons.
//
// To add a button: one entry in the group it belongs to, plus an `editor.<id>`
// string in both locales.
const chain = () => editor.value!.chain().focus()

const BLOCKS = [
  { id: 'heading2', icon: 'i-pixelarticons-heading-2', active: () => editor.value?.isActive('heading', { level: 2 }), run: () => chain().toggleHeading({ level: 2 }).run() },
  { id: 'heading3', icon: 'i-pixelarticons-heading-3', active: () => editor.value?.isActive('heading', { level: 3 }), run: () => chain().toggleHeading({ level: 3 }).run() },
  { id: 'bulletList', icon: 'i-pixelarticons-list', run: () => chain().toggleBulletList().run() },
  { id: 'orderedList', icon: 'i-pixelarticons-bulletlist', run: () => chain().toggleOrderedList().run() },
  { id: 'blockquote', icon: 'i-pixelarticons-quote-text-inline', run: () => chain().toggleBlockquote().run() },
  { id: 'codeBlock', icon: 'i-pixelarticons-code', run: () => chain().toggleCodeBlock().run() },
]

const MARKS = [
  { id: 'bold', letter: 'B', class: 'font-extrabold', run: () => chain().toggleBold().run() },
  { id: 'italic', letter: 'I', class: 'font-serif italic', run: () => chain().toggleItalic().run() },
  { id: 'strike', letter: 'S', class: 'line-through', run: () => chain().toggleStrike().run() },
  { id: 'code', icon: 'i-pixelarticons-terminal', run: () => chain().toggleCode().run() },
]

const TONES = [
  { id: 'info', icon: 'i-pixelarticons-info-box' },
  { id: 'warn', icon: 'i-pixelarticons-alert' },
  { id: 'success', icon: 'i-pixelarticons-check' },
] as const

const insertCallout = (tone: 'info' | 'warn' | 'success') => chain().toggleCallout(tone).run()

// The address is asked for rather than typed into the document, so a link is one
// step and an author cannot leave half of one behind.
function setLink() {
  const previous = editor.value?.getAttributes('link').href ?? ''
  const href = window.prompt(t('editor.linkPrompt'), previous)
  if (href === null) return

  if (!href.trim()) {
    chain().extendMarkRange('link').unsetLink().run()
    return
  }

  chain().extendMarkRange('link').setLink({ href: href.trim() }).run()
}

const active = (id: string) => Boolean(editor.value?.isActive(id))
</script>

<template>
  <div
    class="overflow-hidden rounded-xl border transition-colors"
    :class="dropping ? 'border-primary bg-primary/5' : 'border-raised-line bg-raised'"
    @dragover.prevent="dropping = true"
    @dragleave.prevent="dropping = false"
    @drop.prevent="drop"
  >
    <div class="flex flex-wrap items-center gap-0.5 border-b border-raised-line p-1.5">
      <UButton
        v-for="mark in MARKS"
        :key="mark.id"
        size="xs"
        color="neutral"
        :variant="active(mark.id) ? 'subtle' : 'ghost'"
        :icon="mark.icon"
        :aria-label="t(`editor.${mark.id}`)"
        :title="t(`editor.${mark.id}`)"
        @click="mark.run()"
      >
        <span v-if="mark.letter" class="w-4 text-sm" :class="mark.class">{{ mark.letter }}</span>
      </UButton>

      <UButton
        size="xs"
        color="neutral"
        :variant="active('link') ? 'subtle' : 'ghost'"
        icon="i-pixelarticons-link"
        :aria-label="t('editor.link')"
        :title="t('editor.link')"
        @click="setLink"
      />

      <span class="mx-1 h-5 w-px bg-raised-line"></span>

      <UButton
        v-for="block in BLOCKS"
        :key="block.id"
        size="xs"
        color="neutral"
        :variant="(block.active ? block.active() : active(block.id)) ? 'subtle' : 'ghost'"
        :icon="block.icon"
        :aria-label="t(`editor.${block.id}`)"
        :title="t(`editor.${block.id}`)"
        @click="block.run()"
      />

      <span class="mx-1 h-5 w-px bg-raised-line"></span>

      <UButton
        v-for="tone in TONES"
        :key="tone.id"
        size="xs"
        color="neutral"
        :variant="editor?.isActive('callout', { tone: tone.id }) ? 'subtle' : 'ghost'"
        :icon="tone.icon"
        :aria-label="t(`editor.callout.${tone.id}`)"
        :title="t(`editor.callout.${tone.id}`)"
        @click="insertCallout(tone.id)"
      />

      <span class="mx-1 h-5 w-px bg-raised-line"></span>

      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-pixelarticons-minus"
        :aria-label="t('editor.divider')"
        :title="t('editor.divider')"
        @click="chain().setHorizontalRule().run()"
      />

      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        :icon="busy ? 'i-pixelarticons-loader' : 'i-pixelarticons-image-plus'"
        :class="busy && 'animate-spin'"
        :disabled="busy"
        :aria-label="t('editor.image')"
        :title="t('editor.image')"
        @click="file?.click()"
      />

      <input
        ref="file"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        class="hidden"
        @change="upload(($event.target as HTMLInputElement).files?.[0])"
      >

      <span class="mx-1 h-5 w-px bg-raised-line"></span>

      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-pixelarticons-undo"
        :disabled="!editor?.can().undo()"
        :aria-label="t('editor.undo')"
        :title="t('editor.undo')"
        @click="chain().undo().run()"
      />
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-pixelarticons-redo"
        :disabled="!editor?.can().redo()"
        :aria-label="t('editor.redo')"
        :title="t('editor.redo')"
        @click="chain().redo().run()"
      />

      <span class="ml-auto pr-1.5 text-xs text-dimmed">{{ t('editor.dropHint') }}</span>
    </div>

    <EditorContent :editor="editor" />
  </div>
</template>
