<script setup lang="ts">
const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'text-animation')!

useToolSeo('text-animation', 'anim')

const MAX_STOPS = 7

const text = ref('Spectra')
const stops = ref<string[]>(['#C4F454', '#A554B6'])
const style = ref<AnimStyle>('bounce')
const format = ref<AnimFormat>('amp_hex')
const name = ref('logo')
const speed = ref(50)
const template = ref(DEFAULT_TEMPLATE)
const flags = reactive<AnimStyleFlags>({})

const addStop = () => {
  if (stops.value.length >= MAX_STOPS) return
  stops.value.push(mix(stops.value.at(-1)!, '#FFFFFF', 0.4))
}

const removeStop = (i: number) => {
  if (stops.value.length > 2) stops.value.splice(i, 1)
}

const opts = computed<AnimOptions>(() => ({
  text: text.value,
  stops: stops.value,
  style: style.value,
  format: format.value,
  flags
}))

const frames = computed(() => buildFrames(opts.value))
const frameTexts = computed(() => frames.value.map(f => frameToText(f, format.value, flags)))
const output = computed(() => renderTemplate(template.value, frameTexts.value, name.value, speed.value))

const rampCss = computed(() => `linear-gradient(90deg, ${stops.value.join(', ')})`)

const playing = ref(true)
const current = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

const restart = () => {
  clearInterval(timer)
  if (!playing.value || !frames.value.length) return
  const ms = Math.max(16, Number(speed.value) || 1)
  timer = setInterval(() => {
    current.value = (current.value + 1) % Math.max(1, frames.value.length)
  }, ms)
}

onMounted(restart)
onBeforeUnmount(() => clearInterval(timer))
watch([playing, speed, frames], restart)

const frame = computed(() => frames.value[current.value % Math.max(1, frames.value.length)])

const charStyle = (hex: string) => ({
  color: hex || '#FFFFFF',
  textShadow: `2px 2px 0 ${hex ? mix(hex, '#000000', 0.75) : '#3F3F3F'}`,
  fontWeight: flags.bold ? '700' : '400',
  fontStyle: flags.italic ? 'italic' : 'normal',
  textDecoration: [flags.underlined && 'underline', flags.strikethrough && 'line-through']
    .filter(Boolean).join(' ') || 'none'
})

const copy = async (value: string) => {
  await navigator.clipboard.writeText(value)
  toast.add({ title: t('colorCodes.copied', { value: t('anim.theConfig') }), icon: 'i-lucide-check', color: 'success' })
}

const resetTemplate = () => { template.value = DEFAULT_TEMPLATE }

const features = computed(() => (tm('anim.features') as unknown[]).map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
})))

