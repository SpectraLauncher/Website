<script setup lang="ts">
const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'rank')!

useToolSeo('rank', 'rank')

const s = reactive<RankTagState>(defaultRankTag())

const preview = ref<PreviewMode>('studio')
const zoom = ref(6)
const exportScale = ref(4)
const tag = ref({ dataUrl: '', width: 0, height: 0 })
const canvasRef = ref<{ dataUrl: (scale: number) => string } | null>(null)
const fileInput = ref<HTMLInputElement>()

const num = (v: unknown) => (Array.isArray(v) ? Number(v[0]) : Number(v)) || 0

const onRendered = (payload: { dataUrl: string, width: number, height: number }) => {
  tag.value = payload
}

const usePreset = (p: RankPreset) => {
  Object.assign(s, applyPreset(p))
}

const pickIcon = (id: string) => {
  s.icon = id
  s.customIcon = ''
}

const onUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  if (file.size > 256 * 1024) {
    toast.add({ title: t('rank.tooBig'), icon: 'i-lucide-triangle-alert', color: 'warning' })
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    s.customIcon = String(reader.result)
    s.icon = ''
  }
  reader.readAsDataURL(file)
}

const clearCustom = () => {
  s.customIcon = ''
  s.icon = 'crown'
  if (fileInput.value) fileInput.value.value = ''
}

const download = () => {
  const url = canvasRef.value?.dataUrl(exportScale.value)
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = `${(s.label || 'rank').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${exportScale.value}x.png`
  a.click()
}

const copyDataUrl = async () => {
  const url = canvasRef.value?.dataUrl(exportScale.value)
  if (!url) return
  await navigator.clipboard.writeText(url)
  toast.add({ title: t('rank.copiedUrl'), icon: 'i-lucide-check', color: 'success' })
}

const paletteGroups = [
  { key: 'cosmic', start: '#581C87', end: '#240A4C', border: '#C084FC' },
  { key: 'neon', start: '#DB2777', end: '#831843', border: '#F9A8D4' },
  { key: 'ocean', start: '#0891B2', end: '#164E63', border: '#67E8F9' },
  { key: 'emerald', start: '#059669', end: '#064E3B', border: '#6EE7B7' },
  { key: 'amber', start: '#D97706', end: '#78350F', border: '#FCD34D' },
  { key: 'crimson', start: '#DC2626', end: '#7F1D1D', border: '#FCA5A5' },
  { key: 'midnight', start: '#334155', end: '#0F172A', border: '#94A3B8' }
]

const usePalette = (p: typeof paletteGroups[number]) => {
  s.bgStart = p.start
  s.bgEnd = p.end
  s.borderColor = p.border
}

const iconPreview = (icon: RankIcon) => {
  const cells: string[] = []
  icon.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const colour = ICON_PALETTE[ch]
      if (colour) cells.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${colour}"/>`)
    })
  })
  return `<svg viewBox="0 0 7 7" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${cells.join('')}</svg>`
}

const features = computed(() => (tm('rank.features') as unknown[]).map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
})))

