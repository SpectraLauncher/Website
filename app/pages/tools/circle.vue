<script setup lang="ts">
const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'circle')!

useToolSeo('circle', 'circle')

const shape = ref<CircleShape>('circle')
const style = ref<CircleStyle>('thin')
const width = ref(15)
const height = ref(15)
const layer = ref(7)

watch(width, (v) => { if (shape.value === 'circle') height.value = v })
watch(height, (v) => { if (shape.value === 'circle') width.value = v })

watch(shape, (s) => {
  if (s === 'circle') height.value = width.value
  layer.value = Math.floor(height.value / 2)
})

const num = (v: unknown) => (Array.isArray(v) ? Number(v[0]) : Number(v)) || 0

const clamp = (v: number) => Math.max(1, Math.min(MAX_SIZE, Math.floor(num(v) || 1)))

const opts = computed<CircleOptions>(() => ({
  shape: shape.value,
  width: clamp(width.value),
  height: clamp(height.value),
  style: style.value
}))

const layers = computed(() => layerCount(opts.value))
const layerIndex = computed(() => Math.max(0, Math.min(num(layer.value), layers.value - 1)))

watch(layers, (n) => { layer.value = Math.min(num(layer.value), n - 1) })

const current = computed(() => buildLayer(opts.value, layerIndex.value))
const total = computed(() => totalBlocks(opts.value))
const dims = computed(() => dimensions(opts.value))

const cell = computed(() => {
  const cols = current.value.cells[0]?.length ?? 1
  const rows = current.value.cells.length
  return Math.max(4, Math.min(22, Math.floor(560 / Math.max(cols, rows))))
})

const showNumbers = ref(false)
const show3d = ref(false)
const blockColor = ref('#A2CFFE')

const EXPORT_FORMATS = [
  { key: 'create', name: 'Create', ext: '.nbt' },
  { key: 'worldedit', name: 'WorldEdit', ext: '.schem' },
  { key: 'litematica', name: 'Litematica', ext: '.litematic' },
  { key: 'minecolonies', name: 'MineColonies', ext: '.blueprint' }
]
const dimOpacity = ref(25)
const dimPercent = computed(() => Math.max(0, Math.min(100, num(dimOpacity.value))))

watch(shape, (v) => { if (v !== 'sphere') show3d.value = false })

const asText = computed(() =>
  current.value.cells.map(row => row.map(c => (c ? '#' : '.')).join('')).join('\n'))

const copy = async (value: string) => {
  await navigator.clipboard.writeText(value)
  toast.add({ title: t('colorCodes.copied', { value: t('circle.theLayer') }), icon: 'i-lucide-check', color: 'success' })
}

const features = computed(() => (tm('circle.features') as unknown[]).map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
})))

