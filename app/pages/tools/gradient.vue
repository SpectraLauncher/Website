<script setup lang="ts">
const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'gradient')!

useToolSeo('gradient', 'gradient')

const text = ref('Spectra Network')
const stops = ref<string[]>(['#00E0FF', '#C837FF'])
const style = reactive<GradientStyle>({})

const MAX_STOPS = 7

const addStop = () => {
  if (stops.value.length >= MAX_STOPS) return
  const last = stops.value[stops.value.length - 1]!
  stops.value.push(mix(last, '#FFFFFF', 0.45))
}

const removeStop = (i: number) => {
  if (stops.value.length <= 2) return
  stops.value.splice(i, 1)
}

const usePreset = (preset: string[]) => {
  stops.value = [...preset]
}

const chars = computed(() => gradientChars(text.value, stops.value))
const rampCss = computed(() => `linear-gradient(90deg, ${stops.value.join(', ')})`)

const outputs = computed(() => ([
  { key: 'minimessage', label: t('gradient.fmt.minimessage'), hint: t('gradient.fmtHint.minimessage'), value: toGradientCode(text.value, stops.value, 'minimessage', style) },
  { key: 'amp', label: t('gradient.fmt.amp'), hint: t('gradient.fmtHint.amp'), value: toGradientCode(text.value, stops.value, 'amp', style) },
  { key: 'section', label: t('gradient.fmt.section'), hint: t('gradient.fmtHint.section'), value: toGradientCode(text.value, stops.value, 'section', style) }
]))

const charStyle = (hex: string) => ({
  color: hex || '#FFFFFF',
  textShadow: `2px 2px 0 ${hex ? mix(hex, '#000000', 0.75) : '#3F3F3F'}`,
  fontWeight: style.bold ? '700' : '400',
  fontStyle: style.italic ? 'italic' : 'normal',
  textDecoration: [style.underline && 'underline', style.strike && 'line-through']
    .filter(Boolean).join(' ') || 'none'
})

const copy = async (value: string) => {
  if (!value) return
  await navigator.clipboard.writeText(value)
  toast.add({ title: t('colorCodes.copied', { value: t('smallText.theText') }), icon: 'i-lucide-check', color: 'success' })
}

const steps = computed(() => (tm('gradient.steps') as unknown[]).map((s, i) => ({
  n: String(i + 1).padStart(2, '0'),
  title: rt((s as { title: string }).title),
  body: rt((s as { body: string }).body)
})))

