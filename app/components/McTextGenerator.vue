<script setup lang="ts">
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, Color } from '@tiptap/extension-text-style'

const { t } = useI18n()
const toast = useToast()

const editor = shallowRef<Editor>()
const doc = ref()

onMounted(() => {
  editor.value = new Editor({
    extensions: [StarterKit, TextStyle, Color, Obfuscated],
    content: `<p><span style="color: #FFAA00"><strong>Spectra</strong></span> <span style="color: #AAAAAA">— </span><span style="color: #55FF55">play</span> <span style="color: #55FFFF">together</span></p>`,
    editorProps: {
      attributes: {
        class: 'mc-editor min-h-32 px-5 py-4 focus:outline-none'
      }
    },
    onUpdate: ({ editor }) => { doc.value = editor.getJSON() }
  })
  doc.value = editor.value.getJSON()
})

onBeforeUnmount(() => editor.value?.destroy())

const lines = computed(() => docToRuns(doc.value))
const outSection = computed(() => runsToCodes(lines.value, '§'))
const outAmp = computed(() => runsToCodes(lines.value, '&'))

const activeColor = computed(() => editor.value?.getAttributes('textStyle').color)

const setColor = (hex: string) => editor.value?.chain().focus().setColor(hex).run()

const toggle = (key: McFormat['key']) => {
  const c = editor.value?.chain().focus()
  if (!c) return
  if (key === 'reset') c.unsetAllMarks().unsetColor().run()
  else if (key === 'obfuscated') c.toggleObfuscated().run()
  else if (key === 'strike') c.toggleStrike().run()
  else if (key === 'bold') c.toggleBold().run()
  else if (key === 'italic') c.toggleItalic().run()
  else if (key === 'underline') c.toggleUnderline().run()
}

const isActive = (key: McFormat['key']) =>
  key !== 'reset' && (editor.value?.isActive(key) ?? false)

const copy = async (value: string, label: string) => {
  await navigator.clipboard.writeText(value)
  toast.add({ title: t('colorCodes.copied', { value: label }), icon: 'i-lucide-check', color: 'success' })
}

const runStyle = (run: McRun) => ({
  color: run.color?.hex || '#FFFFFF',
  textShadow: `2px 2px 0 ${run.color?.shadow || '#3F3F3F'}`,
  fontWeight: run.bold ? '700' : '400',
  fontStyle: run.italic ? 'italic' : 'normal',
  textDecoration: [run.underline && 'underline', run.strike && 'line-through']
    .filter(Boolean).join(' ') || 'none'
})

const OBF_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const scramble = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  timer = setInterval(() => { scramble.value++ }, 70)
})
onBeforeUnmount(() => clearInterval(timer))

const renderText = (run: McRun) => {
  if (!run.obfuscated) return run.text
  void scramble.value
  return Array.from(run.text)
    .map(ch => (ch === ' ' ? ' ' : OBF_CHARS[Math.floor(Math.random() * OBF_CHARS.length)]))
    .join('')
}
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <div class="rounded-3xl border border-zinc-600/50 bg-black/30 backdrop-blur-sm">
      <div class="flex flex-wrap items-center gap-1.5 border-b border-zinc-600/50 p-3">
        <button
          v-for="c in MC_COLORS"
          :key="c.code"
          type="button"
          class="size-7 cursor-pointer rounded-md border transition-transform hover:scale-110"
          :class="activeColor?.toLowerCase() === c.hex.toLowerCase() ? 'border-white' : 'border-white/15'"
          :style="{ background: c.hex }"
          :title="`${c.name} · §${c.code}`"
          :aria-label="c.name"
          @click="setColor(c.hex)"
        />

        <div class="mx-1 h-6 w-px bg-zinc-600/50" />

        <UButton
          v-for="f in MC_FORMATS"
          :key="f.code"
          :icon="f.icon"
          size="sm"
          :variant="isActive(f.key) ? 'subtle' : 'ghost'"
          color="neutral"
          :title="`${t('colorCodes.fmt.' + f.key)} · §${f.code}`"
          :aria-label="t('colorCodes.fmt.' + f.key)"
          @click="toggle(f.key)"
        />
      </div>

      <EditorContent v-if="editor" :editor="editor" />
      <div v-else class="min-h-32 px-5 py-4 text-dimmed">…</div>
    </div>

    <div class="flex flex-col gap-4">
      <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm">
        <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">
          {{ t('colorCodes.previewLabel') }}
        </div>
        <div class="mc-preview rounded-2xl bg-[#101010] p-4">
          <p v-for="(runs, i) in lines" :key="i" class="min-h-[1.6em] leading-relaxed">
            <span v-for="(run, j) in runs" :key="j" :style="runStyle(run)">{{ renderText(run) }}</span>
          </p>
        </div>
      </div>

      <div
        v-for="out in [
          { label: t('colorCodes.outVanilla'), hint: '§', value: outSection },
          { label: t('colorCodes.outPlugins'), hint: '&', value: outAmp }
        ]"
        :key="out.hint"
        class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm"
      >
        <div class="mb-3 flex items-center justify-between gap-4">
          <div class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ out.label }}</div>
          <UButton
            icon="i-lucide-copy"
            size="xs"
            variant="ghost"
            color="neutral"
            :label="t('colorCodes.copy')"
            @click="copy(out.value, out.hint)"
          />
        </div>
        <pre class="overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-black/40 p-3 font-mono text-sm text-muted">{{ out.value || '—' }}</pre>
      </div>
    </div>
  </div>
</template>

<style>
.mc-editor p {
    min-height: 1.6em;
    line-height: 1.7;
}

.mc-editor strong {
    font-weight: 700;
}

.mc-editor .mc-obf {
    background: color-mix(in oklab, currentColor 22%, transparent);
    border-radius: 3px;
}
</style>
