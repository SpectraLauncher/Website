<script setup lang="ts">
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, Color } from '@tiptap/extension-text-style'

const { t } = useI18n()
const toast = useToast()

const editor = shallowRef<Editor>()
const doc = ref()
const mode = ref<'visual' | 'code'>('visual')
const code = ref('')

onMounted(() => {
  editor.value = new Editor({
    extensions: [StarterKit, TextStyle, Color, Obfuscated],
    content: `<p><span style="color: #FFAA00"><strong>Spectra Network</strong></span></p><p><span style="color: #AAAAAA">open beta · </span><span style="color: #55FF55">join us</span></p>`,
    editorProps: {
      attributes: { class: 'mc-editor min-h-24 px-5 py-4 focus:outline-none' }
    },
    onUpdate: ({ editor }) => { doc.value = editor.getJSON() }
  })
  doc.value = editor.value.getJSON()
})

onBeforeUnmount(() => editor.value?.destroy())

const lines = computed(() => docToRuns(doc.value).slice(0, MOTD_LINES))
const raw = computed(() => motdRaw(lines.value))
const properties = computed(() => 'motd=' + motdProperties(raw.value))

watch(mode, (m) => {
  if (m === 'code') {
    code.value = raw.value
    return
  }
  const parsed = parseMotd(code.value)
  const html = parsed.map(runs => '<p>' + (runs.map((r) => {
    let inner = r.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    if (r.obfuscated) inner = `<span data-obfuscated>${inner}</span>`
    if (r.strike) inner = `<s>${inner}</s>`
    if (r.underline) inner = `<u>${inner}</u>`
    if (r.italic) inner = `<em>${inner}</em>`
    if (r.bold) inner = `<strong>${inner}</strong>`
    return r.color ? `<span style="color: ${r.color.hex}">${inner}</span>` : inner
  }).join('') || '<br>') + '</p>').join('')
  editor.value?.commands.setContent(html)
  doc.value = editor.value?.getJSON()
})

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

const applySmallCaps = () => {
  const ed = editor.value
  if (!ed) return
  const { from, to } = ed.state.selection
  if (from === to) {
    toast.add({ title: t('motd.selectFirst'), icon: 'i-lucide-info', color: 'warning' })
    return
  }
  const text = ed.state.doc.textBetween(from, to, '\n')
  ed.chain().focus().insertContentAt({ from, to }, toSmallCaps(text)).run()
}

const runStyle = (run: McRun) => ({
  color: run.color?.hex || '#FFFFFF',
  textShadow: `2px 2px 0 ${run.color?.shadow || '#3F3F3F'}`,
  fontWeight: run.bold ? '700' : '400',
  fontStyle: run.italic ? 'italic' : 'normal',
  textDecoration: [run.underline && 'underline', run.strike && 'line-through']
    .filter(Boolean).join(' ') || 'none'
})

const OBF = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
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
    .map(ch => (ch === ' ' ? ' ' : OBF[Math.floor(Math.random() * OBF.length)]))
    .join('')
}

const copy = async (value: string, label: string) => {
  await navigator.clipboard.writeText(value)
  toast.add({ title: t('colorCodes.copied', { value: label }), icon: 'i-lucide-check', color: 'success' })
}
</script>

<template>
  <div class="flex flex-col gap-4">
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
          :disabled="mode === 'code'"
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
          :disabled="mode === 'code'"
          :title="`${t('colorCodes.fmt.' + f.key)} · §${f.code}`"
          :aria-label="t('colorCodes.fmt.' + f.key)"
          @click="toggle(f.key)"
        />

        <UButton
          icon="i-lucide-case-lower"
          size="sm"
          variant="ghost"
          color="neutral"
          :disabled="mode === 'code'"
          :title="t('motd.smallCaps')"
          :aria-label="t('motd.smallCaps')"
          @click="applySmallCaps"
        />

        <div class="ml-auto flex gap-1">
          <UButton
            v-for="m in (['visual', 'code'] as const)"
            :key="m"
            size="xs"
            :variant="mode === m ? 'subtle' : 'ghost'"
            color="neutral"
            :label="t(`motd.${m}`)"
            @click="mode = m"
          />
        </div>
      </div>

      <EditorContent v-if="editor" v-show="mode === 'visual'" :editor="editor" />

      <textarea
        v-show="mode === 'code'"
        v-model="code"
        rows="3"
        spellcheck="false"
        class="w-full resize-none bg-transparent px-5 py-4 font-mono text-sm outline-none"
        :placeholder="t('motd.codePh')"
      />
    </div>

    <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm">
      <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('colorCodes.previewLabel') }}</div>

      <div class="rounded-2xl bg-[#101010] p-3">
        <div class="flex gap-3">
          <img src="/grass.webp" alt="" width="64" height="64" class="size-16 shrink-0 [image-rendering:pixelated]">

          <div class="mc-preview min-w-0 flex-1">
            <div class="flex items-start justify-between gap-3">
              <span class="text-white" style="text-shadow: 2px 2px 0 #3F3F3F">Minecraft Server</span>
              <span class="shrink-0 text-[#AAAAAA]" style="text-shadow: 2px 2px 0 #2A2A2A">0/20</span>
            </div>

            <p v-for="(runs, i) in lines" :key="i" class="min-h-[1.4em] leading-snug">
              <span v-for="(run, j) in runs" :key="j" :style="runStyle(run)">{{ renderText(run) }}</span>
            </p>
          </div>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap gap-4 text-xs">
        <span
          v-for="(runs, i) in lines"
          :key="i"
          :class="isOverflowing(runs) ? 'text-error' : 'text-dimmed'"
        >
          {{ t('motd.lineLength', { n: i + 1, len: visibleLength(runs), max: MOTD_LINE_LENGTH }) }}
        </span>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <div
        v-for="out in [
          { key: 'raw', label: t('motd.outRaw'), hint: t('motd.outRawHint'), value: raw },
          { key: 'props', label: t('motd.outProps'), hint: t('motd.outPropsHint'), value: properties }
        ]"
        :key="out.key"
        class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm"
      >
        <div class="mb-1 flex items-center justify-between gap-4">
          <div class="text-sm font-medium">{{ out.label }}</div>
          <UButton
            icon="i-lucide-copy"
            size="xs"
            variant="ghost"
            color="neutral"
            :label="t('colorCodes.copy')"
            @click="copy(out.value, out.label)"
          />
        </div>
        <div class="mb-3 text-xs text-dimmed">{{ out.hint }}</div>
        <pre class="overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-black/40 p-3 font-mono text-xs text-muted">{{ out.value || '—' }}</pre>
      </div>
    </div>
  </div>
</template>

<style>
.mc-editor p {
    min-height: 1.4em;
    line-height: 1.6;
}

.mc-editor strong {
    font-weight: 700;
}

.mc-editor .mc-obf {
    background: color-mix(in oklab, currentColor 22%, transparent);
    border-radius: 3px;
}
</style>
