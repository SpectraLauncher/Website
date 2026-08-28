<script setup lang="ts">
import { LEGACY_COPIES, SKIN_SIZE, isLegacySkin, normaliseQuery, skinFileName, stripLegacyHat, type SkinModel, type SkinProfile } from '~/utils/skin'
import { PALETTES, brushCells, fill, mirrorMap, shadeChannel, skinRegions, type EditorTool } from '~/utils/skinEdit'

const localePath = useLocalePath()
const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'skin-editor')!

useToolSeo('skin-editor', 'skinEditor')

const source = shallowRef<HTMLCanvasElement | null>(null)
const version = ref(0)

const brush = ref<EditorTool>('pencil')
const colour = ref('#c79c7a')
const recent = ref<string[]>([])
const model = ref<SkinModel>('classic')
const size = ref(1)
const symmetry = ref(false)
const lighten = ref(false)

const showBase = ref(true)
const showOverlay = ref(true)
const grid3d = ref(true)
const grid2d = ref(true)

const query = ref('')
const loading = ref(false)
const fileInput = ref<HTMLInputElement>()

const history: ImageData[] = []
const future: ImageData[] = []
const canUndo = ref(false)
const canRedo = ref(false)
let strokeStarted = false

const context = () => source.value?.getContext('2d', { willReadFrequently: true }) ?? null

const regions = computed(() => skinRegions(model.value))
const mirror = computed(() => mirrorMap(model.value))

const SIZES = [1, 2, 3, 4]
const SIZED: EditorTool[] = ['pencil', 'eraser', 'shade', 'dither']

let buffer: ImageData | null = null
const touched = new Set<number>()

function snapshot() {
  const ctx = context()
  return ctx?.getImageData(0, 0, SKIN_SIZE, SKIN_SIZE) ?? null
}

function markHistory() {
  const shot = snapshot()
  if (!shot) return

  history.push(shot)
  if (history.length > 60) history.shift()
  future.length = 0

  canUndo.value = history.length > 0
  canRedo.value = false
}

function restore(from: ImageData[], to: ImageData[]) {
  const ctx = context()
  const shot = from.pop()
  if (!ctx || !shot) return

  const current = snapshot()
  if (current) to.push(current)

  ctx.putImageData(shot, 0, 0)
  version.value++

  canUndo.value = history.length > 0
  canRedo.value = future.length > 0
}

const undo = () => restore(history, future)
const redo = () => restore(future, history)

function remember(hex: string) {
  recent.value = [hex, ...recent.value.filter(c => c !== hex)].slice(0, 8)
}

function pick(hex: string) {
  colour.value = hex
  remember(hex)
}

function begin() {
  const ctx = context()
  if (!ctx) return

  strokeStarted = true
  touched.clear()

  if (brush.value === 'picker') return

  markHistory()
  buffer = ctx.getImageData(0, 0, SKIN_SIZE, SKIN_SIZE)
}

function stamp(x: number, y: number) {
  if (!buffer) return

  const index = y * SKIN_SIZE + x
  const i = index * 4
  const data = buffer.data

  if (brush.value === 'eraser') {
    data[i] = 0
    data[i + 1] = 0
    data[i + 2] = 0
    data[i + 3] = 0
    return
  }

  if (brush.value === 'shade') {
    if (touched.has(index) || data[i + 3]! < 8) return
    touched.add(index)

    const amount = lighten.value ? 0.16 : -0.16
    for (let c = 0; c < 3; c++) data[i + c] = shadeChannel(data[i + c]!, amount)
    return
  }

  if (brush.value === 'dither' && (x + y) % 2 !== 0) return

  const { r, g, b } = hexToRgb(colour.value)
  data[i] = r
  data[i + 1] = g
  data[i + 2] = b
  data[i + 3] = 255
}