const faq = computed(() => (tm('gradient.faq') as unknown[]).map((x, i) => ({
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

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('gradient.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('gradient.sub') }}</p>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="mb-4 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('colorCodes.previewLabel') }}</div>

          <div class="overflow-x-auto rounded-2xl bg-[#101010] px-6 py-10">
            <p class="mc-font min-h-[1.6em] whitespace-pre text-center text-4xl sm:text-5xl">
              <span v-for="(c, i) in chars" :key="i" :style="charStyle(c.hex)">{{ c.char }}</span>
            </p>
          </div>

          <div
            class="mt-6 h-24 w-full rounded-2xl border border-white/10 shadow-inner"
            :style="{ background: rampCss }"
          />

          <div class="mt-5 flex flex-wrap items-center gap-3">
            <UPopover v-for="(stop, i) in stops" :key="i">
              <button
                type="button"
                class="group relative size-14 cursor-pointer rounded-2xl border border-white/15 transition-transform hover:scale-105"
                :style="{ background: stop }"
                :title="t('gradient.stop', { n: i + 1 })"
              >
                <span
                  v-if="stops.length > 2"
                  class="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-zinc-600 bg-black/90 text-dimmed opacity-0 transition-opacity hover:text-default group-hover:opacity-100"
                  role="button"
                  :aria-label="t('locator.remove')"
                  @click.stop="removeStop(i)"
                >
                  <UIcon name="i-lucide-x" class="size-3" />
                </span>
              </button>

              <template #content>
                <div class="flex flex-col gap-3 p-4">
                  <UColorPicker v-model="stops[i]" size="sm" />
                  <UInput v-model="stops[i]" size="sm" class="font-mono" />
                </div>
              </template>
            </UPopover>

            <UButton
              v-if="stops.length < MAX_STOPS"
              icon="i-lucide-plus"
              variant="ghost"
              color="neutral"
              class="size-14 justify-center rounded-2xl border border-dashed border-zinc-600/60"
              :aria-label="t('gradient.addColor')"
              :title="t('gradient.addColor')"
              @click="addStop"
            />

            <span class="ml-1 text-sm text-dimmed">{{ t('gradient.stopCount', { n: stops.length, max: MAX_STOPS }) }}</span>
          </div>
        </div>

        <div class="mt-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <label class="mb-2 block text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('gradient.textLabel') }}</label>
          <input
            v-model="text"
            type="text"
            :placeholder="t('gradient.textPh')"
            class="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-lg outline-none transition-colors placeholder:text-dimmed focus:border-zinc-500"
          >

          <div class="mt-6 flex flex-wrap items-center gap-2">
            <span class="mr-1 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('colorCodes.formatsTitle') }}</span>
            <UButton
              v-for="f in MC_FORMATS.filter(x => x.key !== 'reset')"
              :key="f.code"
              :icon="f.icon"
              size="sm"
              :variant="style[f.key as keyof GradientStyle] ? 'subtle' : 'ghost'"
              color="neutral"
              :title="t(`colorCodes.fmt.${f.key}`)"
              :aria-label="t(`colorCodes.fmt.${f.key}`)"
              @click="style[f.key as keyof GradientStyle] = !style[f.key as keyof GradientStyle]"
            />
          </div>

          <div class="mt-6 flex flex-wrap items-center gap-2">
            <span class="mr-1 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('gradient.presets') }}</span>
            <button
              v-for="p in GRADIENT_PRESETS"
              :key="p.key"
              type="button"
              class="h-9 w-20 cursor-pointer rounded-xl border border-white/10 transition-transform hover:scale-105"
              :style="{ background: `linear-gradient(90deg, ${p.stops.join(', ')})` }"
              :title="t(`gradient.presetNames.${p.key}`)"
              :aria-label="t(`gradient.presetNames.${p.key}`)"
              @click="usePreset(p.stops)"
            />
          </div>
        </div>

        <div class="mt-4 grid gap-4 lg:grid-cols-3">
          <div
            v-for="out in outputs"
            :key="out.key"
            class="flex flex-col rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm"
          >
            <div class="mb-1 flex items-center justify-between gap-4">
              <div class="text-sm font-medium">{{ out.label }}</div>
              <UButton
                icon="i-lucide-copy"
                size="xs"
                variant="ghost"
                color="neutral"
                :label="t('colorCodes.copy')"
                @click="copy(out.value)"
              />
            </div>
            <div class="mb-3 text-xs text-dimmed">{{ out.hint }}</div>
            <pre class="flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-2xl bg-black/40 p-3 font-mono text-xs text-muted">{{ out.value || '—' }}</pre>
            <div class="mt-2 text-right text-[10px] text-dimmed">{{ t('gradient.length', { n: out.value.length }) }}</div>
          </div>
        </div>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <h2 v-reveal class="mb-5 text-2xl font-semibold tracking-tight">{{ t('gradient.howTitle') }}</h2>
        <div class="grid gap-4 md:grid-cols-3">
          <GlassCard v-for="s in steps" :key="s.n" v-reveal class="p-6">
            <div class="mb-4 text-sm text-dimmed">{{ s.n }}</div>
            <h3 class="mb-2 font-semibold tracking-tight">{{ s.title }}</h3>
            <p class="text-sm/relaxed text-muted">{{ s.body }}</p>
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
