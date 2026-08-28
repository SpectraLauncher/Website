<script setup lang="ts">
const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'banner')!

useToolSeo('banner', 'banner')

const MAX_LAYERS = 6

const base = ref('white')
const layers = ref<BannerLayer[]>([
  { pattern: 'creeper', color: 'lime' },
  { pattern: 'border', color: 'green' }
])
const activeColor = ref('black')
const target = ref('@p')

const addLayer = (pattern: string) => {
  if (layers.value.length >= MAX_LAYERS) {
    toast.add({ title: t('banner.maxLayers', { n: MAX_LAYERS }), icon: 'i-lucide-info', color: 'warning' })
    return
  }
  layers.value.push({ pattern, color: activeColor.value })
}

const removeLayer = (i: number) => layers.value.splice(i, 1)

const move = (i: number, dir: -1 | 1) => {
  const j = i + dir
  if (j < 0 || j >= layers.value.length) return
  const copy = [...layers.value]
  const tmp = copy[i]!
  copy[i] = copy[j]!
  copy[j] = tmp
  layers.value = copy
}

const usePreset = (preset: BannerPreset) => {
  base.value = preset.base
  layers.value = preset.layers.map(l => ({ ...l }))
}

const reset = () => {
  base.value = 'white'
  layers.value = []
}

const groups = computed(() => ([
  { key: 'geo', patterns: BANNER_PATTERNS.filter(p => p.group === 'geo' && p.id !== 'base') },
  { key: 'charge', patterns: BANNER_PATTERNS.filter(p => p.group === 'charge') }
]))

const commands = computed(() => ([
  { key: 'banner', label: t('banner.cmdBanner'), hint: t('banner.cmdModern'), value: bannerGive(base.value, layers.value, 'banner', 'modern', target.value) },
  { key: 'shield', label: t('banner.cmdShield'), hint: t('banner.cmdModern'), value: bannerGive(base.value, layers.value, 'shield', 'modern', target.value) },
  { key: 'bannerLegacy', label: t('banner.cmdBannerLegacy'), hint: t('banner.cmdLegacy'), value: bannerGive(base.value, layers.value, 'banner', 'legacy', target.value) },
  { key: 'shieldLegacy', label: t('banner.cmdShieldLegacy'), hint: t('banner.cmdLegacy'), value: bannerGive(base.value, layers.value, 'shield', 'legacy', target.value) }
]))

const copy = async (value: string) => {
  await navigator.clipboard.writeText(value)
  toast.add({ title: t('colorCodes.copied', { value: t('banner.theCommand') }), icon: 'i-lucide-check', color: 'success' })
}

const features = computed(() => (tm('banner.features') as unknown[]).map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
})))