function paint(x: number, y: number) {
  const ctx = context()
  if (!ctx) return

  if (brush.value === 'picker') {
    if (!strokeStarted) return
    strokeStarted = false

    const pixel = ctx.getImageData(x, y, 1, 1).data
    if (pixel[3]! < 8) return
    pick(rgbToHex(pixel[0]!, pixel[1]!, pixel[2]!))
    return
  }

  if (!buffer) return

  if (brush.value === 'fill') {
    if (!strokeStarted) return
    strokeStarted = false

    const { r, g, b } = hexToRgb(colour.value)
    const starts = [[x, y]] as Array<[number, number]>

    if (symmetry.value) {
      const twin = mirror.value[y * SKIN_SIZE + x]!
      if (twin >= 0) starts.push([twin % SKIN_SIZE, Math.floor(twin / SKIN_SIZE)])
    }

    let changed = false

    for (const [sx, sy] of starts) {
      for (const [px, py] of fill(buffer.data, regions.value, sx, sy, [r, g, b, 255])) {
        const i = (py * SKIN_SIZE + px) * 4
        buffer.data[i] = r
        buffer.data[i + 1] = g
        buffer.data[i + 2] = b
        buffer.data[i + 3] = 255
        changed = true
      }
    }

    if (!changed) return
    ctx.putImageData(buffer, 0, 0)
    version.value++
    return
  }

  for (const [cx, cy] of brushCells(x, y, size.value)) {
    stamp(cx, cy)

    if (!symmetry.value) continue
    const twin = mirror.value[cy * SKIN_SIZE + cx]!
    if (twin >= 0) stamp(twin % SKIN_SIZE, Math.floor(twin / SKIN_SIZE))
  }

  ctx.putImageData(buffer, 0, 0)
  version.value++
}

function end() {
  strokeStarted = false
  buffer = null
  touched.clear()
  if (brush.value === 'pencil' || brush.value === 'dither') remember(colour.value)
}

function blank() {
  const canvas = document.createElement('canvas')
  canvas.width = SKIN_SIZE
  canvas.height = SKIN_SIZE
  return canvas
}

function drawInto(image: HTMLImageElement) {
  const canvas = source.value ?? blank()
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  ctx.clearRect(0, 0, SKIN_SIZE, SKIN_SIZE)
  ctx.drawImage(image, 0, 0)

  if (isLegacySkin(image.width, image.height)) {
    for (const copy of LEGACY_COPIES) {
      const patch = document.createElement('canvas')
      patch.width = copy.from.w
      patch.height = copy.from.h

      const pctx = patch.getContext('2d')!
      pctx.translate(copy.from.w, 0)
      pctx.scale(-1, 1)
      pctx.drawImage(image, copy.from.x, copy.from.y, copy.from.w, copy.from.h, 0, 0, copy.from.w, copy.from.h)

      ctx.drawImage(patch, copy.to[0], copy.to[1])
    }

    const data = ctx.getImageData(0, 0, SKIN_SIZE, SKIN_SIZE)
    if (stripLegacyHat(data.data, SKIN_SIZE)) ctx.putImageData(data, 0, 0)
  }

  source.value = canvas
  version.value++
}

const loadUrl = (url: string) => new Promise<void>((resolve, reject) => {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.onload = () => { drawInto(image); resolve() }
  image.onerror = () => reject(new Error('load failed'))
  image.src = url
})

async function reset() {
  history.length = 0
  future.length = 0
  canUndo.value = false
  canRedo.value = false
  await loadUrl(`/skins/${model.value === 'slim' ? 'alex' : 'steve'}.png`)
}

async function importPlayer() {
  const typed = query.value.trim()
  if (!typed) return

  loading.value = true
  try {
    const profile = await $fetch<SkinProfile>('/api/mc-skin', { query: { q: normaliseQuery(typed) } })
    if (!profile.skin) throw new Error('no skin')

    markHistory()
    await loadUrl(profile.skin)
    model.value = profile.model
    toast.add({ title: profile.name, icon: 'i-lucide-check' })
  }
  catch {
    toast.add({ title: t('skinEditor.notFound', { q: typed }), color: 'error' })
  }
  finally {
    loading.value = false
  }
}

function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async () => {
    try {
      markHistory()
      await loadUrl(String(reader.result))
    }
    catch {
      toast.add({ title: t('skinEditor.badFile'), color: 'error' })
    }
  }
  reader.readAsDataURL(file)

  if (fileInput.value) fileInput.value.value = ''
}

function download() {
  source.value?.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = skinFileName(query.value.trim() || 'skin', model.value)
    link.click()
    URL.revokeObjectURL(url)
  })
}

const TOOLS_LIST: Array<{ id: EditorTool, icon: string }> = [
  { id: 'pencil', icon: 'i-lucide-pencil' },
  { id: 'fill', icon: 'i-lucide-paint-bucket' },
  { id: 'eraser', icon: 'i-lucide-eraser' },
  { id: 'shade', icon: 'i-lucide-sun-medium' },
  { id: 'dither', icon: 'i-lucide-grip' },
  { id: 'picker', icon: 'i-lucide-pipette' }
]

function shortcut(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement) return

  const key = event.key.toLowerCase()
  if ((event.ctrlKey || event.metaKey) && key === 'z') {
    event.preventDefault()
    event.shiftKey ? redo() : undo()
    return
  }

  if (key === 'm') { symmetry.value = !symmetry.value; return }

  const found = { p: 'pencil', f: 'fill', e: 'eraser', s: 'shade', d: 'dither', i: 'picker' }[key]
  if (found) brush.value = found as EditorTool
}