const faq = computed(() => (tm('anim.faq') as unknown[]).map((x, i) => ({
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

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('anim.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('anim.sub') }}</p>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('colorCodes.previewLabel') }}</div>
            <div class="flex items-center gap-4">
              <span class="font-mono text-xs text-dimmed">{{ current + 1 }} / {{ frames.length }}</span>
              <USwitch v-model="playing" size="sm" :label="t('anim.play')" :ui="{ label: 'text-sm text-muted' }" />
            </div>
          </div>

          <div class="overflow-x-auto rounded-2xl bg-[#101010] px-6 py-10">
            <p class="mc-font min-h-[1.6em] whitespace-pre text-center text-4xl sm:text-5xl">
              <span v-for="(c, i) in frame?.chars || []" :key="i" :style="charStyle(c.hex)">{{ c.char }}</span>
            </p>
          </div>

          <div class="mt-6 h-16 w-full rounded-2xl border border-white/10" :style="{ background: rampCss }" />

          <div class="mt-5 flex flex-wrap items-center gap-3">
            <UPopover v-for="(stop, i) in stops" :key="i">
              <button
                type="button"
                class="group relative size-12 cursor-pointer rounded-xl border border-white/15 transition-transform hover:scale-105"
                :style="{ background: stop }"
                :title="t('gradient.stop', { n: i + 1 })"
              >
                <span
                  v-if="stops.length > 2"
                  class="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-zinc-600 bg-black/90 text-dimmed opacity-0 transition-opacity hover:text-default group-hover:opacity-100"
                  role="button"
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
              class="size-12 justify-center rounded-xl border border-dashed border-zinc-600/60"
              :aria-label="t('gradient.addColor')"
              @click="addStop"
            />
          </div>
        </div>

        <div class="mt-4 grid gap-4 lg:grid-cols-2">
          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
            <label class="mb-2 block text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('gradient.textLabel') }}</label>
            <UInput v-model="text" size="lg" class="w-full" :placeholder="t('gradient.textPh')" />

            <div class="mt-5 grid grid-cols-2 gap-3">
              <div>
                <label class="mb-1 block text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('anim.name') }}</label>
                <UInput v-model="name" size="sm" class="w-full font-mono" />
              </div>
              <div>
                <label class="mb-1 block text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('anim.speed') }}</label>
                <UInput v-model.number="speed" type="number" size="sm" class="w-full font-mono" />
                <p class="mt-1 text-[10px] text-dimmed">{{ t('anim.speedHint') }}</p>
              </div>
            </div>

            <div class="mt-5">
              <div class="mb-2 text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('anim.style') }}</div>
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  v-for="s in ANIM_STYLES"
                  :key="s"
                  size="sm"
                  :variant="style === s ? 'subtle' : 'ghost'"
                  color="neutral"
                  :label="t(`anim.styles.${s}`)"
                  @click="style = s"
                />
              </div>
            </div>

            <div class="mt-5">
              <div class="mb-2 text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('colorCodes.formatsTitle') }}</div>
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  v-for="f in [
                    { key: 'bold', icon: 'i-lucide-bold' },
                    { key: 'italic', icon: 'i-lucide-italic' },
                    { key: 'underlined', icon: 'i-lucide-underline' },
                    { key: 'strikethrough', icon: 'i-lucide-strikethrough' },
                    { key: 'obfuscated', icon: 'i-lucide-shuffle' }
                  ]"
                  :key="f.key"
                  :icon="f.icon"
                  size="sm"
                  :variant="flags[f.key as keyof AnimStyleFlags] ? 'subtle' : 'ghost'"
                  color="neutral"
                  :title="t(`colorCodes.fmt.${f.key === 'underlined' ? 'underline' : f.key === 'strikethrough' ? 'strike' : f.key}`)"
                  :aria-label="f.key"
                  @click="flags[f.key as keyof AnimStyleFlags] = !flags[f.key as keyof AnimStyleFlags]"
                />
              </div>
            </div>

            <div class="mt-5">
              <div class="mb-2 text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('anim.format') }}</div>
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  v-for="f in ANIM_FORMATS"
                  :key="f"
                  size="sm"
                  class="font-mono"
                  :variant="format === f ? 'subtle' : 'ghost'"
                  color="neutral"
                  :label="FORMAT_LABEL[f]"
                  @click="format = f"
                />
              </div>
            </div>
          </div>

          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
            <div class="mb-2 flex items-center justify-between gap-4">
              <label class="text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('anim.template') }}</label>
              <UButton
                icon="i-lucide-rotate-ccw"
                size="xs"
                variant="ghost"
                color="neutral"
                :label="t('banner.reset')"
                @click="resetTemplate"
              />
            </div>

            <textarea
              v-model="template"
              rows="6"
              spellcheck="false"
              class="w-full resize-y rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs outline-none transition-colors focus:border-zinc-500"
            />

            <div class="mt-3 flex flex-col gap-1 text-xs text-dimmed">
              <span><code class="text-muted">%name%</code> · {{ t('anim.phName') }}</span>
              <span><code class="text-muted">%speed%</code> · {{ t('anim.phSpeed') }}</span>
              <span><code class="text-muted">%output:{ … $t … }%</code> · {{ t('anim.phOutput') }}</span>
            </div>
          </div>
        </div>

        <div class="mt-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-4">
            <div class="text-sm font-medium">{{ t('anim.output') }}</div>
            <div class="flex items-center gap-4">
              <span class="text-xs text-dimmed">{{ t('anim.frames', { n: frames.length }) }}</span>
              <UButton icon="i-lucide-copy" size="xs" variant="ghost" color="neutral" :label="t('colorCodes.copy')" @click="copy(output)" />
            </div>
          </div>
          <pre class="max-h-96 overflow-auto whitespace-pre rounded-2xl bg-black/40 p-4 font-mono text-xs text-muted">{{ output }}</pre>
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