const faq = computed(() => (tm('banner.faq') as unknown[]).map((x, i) => ({
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

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('banner.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('banner.sub') }}</p>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <div class="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div class="flex flex-col gap-4">
            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-4 flex items-center justify-between">
                <div class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('colorCodes.previewLabel') }}</div>
                <UButton
                  icon="i-lucide-rotate-ccw"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  :label="t('banner.reset')"
                  @click="reset"
                />
              </div>
              <div class="flex items-start justify-center gap-6 rounded-2xl bg-[#101010] py-6">
                <BannerPreview :base="base" :layers="layers" :scale="5" />
                <BannerPreview :base="base" :layers="layers" :scale="3" shield />
              </div>
            </div>

            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm">
              <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('banner.layers') }}</div>

              <p v-if="!layers.length" class="text-sm text-muted">{{ t('banner.noLayers') }}</p>

              <div v-else class="flex flex-col gap-2">
                <div
                  v-for="(layer, i) in [...layers].reverse()"
                  :key="layers.length - 1 - i"
                  class="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 p-2"
                >
                  <BannerPreview :base="'white'" :layers="[layer]" :scale="1" />
                  <span class="min-w-0 flex-1 truncate text-xs text-muted">
                    {{ t(`banner.patterns.${layer.pattern}`) }}
                  </span>
                  <div class="size-4 shrink-0 rounded border border-white/10" :style="{ background: bannerHex(layer.color) }" />
                  <UButton icon="i-lucide-chevron-up" size="xs" variant="ghost" color="neutral" :aria-label="t('banner.up')" @click="move(layers.length - 1 - i, 1)" />
                  <UButton icon="i-lucide-chevron-down" size="xs" variant="ghost" color="neutral" :aria-label="t('banner.down')" @click="move(layers.length - 1 - i, -1)" />
                  <UButton icon="i-lucide-x" size="xs" variant="ghost" color="neutral" :aria-label="t('locator.remove')" @click="removeLayer(layers.length - 1 - i)" />
                </div>
              </div>

              <p class="mt-3 text-xs text-dimmed">{{ t('banner.layerCount', { n: layers.length, max: MAX_LAYERS }) }}</p>
            </div>
          </div>

          <div class="flex flex-col gap-4">
            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('banner.baseColor') }}</div>
              <div class="mb-6 flex flex-wrap gap-2">
                <button
                  v-for="c in BANNER_COLORS"
                  :key="c.id"
                  type="button"
                  class="size-8 cursor-pointer rounded-lg border transition-transform hover:scale-110"
                  :class="base === c.id ? 'border-white' : 'border-white/15'"
                  :style="{ background: c.hex }"
                  :title="t(`banner.colors.${c.id}`)"
                  :aria-label="t(`banner.colors.${c.id}`)"
                  @click="base = c.id"
                />
              </div>

              <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('banner.layerColor') }}</div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="c in BANNER_COLORS"
                  :key="c.id"
                  type="button"
                  class="size-8 cursor-pointer rounded-lg border transition-transform hover:scale-110"
                  :class="activeColor === c.id ? 'border-white' : 'border-white/15'"
                  :style="{ background: c.hex }"
                  :title="t(`banner.colors.${c.id}`)"
                  :aria-label="t(`banner.colors.${c.id}`)"
                  @click="activeColor = c.id"
                />
              </div>
            </div>

            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div v-for="g in groups" :key="g.key" class="mb-6 last:mb-0">
                <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t(`banner.groups.${g.key}`) }}</div>
                <div class="grid grid-cols-6 gap-2 sm:grid-cols-9 lg:grid-cols-12">
                  <button
                    v-for="p in g.patterns"
                    :key="p.id"
                    type="button"
                    class="cursor-pointer rounded-lg border border-white/10 bg-black/40 p-1 transition-colors hover:border-zinc-400"
                    :title="t(`banner.patterns.${p.id}`)"
                    @click="addLayer(p.id)"
                  >
                    <BannerPreview :base="'white'" :layers="[{ pattern: p.id, color: activeColor }]" :scale="1.6" />
                  </button>
                </div>
              </div>
            </div>

            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('banner.presets') }}</div>
              <div class="flex flex-wrap gap-3">
                <button
                  v-for="p in BANNER_PRESETS"
                  :key="p.key"
                  type="button"
                  class="cursor-pointer rounded-xl border border-white/10 bg-black/40 p-2 transition-colors hover:border-zinc-400"
                  :title="t(`banner.presetNames.${p.key}`)"
                  @click="usePreset(p)"
                >
                  <BannerPreview :base="p.base" :layers="p.layers" :scale="2" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="mb-4 flex flex-wrap items-center gap-3">
            <span class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('banner.target') }}</span>
            <UInput v-model="target" size="sm" class="w-32 font-mono" />
          </div>

          <div class="grid gap-4 lg:grid-cols-2">
            <div v-for="cmd in commands" :key="cmd.key" class="rounded-2xl border border-white/10 bg-black/40 p-4">
              <div class="mb-1 flex items-center justify-between gap-4">
                <div class="text-sm font-medium">{{ cmd.label }}</div>
                <UButton
                  icon="i-lucide-copy"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  :label="t('colorCodes.copy')"
                  @click="copy(cmd.value)"
                />
              </div>
              <div class="mb-2 text-xs text-dimmed">{{ cmd.hint }}</div>
              <pre class="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-muted">{{ cmd.value }}</pre>
            </div>
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