const list = (key: string) => {
  const value = tm(key)
  return Array.isArray(value) ? (value as unknown[]) : []
}

const features = computed(() => list('skinEditor.features').map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
})))

const faq = computed(() => list('skinEditor.faq').map((x, i) => ({
  value: String(i),
  label: rt((x as { q: string }).q),
  content: rt((x as { a: string }).a)
})))

onMounted(() => {
  source.value = blank()
  reset()
  window.addEventListener('keydown', shortcut)
})

onBeforeUnmount(() => window.removeEventListener('keydown', shortcut))
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>
      <div
        class="pointer-events-none absolute left-1/2 top-16 -z-10 size-[420px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        :style="`background: hsl(${tool.glow} 90% 55% / 0.4)`"
      ></div>

      <section class="container mx-auto px-4 pb-10 pt-48">
        <NuxtLink :to="localePath('/tools')" class="group mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-default">
          <UIcon name="i-lucide-arrow-left" class="size-4 transition-transform duration-300 group-hover:-translate-x-1" />
          {{ t('toolsPage.title') }}
        </NuxtLink>

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ tool.name }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('skinEditor.sub') }}</p>
      </section>
    </div>

    <section class="container mx-auto px-4 pb-24">
      <div class="mb-4 flex flex-wrap items-center gap-2 rounded-3xl border border-zinc-600/50 bg-black/30 p-3 backdrop-blur-sm">
        <div class="flex gap-1">
          <UTooltip v-for="item in TOOLS_LIST" :key="item.id" :text="t(`skinEditor.tools.${item.id}`)">
            <UButton
              :icon="item.icon"
              size="sm"
              color="neutral"
              :variant="brush === item.id ? 'subtle' : 'ghost'"
              @click="brush = item.id"
            />
          </UTooltip>
        </div>

        <div class="h-6 w-px bg-white/10"></div>

        <UPopover>
          <UButton size="sm" color="neutral" variant="ghost" class="gap-2">
            <span class="size-4 rounded border border-white/20" :style="{ background: colour }"></span>
            <span class="font-mono text-xs">{{ colour }}</span>
          </UButton>
          <template #content>
            <div class="w-72 p-3">
              <UColorPicker v-model="colour" class="mb-4 w-full" />
              <div v-for="palette in PALETTES" :key="palette.id" class="mb-3 last:mb-0">
                <div class="mb-1.5 text-[10px] uppercase tracking-[0.12em] text-dimmed">
                  {{ t(`skinEditor.palettes.${palette.id}`) }}
                </div>
                <div class="flex flex-wrap gap-1">
                  <button
                    v-for="c in palette.colours"
                    :key="c"
                    type="button"
                    class="size-5 cursor-pointer rounded border border-white/15 transition-transform hover:scale-110"
                    :style="{ background: c }"
                    :title="c"
                    @click="pick(c)"
                  />
                </div>
              </div>
            </div>
          </template>
        </UPopover>

        <div v-if="recent.length" class="flex gap-1">
          <button
            v-for="c in recent"
            :key="c"
            type="button"
            class="size-5 cursor-pointer rounded border border-white/20 transition-transform hover:scale-110"
            :style="{ background: c }"
            @click="colour = c"
          />
        </div>

        <div class="h-6 w-px bg-white/10"></div>

        <UButtonGroup v-if="SIZED.includes(brush)" size="sm">
          <UButton
            v-for="n in SIZES"
            :key="n"
            :variant="size === n ? 'subtle' : 'ghost'"
            color="neutral"
            :title="`${n}\u00d7${n} px`"
            @click="size = n"
          >
            <span class="grid size-4 place-items-center">
              <span
                class="rounded-[1px] bg-current"
                :style="{ width: `${n * 3}px`, height: `${n * 3}px` }"
              ></span>
            </span>
          </UButton>
        </UButtonGroup>

        <UButtonGroup v-if="brush === 'shade'" size="sm">
          <UButton :variant="lighten ? 'subtle' : 'ghost'" color="neutral" icon="i-lucide-sun" :label="t('skinEditor.lighten')" @click="lighten = true" />
          <UButton :variant="lighten ? 'ghost' : 'subtle'" color="neutral" icon="i-lucide-moon" :label="t('skinEditor.darken')" @click="lighten = false" />
        </UButtonGroup>

        <UTooltip :text="t('skinEditor.symmetry')">
          <UButton
            icon="i-lucide-flip-horizontal-2"
            size="sm"
            color="neutral"
            :variant="symmetry ? 'subtle' : 'ghost'"
            @click="symmetry = !symmetry"
          />
        </UTooltip>

        <div class="h-6 w-px bg-white/10"></div>

        <UTooltip :text="t('skinEditor.undo')">
          <UButton icon="i-lucide-undo-2" size="sm" color="neutral" variant="ghost" :disabled="!canUndo" @click="undo" />
        </UTooltip>
        <UTooltip :text="t('skinEditor.redo')">
          <UButton icon="i-lucide-redo-2" size="sm" color="neutral" variant="ghost" :disabled="!canRedo" @click="redo" />
        </UTooltip>

        <div class="h-6 w-px bg-white/10"></div>

        <UButtonGroup size="sm">
          <UButton :variant="model === 'classic' ? 'subtle' : 'ghost'" color="neutral" :label="t('skinEditor.classic')" @click="model = 'classic'" />
          <UButton :variant="model === 'slim' ? 'subtle' : 'ghost'" color="neutral" :label="t('skinEditor.slim')" @click="model = 'slim'" />
        </UButtonGroup>

        <div class="ms-auto flex flex-wrap items-center gap-2">
          <form class="flex gap-1" @submit.prevent="importPlayer">
            <UInput v-model="query" size="sm" :placeholder="t('skinEditor.searchPh')" :maxlength="36" class="w-40 font-mono" />
            <UButton type="submit" size="sm" color="neutral" variant="subtle" icon="i-lucide-user-round-search" :loading="loading" />
          </form>

          <UTooltip :text="t('skinEditor.upload')">
            <UButton icon="i-lucide-upload" size="sm" color="neutral" variant="ghost" @click="fileInput?.click()" />
          </UTooltip>
          <input ref="fileInput" type="file" accept="image/png" class="hidden" @change="importFile">

          <UTooltip :text="t('skinEditor.reset')">
            <UButton icon="i-lucide-rotate-ccw" size="sm" color="neutral" variant="ghost" @click="reset" />
          </UTooltip>

          <UButton icon="i-lucide-download" size="sm" color="neutral" :label="t('skinEditor.download')" @click="download" />
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-4 backdrop-blur-sm">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('skinEditor.texture') }}</span>
            <USwitch v-model="grid2d" size="sm" :label="t('skinEditor.grid')" />
          </div>
          <div class="aspect-square w-full rounded-2xl bg-[#101010]">
            <SkinEditorCanvas
              :source="source"
              :version="version"
              :model="model"
              :grid="grid2d"
              :size="SIZED.includes(brush) ? size : 1"
              @begin="begin"
              @paint="paint"
              @end="end"
            />
          </div>
        </div>

        <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-4 backdrop-blur-sm">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('skinEditor.model') }}</span>
            <div class="flex flex-wrap items-center gap-3">
              <USwitch v-model="showBase" size="sm" :label="t('skinEditor.layerBase')" />
              <USwitch v-model="showOverlay" size="sm" :label="t('skinEditor.layerOverlay')" />
              <USwitch v-model="grid3d" size="sm" :label="t('skinEditor.grid')" />
            </div>
          </div>
          <div class="aspect-square w-full">
            <SkinEditor3D
              :source="source"
              :version="version"
              :model="model"
              :grid="grid3d"
              :show-base="showBase"
              :show-overlay="showOverlay"
              @begin="begin"
              @paint="paint"
              @end="end"
            />
          </div>
        </div>
      </div>

      <p class="mt-4 text-xs/relaxed text-dimmed">{{ t('skinEditor.hint') }}</p>
    </section>

    <section v-if="features.length" class="container mx-auto px-4 pb-16">
      <h2 v-reveal class="mb-5 text-2xl font-semibold tracking-tight">{{ t('locator.featuresTitle') }}</h2>
      <div class="grid gap-4 md:grid-cols-3">
        <GlassCard v-for="f in features" :key="f.title" v-reveal class="p-6">
          <h3 class="mb-2 font-semibold tracking-tight">{{ f.title }}</h3>
          <p class="text-sm/relaxed text-muted">{{ f.body }}</p>
        </GlassCard>
      </div>
    </section>

    <section v-if="faq.length" class="container mx-auto px-4 pb-24">
      <h2 v-reveal class="mb-5 text-2xl font-semibold tracking-tight">{{ t('colorCodes.faqTitle') }}</h2>
      <UAccordion
        :items="faq"
        :ui="{
          item: 'rounded-2xl border border-zinc-600/50 bg-black/30 backdrop-blur-sm mb-3 px-5 border-b-0',
          trigger: 'py-4 cursor-pointer',
          body: 'pb-4 text-muted text-sm/relaxed'
        }"
      />
    </section>

    <DiscordCta />
  </div>
</template>