const faq = computed(() => (tm('rank.faq') as unknown[]).map((x, i) => ({
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

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('rank.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('rank.sub') }}</p>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <RankTagCanvas ref="canvasRef" :state="s" @rendered="onRendered" />

        <div class="grid gap-4 lg:grid-cols-[1fr_400px] lg:items-start">
          <div class="flex flex-col gap-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('rank.preview') }}</div>
                <div class="flex flex-wrap gap-1.5">
                  <UButton
                    v-for="m in PREVIEW_MODES"
                    :key="m"
                    size="xs"
                    :variant="preview === m ? 'subtle' : 'ghost'"
                    color="neutral"
                    :label="t(`rank.previews.${m}`)"
                    @click="preview = m"
                  />
                </div>
              </div>

              <div v-if="preview === 'studio'" class="grid min-h-56 place-items-center rounded-2xl bg-[#101010] p-6 [background-image:repeating-conic-gradient(#181818_0_25%,transparent_0_50%)] [background-size:16px_16px]">
                <img v-if="tag.dataUrl" :src="tag.dataUrl" :style="{ width: `${tag.width * zoom}px` }" class="[image-rendering:pixelated]" alt="" >
              </div>

              <div v-else-if="preview === 'chat'" class="mc-font min-h-56 rounded-2xl bg-[#101010] p-5">
                <p v-for="line in 4" :key="line" class="mb-2 flex items-center gap-1.5 text-lg last:mb-0">
                  <img v-if="tag.dataUrl" :src="tag.dataUrl" :style="{ height: `${tag.height * 2}px` }" class="[image-rendering:pixelated]" alt="" >
                  <span style="color: #AAAAAA; text-shadow: 2px 2px 0 #2A2A2A">Steve{{ line }}</span>
                  <span style="color: #FFFFFF; text-shadow: 2px 2px 0 #3F3F3F">{{ t('rank.chatLine') }}</span>
                </p>
              </div>

              <div v-else class="grid min-h-56 place-items-center rounded-2xl bg-[#101010] p-5">
                <div class="mc-font w-full max-w-md rounded bg-black/60 p-3">
                  <p class="mb-2 text-center text-sm text-white/70">{{ t('rank.tabTitle') }}</p>
                  <div class="grid grid-cols-2 gap-1">
                    <div v-for="row in 6" :key="row" class="flex items-center gap-1.5 bg-white/5 px-1.5 py-1">
                      <span class="size-3.5 shrink-0 bg-[#8b6f4e]"></span>
                      <img v-if="tag.dataUrl && row <= 3" :src="tag.dataUrl" :style="{ height: `${tag.height * 2}px` }" class="[image-rendering:pixelated]" alt="" >
                      <span class="truncate text-xs text-white">Player{{ row }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="mt-4 flex flex-wrap items-center gap-4">
                <span class="font-mono text-xs text-dimmed">{{ tag.width }} × {{ tag.height }} px</span>
                <div class="flex flex-1 items-center gap-3">
                  <span class="text-xs text-muted">{{ t('rank.zoom') }}</span>
                  <USlider :model-value="zoom" :min="2" :max="12" class="max-w-40 flex-1" @update:model-value="zoom = num($event)" />
                  <span class="font-mono text-xs text-muted">{{ zoom }}×</span>
                </div>
              </div>
            </div>

            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('rank.presets') }}</div>
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  v-for="p in RANK_PRESETS"
                  :key="p.key"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  class="font-mono"
                  :label="t(`rank.presetNames.${p.key}`)"
                  @click="usePreset(p)"
                />
              </div>
            </div>

            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-4 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('rank.export') }}</div>
              <div class="flex flex-wrap items-center gap-3">
                <div class="flex flex-wrap gap-1.5">
                  <UButton
                    v-for="x in [1, 2, 4, 8, 16]"
                    :key="x"
                    size="xs"
                    :variant="exportScale === x ? 'subtle' : 'ghost'"
                    color="neutral"
                    :label="`${x}×`"
                    @click="exportScale = x"
                  />
                </div>
                <UButton icon="i-lucide-download" size="sm" color="neutral" :label="t('rank.download')" @click="download" />
                <UButton icon="i-lucide-copy" size="sm" variant="ghost" color="neutral" :label="t('rank.copyUrl')" @click="copyDataUrl" />
                <span class="font-mono text-xs text-dimmed">{{ tag.width * exportScale }} × {{ tag.height * exportScale }} px</span>
              </div>
              <p class="mt-3 text-xs/relaxed text-dimmed">{{ t('rank.exportHint') }}</p>
            </div>
          </div>

          <div class="flex flex-col gap-4">
            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-2 flex items-center justify-between">
                <label class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('rank.label') }}</label>
                <span class="font-mono text-xs text-dimmed">{{ s.label.length }}/{{ MAX_LABEL }}</span>
              </div>
              <UInput
                :model-value="s.label"
                size="md"
                class="w-full font-mono"
                :maxlength="MAX_LABEL"
                :placeholder="t('rank.labelPh')"
                @update:model-value="s.label = String($event)"
              />

              <div class="mt-5 mb-2 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('rank.style') }}</div>
              <div class="flex flex-col gap-1.5">
                <button
                  v-for="st in RANK_STYLES"
                  :key="st"
                  type="button"
                  class="flex cursor-pointer items-baseline gap-2 rounded-xl border px-3 py-2 text-left transition-colors"
                  :class="s.style === st ? 'border-zinc-400 bg-white/5' : 'border-white/10 bg-black/30 hover:border-zinc-500'"
                  @click="s.style = st"
                >
                  <span class="text-sm font-medium">{{ t(`rank.styles.${st}`) }}</span>
                  <span class="text-xs text-dimmed">{{ t(`rank.styleDesc.${st}`) }}</span>
                </button>
              </div>
            </div>

            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('rank.icon') }}</div>

              <div class="mb-4 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  class="grid size-9 cursor-pointer place-items-center rounded-lg border transition-colors"
                  :class="!s.icon && !s.customIcon ? 'border-zinc-400 bg-white/5' : 'border-white/10 bg-black/30 hover:border-zinc-500'"
                  :title="t('rank.noIcon')"
                  @click="s.icon = ''; s.customIcon = ''"
                >
                  <UIcon name="i-lucide-ban" class="size-4 text-dimmed" />
                </button>
                <button
                  v-for="ic in RANK_ICONS"
                  :key="ic.id"
                  type="button"
                  class="grid size-9 cursor-pointer place-items-center rounded-lg border p-1 transition-colors"
                  :class="s.icon === ic.id && !s.customIcon ? 'border-zinc-400 bg-white/5' : 'border-white/10 bg-black/30 hover:border-zinc-500'"
                  :title="t(`rank.iconNames.${ic.id}`)"
                  @click="pickIcon(ic.id)"
                >
                  <span class="block size-full [image-rendering:pixelated]" v-html="iconPreview(ic)" />
                </button>
              </div>

              <div class="mb-4 flex flex-wrap items-center gap-2">
                <input ref="fileInput" type="file" accept="image/png,image/webp" class="hidden" @change="onUpload">
                <UButton icon="i-lucide-upload" size="xs" variant="ghost" color="neutral" :label="t('rank.upload')" @click="fileInput?.click()" />
                <img v-if="s.customIcon" :src="s.customIcon" class="size-7 [image-rendering:pixelated]" alt="" >
                <UButton v-if="s.customIcon" icon="i-lucide-x" size="xs" variant="ghost" color="neutral" :aria-label="t('locator.remove')" @click="clearCustom" />
              </div>
              <p class="mb-4 text-xs text-dimmed">{{ t('rank.uploadHint') }}</p>

              <div class="mb-3 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('rank.iconMode') }}</div>
              <div class="mb-2 flex flex-wrap gap-1.5">
                <UButton
                  v-for="m in ICON_MODES"
                  :key="m"
                  size="xs"
                  :variant="s.iconMode === m ? 'subtle' : 'ghost'"
                  color="neutral"
                  :label="t(`rank.iconModes.${m}`)"
                  @click="s.iconMode = m"
                />
              </div>
              <p class="mb-4 text-xs/relaxed text-dimmed">{{ t(`rank.iconModeHint.${s.iconMode}`) }}</p>

              <div class="mb-3">
                <div class="mb-2 flex items-center justify-between text-sm">
                  <span class="text-muted">{{ s.iconMode === 'separate' ? t('rank.islandGap') : t('rank.iconGap') }}</span>
                  <span class="font-mono">{{ s.iconGap }}px</span>
                </div>
                <USlider :model-value="s.iconGap" :min="0" :max="8" @update:model-value="s.iconGap = num($event)" />
              </div>

              <USwitch
                v-if="s.iconMode === 'separate'"
                v-model="s.compactIconPad"
                size="sm"
                :label="t('rank.compactPad')"
                :ui="{ label: 'text-sm text-muted' }"
              />
            </div>

            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-3 flex items-center justify-between gap-3">
                <span class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('rank.background') }}</span>
                <USwitch v-model="s.gradient" size="xs" :label="t('rank.gradientMode')" :ui="{ label: 'text-xs text-muted' }" />
              </div>

              <div class="mb-4 grid grid-cols-3 gap-3">
                <div v-for="field in ([
                  { key: 'bgStart', label: s.gradient ? t('rank.bgStart') : t('rank.bgSolid') },
                  { key: 'bgEnd', label: t('rank.bgEnd'), hidden: !s.gradient },
                  { key: 'borderColor', label: t('rank.borderColor') }
                ] as const)" :key="field.key">
                  <template v-if="!('hidden' in field && field.hidden)">
                    <label class="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ field.label }}</label>
                    <UPopover>
                      <button type="button" class="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-black/40 p-1.5">
                        <span class="size-5 shrink-0 rounded border border-white/20" :style="{ background: s[field.key] }" />
                        <span class="font-mono text-[10px] text-muted">{{ s[field.key].toUpperCase() }}</span>
                      </button>
                      <template #content>
                        <div class="p-4">
                          <UColorPicker v-model="s[field.key]" size="sm" />
                        </div>
                      </template>
                    </UPopover>
                  </template>
                </div>
              </div>

              <div class="mb-2 text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('rank.palettes') }}</div>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="p in paletteGroups"
                  :key="p.key"
                  type="button"
                  class="h-7 w-12 cursor-pointer rounded-lg border border-white/15 transition-transform hover:scale-105"
                  :style="{ background: `linear-gradient(90deg, ${p.start}, ${p.end})` }"
                  :title="t(`rank.paletteNames.${p.key}`)"
                  @click="usePalette(p)"
                />
              </div>
            </div>

            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-4 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('rank.borders') }}</div>

              <div v-for="row in ([
                { key: 'border', label: t('rank.borderWidth'), min: 0, max: 4 },
                { key: 'shadow', label: t('rank.textShadow'), min: 0, max: 3 },
                { key: 'padX', label: t('rank.padX'), min: 0, max: 8 },
                { key: 'padY', label: t('rank.padY'), min: 0, max: 6 }
              ] as const)" :key="row.key" class="mb-4 last:mb-0">
                <div class="mb-2 flex items-center justify-between text-sm">
                  <span class="text-muted">{{ row.label }}</span>
                  <span class="font-mono">{{ s[row.key] }}px</span>
                </div>
                <USlider :model-value="s[row.key]" :min="row.min" :max="row.max" @update:model-value="s[row.key] = num($event)" />
              </div>

              <div class="mt-5 flex flex-wrap items-center gap-4">
                <div>
                  <label class="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('rank.textColor') }}</label>
                  <UPopover>
                    <button type="button" class="size-7 cursor-pointer rounded border border-white/20" :style="{ background: s.textColor }" />
                    <template #content>
                      <div class="p-4">
                        <UColorPicker v-model="s.textColor" size="sm" />
                      </div>
                    </template>
                  </UPopover>
                </div>
                <div v-if="s.style === 'outline'">
                  <label class="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('rank.outlineColor') }}</label>
                  <UPopover>
                    <button type="button" class="size-7 cursor-pointer rounded border border-white/20" :style="{ background: s.outlineColor }" />
                    <template #content>
                      <div class="p-4">
                        <UColorPicker v-model="s.outlineColor" size="sm" />
                      </div>
                    </template>
                  </UPopover>
                </div>
              </div>
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