const faq = computed(() => (tm('circle.faq') as unknown[]).map((x, i) => ({
  value: String(i),
  label: rt((x as { q: string }).q),
  content: rt((x as { a: string }).a)
})))
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

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('circle.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('circle.sub') }}</p>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div class="flex flex-col gap-4">
            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('circle.shape') }}</div>
              <div class="mb-6 flex flex-wrap gap-1.5">
                <UButton
                  v-for="s in (['circle', 'ellipse', 'sphere'] as CircleShape[])"
                  :key="s"
                  size="sm"
                  :variant="shape === s ? 'subtle' : 'ghost'"
                  color="neutral"
                  :label="t(`circle.shapes.${s}`)"
                  @click="shape = s"
                />
              </div>

              <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('circle.style') }}</div>
              <div class="mb-6 flex flex-wrap gap-1.5">
                <UButton
                  v-for="s in (['thin', 'thick', 'filled'] as CircleStyle[])"
                  :key="s"
                  size="sm"
                  :variant="style === s ? 'subtle' : 'ghost'"
                  color="neutral"
                  :label="t(`circle.styles.${s}`)"
                  @click="style = s"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="mb-1 block text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('circle.width') }}</label>
                  <UInput v-model.number="width" type="number" :min="1" :max="MAX_SIZE" class="w-full font-mono" />
                </div>
                <div>
                  <label class="mb-1 block text-[10px] uppercase tracking-[0.12em] text-dimmed">
                    {{ shape === 'sphere' ? t('circle.heightY') : t('circle.height') }}
                  </label>
                  <UInput
                    v-model.number="height"
                    type="number"
                    :min="1"
                    :max="MAX_SIZE"
                    :disabled="shape === 'circle'"
                    class="w-full font-mono"
                  />
                </div>
              </div>

              <div v-if="shape === 'sphere'" class="mt-6">
                <div class="mb-2 flex items-center justify-between">
                  <label class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('circle.layer') }}</label>
                  <span class="font-mono text-sm">{{ layerIndex + 1 }} / {{ layers }}</span>
                </div>
                <USlider v-model="layer" :min="0" :max="Math.max(0, layers - 1)" />
              </div>
            </div>

            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="flex flex-col gap-3">
                <div v-for="row in [
                  { label: t('circle.layerBlocks'), value: current.count, accent: true, show: shape === 'sphere' },
                  { label: t('circle.totalBlocks'), value: total, accent: true, show: true },
                  { label: t('circle.size'), value: shape === 'sphere' ? `${dims.width} × ${dims.height} × ${dims.depth}` : `${dims.width} × ${dims.depth}`, show: true }
                ].filter(r => r.show)" :key="row.label" class="rounded-2xl border border-white/10 bg-black/40 p-3">
                  <div class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ row.label }}</div>
                  <div class="font-mono" :class="row.accent ? 'text-xl' : 'text-sm text-muted'">{{ row.value }}</div>
                </div>
              </div>

              <UButton
                icon="i-lucide-copy"
                size="sm"
                variant="ghost"
                color="neutral"
                class="mt-3 w-full justify-center"
                :label="t('circle.copyLayer')"
                @click="copy(asText)"
              />
            </div>
          </div>

          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('colorCodes.previewLabel') }}</div>
              <div class="flex flex-wrap items-center gap-5">
                <span v-if="shape === 'sphere'" class="text-xs text-dimmed">{{ t('circle.layerOf', { n: layerIndex + 1, total: layers }) }}</span>
                <USwitch
                  v-if="shape === 'sphere'"
                  v-model="show3d"
                  size="sm"
                  :label="t('circle.view3d')"
                  :ui="{ label: 'text-sm text-muted' }"
                />
                <USwitch
                  v-if="!show3d"
                  v-model="showNumbers"
                  size="sm"
                  :label="t('circle.numbers')"
                  :ui="{ label: 'text-sm text-muted' }"
                />

                <UPopover>
                  <button
                    type="button"
                    class="size-8 cursor-pointer rounded-lg border border-white/15 transition-transform hover:scale-110"
                    :style="{ background: blockColor }"
                    :title="t('circle.blockColor')"
                    :aria-label="t('circle.blockColor')"
                  />
                  <template #content>
                    <div class="flex flex-col gap-3 p-4">
                      <UColorPicker v-model="blockColor" size="sm" />
                      <UInput v-model="blockColor" size="sm" class="font-mono" />
                    </div>
                  </template>
                </UPopover>
              </div>
            </div>

            <div v-if="show3d" class="mb-4 flex flex-wrap items-center gap-4">
              <span class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('circle.dimOpacity') }}</span>
              <USlider v-model="dimOpacity" :min="0" :max="100" class="max-w-56 flex-1" />
              <span class="w-12 font-mono text-sm text-muted">{{ dimPercent }}%</span>
            </div>

            <LazySphereViewer
              v-if="show3d"
              :opts="opts"
              :highlight="layerIndex"
              :color="blockColor"
              :dim-opacity="dimPercent / 100"
            />

            <div v-else class="overflow-auto rounded-2xl bg-[#101010] p-4">
              <div class="mx-auto w-fit">
                <div v-if="showNumbers" class="flex" :style="{ marginLeft: `${cell + 4}px` }">
                  <div
                    v-for="(_, x) in current.cells[0] || []"
                    :key="x"
                    class="shrink-0 text-center font-mono text-dimmed"
                    :style="{ width: `${cell}px`, fontSize: `${Math.min(11, cell * 0.55)}px` }"
                  >{{ x + 1 }}</div>
                </div>

                <div
                  v-for="(row, z) in current.cells"
                  :key="z"
                  class="flex items-center"
                >
                  <div
                    v-if="showNumbers"
                    class="shrink-0 pr-1 text-right font-mono text-dimmed"
                    :style="{ width: `${cell + 4}px`, fontSize: `${Math.min(11, cell * 0.55)}px` }"
                  >{{ z + 1 }}</div>

                  <div
                    v-for="(on, x) in row"
                    :key="x"
                    class="shrink-0 border border-white/[0.04]"
                    :style="{
                      width: `${cell}px`,
                      height: `${cell}px`,
                      background: on ? blockColor : 'transparent'
                    }"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <div class="mb-2 flex flex-wrap items-center gap-3">
          <h2 v-reveal class="text-2xl font-semibold tracking-tight">{{ t('circle.exportTitle') }}</h2>
          <UBadge variant="subtle" size="sm" :label="t('toolsPage.soon')" />
        </div>
        <p v-reveal class="mb-5 max-w-[62ch] text-muted">{{ t('circle.exportSub') }}</p>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="f in EXPORT_FORMATS"
            :key="f.ext"
            class="cursor-not-allowed rounded-2xl border border-zinc-600/50 bg-black/30 p-5 opacity-60 backdrop-blur-sm"
          >
            <div class="mb-3 flex items-center justify-between gap-3">
              <UIcon name="i-lucide-download" class="size-5 text-dimmed" />
              <span class="font-mono text-xs text-dimmed">{{ f.ext }}</span>
            </div>
            <div class="mb-1 font-semibold tracking-tight">{{ f.name }}</div>
            <p class="text-xs/relaxed text-muted">{{ t(`circle.exportHint.${f.key}`) }}</p>
          </div>
        </div>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <h2 v-reveal class="mb-5 text-2xl font-semibold tracking-tight">{{ t('locator.featuresTitle') }}</h2>
        <div class="grid gap-4 md:grid-cols-3">
          <GlassCard v-for="f in features" :key="f.title" v-reveal class="p-6">
            <h3 class="mb-2 font-semibold tracking-tight">{{ f.title }}</h3>
            <p class="text-sm/relaxed text-muted">{{ f.body }}</p>
          </GlassCard>
        </div>
      </section>

      <section class="container mx-auto px-4 pb-24">
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
    </div>

    <DiscordCta />
  </div>
</template>
