<script setup lang="ts">
// A plain textarea with the buttons people expect, rather than a rich editor.
// The stored value stays markdown, which is what the renderer, the excerpt and
// the search index all already read.
const props = defineProps<{
  /** Where an uploaded image is posted. Without it the image button is hidden. */
  uploadTo?: string
  rows?: number
  placeholder?: string
}>()

const value = defineModel<string>({ required: true })

const { t } = useI18n()

const area = useTemplateRef<HTMLTextAreaElement>('area')
const preview = ref(false)
const busy = ref(false)
const problem = ref('')

// Wraps the selection, or drops the markers in and puts the caret between them
// when nothing is selected.
function wrap(before: string, after = before) {
  const el = area.value
  if (!el) return

  const start = el.selectionStart
  const end = el.selectionEnd
  const selected = value.value.slice(start, end)

  value.value = value.value.slice(0, start) + before + selected + after + value.value.slice(end)

  nextTick(() => {
    el.focus()
    el.setSelectionRange(start + before.length, start + before.length + selected.length)
  })
}

// Line markers go on every selected line, so the list button makes a list
// rather than one long item.
function prefix(marker: string) {
  const el = area.value
  if (!el) return

  const from = value.value.lastIndexOf('\n', el.selectionStart - 1) + 1
  const to = value.value.indexOf('\n', el.selectionEnd)
  const stop = to === -1 ? value.value.length : to

  const block = value.value.slice(from, stop)
    .split('\n')
    .map(line => (line.startsWith(marker) ? line.slice(marker.length) : marker + line))
    .join('\n')

  value.value = value.value.slice(0, from) + block + value.value.slice(stop)
  nextTick(() => el.focus())
}

function insert(text: string) {
  const el = area.value
  if (!el) {
    value.value += text
    return
  }

  const start = el.selectionStart
  value.value = value.value.slice(0, start) + text + value.value.slice(start)

  nextTick(() => {
    el.focus()
    el.setSelectionRange(start + text.length, start + text.length)
  })
}

async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !props.uploadTo) return

  busy.value = true
  problem.value = ''
  try {
    const res = await $fetch<{ url: string }>(props.uploadTo, {
      method: 'POST',
      body: await file.arrayBuffer(),
      headers: { 'content-type': file.type },
    })
    insert(`\n![${file.name.replace(/\.[^.]+$/, '')}](${res.url})\n`)
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally {
    busy.value = false
    input.value = ''
  }
}

const videoUrl = ref('')
const askingVideo = ref(false)

function addVideo() {
  const id = youtubeId(videoUrl.value)
  if (!id) {
    problem.value = t('editor.notYoutube')
    return
  }

  // On a line of its own, because that is what the renderer turns into a player.
  insert(`\n\nhttps://www.youtube.com/watch?v=${id}\n\n`)
  videoUrl.value = ''
  askingVideo.value = false
  problem.value = ''
}

// To add a button: one entry here and one `editor.<id>` string per locale.
const TOOLS = [
  { id: 'bold', icon: 'i-pixelarticons-letter-b', run: () => wrap('**') },
  { id: 'italic', icon: 'i-pixelarticons-letter-i', run: () => wrap('*') },
  { id: 'strike', icon: 'i-pixelarticons-letter-s', run: () => wrap('~~') },
  { id: 'heading', icon: 'i-pixelarticons-heading', run: () => prefix('## ') },
  { id: 'quote', icon: 'i-pixelarticons-comment', run: () => prefix('> ') },
  { id: 'list', icon: 'i-pixelarticons-list', run: () => prefix('- ') },
  { id: 'code', icon: 'i-pixelarticons-code', run: () => wrap('`') },
  { id: 'link', icon: 'i-pixelarticons-link', run: () => wrap('[', '](https://)') },
]
</script>

<template>
  <div>
    <div class="mb-2 flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1.5">
      <UButton
        v-for="tool in TOOLS"
        :key="tool.id"
        size="xs"
        variant="ghost"
        color="neutral"
        class="rounded-lg"
        :icon="tool.icon"
        :aria-label="t(`editor.${tool.id}`)"
        :title="t(`editor.${tool.id}`)"
        :disabled="preview"
        @click="tool.run"
      />

      <span class="mx-1 h-5 w-px bg-white/10"></span>

      <label
        v-if="props.uploadTo"
        class="inline-flex cursor-pointer items-center rounded-lg px-2 py-1.5 text-muted transition-colors hover:bg-white/10 hover:text-default"
        :title="t('editor.image')"
      >
        <UIcon
          :name="busy ? 'i-pixelarticons-loader' : 'i-pixelarticons-image-plus'"
          class="size-4"
        />
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          class="hidden"
          @change="upload"
        >
      </label>

      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        class="rounded-lg"
        icon="i-pixelarticons-video"
        :aria-label="t('editor.video')"
        :title="t('editor.video')"
        @click="askingVideo = !askingVideo"
      />

      <span class="flex-1"></span>

      <UButton
        size="xs"
        :variant="preview ? 'subtle' : 'ghost'"
        color="neutral"
        class="rounded-lg"
        :icon="preview ? 'i-pixelarticons-edit' : 'i-pixelarticons-eye'"
        :label="preview ? t('catalog.write') : t('catalog.preview')"
        @click="preview = !preview"
      />
    </div>

    <div v-if="askingVideo" class="mb-2 flex flex-wrap gap-2">
      <UInput
        v-model="videoUrl"
        class="min-w-48 flex-1"
        placeholder="https://youtu.be/…"
        @keyup.enter="addVideo"
      />
      <UButton class="rounded-xl" :label="t('editor.insert')" @click="addVideo" />
    </div>

    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      class="mb-2 rounded-xl"
      :description="problem"
    />

    <!-- eslint-disable-next-line vue/no-v-html -- markdown-it runs with html:false -->
    <div
      v-if="preview"
      class="prose prose-invert max-w-none overflow-auto rounded-xl border border-white/10 p-4"
      :style="{ minHeight: `${(props.rows ?? 20) * 1.5}rem` }"
      v-html="renderMarkdown(value)"
    />
    <textarea
      v-else
      ref="area"
      v-model="value"
      :rows="props.rows ?? 20"
      :placeholder="props.placeholder"
      spellcheck="false"
      class="w-full rounded-xl bg-black/30 px-4 py-3 font-mono text-sm text-highlighted outline-none ring ring-inset ring-zinc-600/50 transition-colors placeholder:text-dimmed focus:ring-zinc-400"
    ></textarea>
  </div>
</template>
