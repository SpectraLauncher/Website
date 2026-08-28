<script setup lang="ts">
const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'tick')!

useToolSeo('tick', 'ticks')

const num = (v: unknown) => (Array.isArray(v) ? Number(v[0]) : Number(v)) || 0

const ticks = ref(6000)
const value = computed(() => Math.max(0, Math.floor(num(ticks.value))))

const duration = computed(() => ticksToDuration(value.value))
const clock = computed(() => tickToClock(value.value))
const phase = computed(() => phaseAt(value.value))
const inDay = computed(() => dayTick(value.value))

const setUnit = (key: keyof Duration, v: number) => {
  const d = { ...duration.value, [key]: Math.max(0, Math.floor(v || 0)) }
  ticks.value = durationToTicks(d)
}

const period = ref(1200)
const rate = computed(() => perDay(Math.max(1, Math.floor(num(period.value)))))

const copy = async (v: string) => {
  await navigator.clipboard.writeText(v)
  toast.add({ title: t('colorCodes.copied', { value: v }), icon: 'i-lucide-check', color: 'success' })
}

const PHASE_COLOR: Record<string, string> = {
  day: '#7fb3f5',
  sunset: '#f0a05a',
  night: '#243456',
  sunrise: '#f2c66a'
}

const features = computed(() => (tm('ticks.features') as unknown[]).map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
})))

const faq = computed(() => (tm('ticks.faq') as unknown[]).map((x, i) => ({
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

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('ticks.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('ticks.sub') }}</p>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="grid gap-5 lg:grid-cols-[260px_1fr]">
            <div>
              <label class="mb-2 block text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('ticks.ticks') }}</label>
              <UInput v-model.number="ticks" type="number" size="lg" class="w-full font-mono" />

              <div class="mt-4 grid grid-cols-2 gap-2">
                <div v-for="u in (['days', 'hours', 'minutes', 'seconds'] as (keyof Duration)[])" :key="u">
                  <label class="mb-1 block text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t(`ticks.units.${u}`) }}</label>
                  <UInput
                    :model-value="duration[u]"
                    type="number"
                    size="sm"
                    class="w-full font-mono"
                    @update:model-value="setUnit(u, Number($event))"
                  />
                </div>
              </div>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div v-for="row in [
                { label: t('ticks.seconds'), value: ticksToSeconds(value).toFixed(2) },
                { label: t('ticks.mcDays'), value: mcDays(value).toFixed(3) },
                { label: t('ticks.clock'), value: clock.label, accent: true },
                { label: t('ticks.inDay'), value: inDay }
              ]" :key="row.label" class="rounded-2xl border border-white/10 bg-black/40 p-4">
                <div class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ row.label }}</div>
                <div class="font-mono" :class="row.accent ? 'text-2xl' : 'text-lg text-muted'">{{ row.value }}</div>
              </div>

              <div class="rounded-2xl border border-white/10 bg-black/40 p-4 sm:col-span-2">
                <div class="mb-2 text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('ticks.state') }}</div>
                <div class="flex flex-wrap items-center gap-4">
                  <span class="flex items-center gap-2 text-sm">
                    <span class="size-3 rounded-full" :style="{ background: PHASE_COLOR[phase.key] }" />
                    {{ t(`ticks.phases.${phase.key}`) }}
                  </span>
                  <span class="flex items-center gap-2 text-sm" :class="canSleep(value) ? 'text-success' : 'text-dimmed'">
                    <UIcon :name="canSleep(value) ? 'i-lucide-bed' : 'i-lucide-bed-single'" class="size-4" />
                    {{ canSleep(value) ? t('ticks.canSleep') : t('ticks.noSleep') }}
                  </span>
                  <span class="flex items-center gap-2 text-sm" :class="mobsSpawn(value) ? 'text-error' : 'text-dimmed'">
                    <UIcon name="i-lucide-ghost" class="size-4" />
                    {{ mobsSpawn(value) ? t('ticks.mobsYes') : t('ticks.mobsNo') }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-6">
            <div class="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-dimmed">
              <span>{{ t('ticks.cycle') }}</span>
              <span class="font-mono">{{ inDay }} / {{ TICKS_PER_DAY }}</span>
            </div>

            <div class="relative h-12 overflow-hidden rounded-xl border border-white/10">
              <div class="flex h-full">
                <div
                  v-for="p in DAY_PHASES"
                  :key="p.key"
                  class="h-full"
                  :style="{
                    width: `${(p.to - p.from + 1) / TICKS_PER_DAY * 100}%`,
                    background: PHASE_COLOR[p.key]
                  }"
                />
              </div>

              <div
                class="absolute inset-y-0 border-x border-white/40 bg-white/10"
                :style="{
                  left: `${SLEEP_FROM / TICKS_PER_DAY * 100}%`,
                  width: `${(SLEEP_TO - SLEEP_FROM) / TICKS_PER_DAY * 100}%`
                }"
              />

              <div
                class="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                :style="{ left: `${inDay / TICKS_PER_DAY * 100}%` }"
              />
            </div>

            <div class="mt-2 flex flex-wrap gap-4 text-[10px] text-dimmed">
              <span v-for="p in DAY_PHASES" :key="p.key" class="flex items-center gap-1.5">
                <span class="size-2 rounded-sm" :style="{ background: PHASE_COLOR[p.key] }" />
                {{ t(`ticks.phases.${p.key}`) }} · {{ p.from }}
              </span>
              <span class="flex items-center gap-1.5">
                <span class="size-2 rounded-sm border border-white/40 bg-white/10" />
                {{ t('ticks.sleepWindow') }} · {{ SLEEP_FROM }}–{{ SLEEP_TO }}
              </span>
            </div>
          </div>

          <div class="mt-6 flex flex-wrap items-center gap-2">
            <span class="mr-1 text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('gradient.presets') }}</span>
            <UButton
              v-for="p in TIME_PRESETS"
              :key="p.key"
              size="xs"
              :variant="inDay === p.ticks ? 'subtle' : 'ghost'"
              color="neutral"
              :label="t(`ticks.phasesShort.${p.key}`)"
              @click="ticks = p.ticks"
            />
          </div>

          <button
            type="button"
            class="mt-3 w-full cursor-pointer rounded-2xl border border-white/10 bg-black/40 p-4 text-left transition-colors hover:border-zinc-500"
            @click="copy(timeSetCommand(value))"
          >
            <div class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('ticks.command') }}</div>
            <div class="font-mono text-sm">{{ timeSetCommand(value) }}</div>
          </button>
        </div>

        <div class="mt-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="mb-2 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('ticks.rateTitle') }}</div>
          <p class="mb-4 max-w-[62ch] text-sm text-muted">{{ t('ticks.rateSub') }}</p>

          <div class="flex flex-wrap items-end gap-4">
            <div>
              <label class="mb-1 block text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('ticks.period') }}</label>
              <UInput v-model.number="period" type="number" class="w-32 font-mono" />
            </div>
            <div class="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
              <div class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('ticks.perDay') }}</div>
              <div class="font-mono text-lg">{{ rate.toFixed(1) }}</div>
            </div>
            <div class="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
              <div class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('ticks.everySeconds') }}</div>
              <div class="font-mono text-lg">{{ ticksToSeconds(Math.max(1, Math.floor(num(period)))).toFixed(2) }} s</div>
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
