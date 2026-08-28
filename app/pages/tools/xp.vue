<script setup lang="ts">
const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'xp')!

useToolSeo('xp', 'xp')

const level = ref(30)
const points = ref(1395)
const editing = ref<'level' | 'points'>('level')

watch(level, (v) => {
  if (editing.value === 'level') points.value = totalXpForLevel(v)
})
watch(points, (v) => {
  if (editing.value === 'points') level.value = levelFromXp(v).level
})

const fromPoints = computed(() => levelFromXp(points.value))
const nextCost = computed(() => xpToNextLevel(level.value))

const fromLevel = ref(0)
const toLevel = ref(30)
const between = computed(() => xpBetweenLevels(fromLevel.value, toLevel.value))
const bottles = computed(() => bottlesFor(between.value))

const groups = computed(() => (['mobs', 'blocks', 'smelting', 'other'] as const).map(g => ({
  key: g,
  sources: XP_SOURCES.filter(s => s.group === g)
})))

const amount = (s: XpSource) => (s.min === s.max ? String(s.min) : `${s.min}–${s.max}`)

const copy = async (value: string) => {
  await navigator.clipboard.writeText(value)
  toast.add({ title: t('colorCodes.copied', { value }), icon: 'i-lucide-check', color: 'success' })
}

const faq = computed(() => (tm('xp.faq') as unknown[]).map((x, i) => ({
  value: String(i),
  label: rt((x as { q: string }).q),
  content: rt((x as { a: string }).a)
})))

const features = computed(() => (tm('xp.features') as unknown[]).map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
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

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('xp.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('xp.sub') }}</p>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="mb-5 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('xp.convertTitle') }}</div>

          <div class="grid items-end gap-5 sm:grid-cols-[1fr_auto_1fr]">
            <div>
              <label class="mb-2 block text-sm text-muted">{{ t('xp.level') }}</label>
              <UInput
                v-model.number="level"
                type="number"
                size="lg"
                class="w-full font-mono"
                @focus="editing = 'level'"
              />
            </div>

            <div class="grid place-items-center pb-3">
              <UIcon name="i-lucide-arrow-left-right" class="size-5 text-dimmed" />
            </div>

            <div>
              <label class="mb-2 block text-sm text-muted">{{ t('xp.points') }}</label>
              <UInput
                v-model.number="points"
                type="number"
                size="lg"
                class="w-full font-mono"
                @focus="editing = 'points'"
              />
            </div>
          </div>

          <div class="mt-5 rounded-2xl bg-[#101010] p-4">
            <div class="mb-2 flex items-end justify-between">
              <span class="font-mono text-2xl font-bold text-[#80FF20]" style="text-shadow: 2px 2px 0 #0b1504">{{ fromPoints.level }}</span>
              <span class="text-xs text-dimmed">
                {{ t('xp.intoLevel', { into: fromPoints.intoLevel, span: nextCost }) }}
              </span>
            </div>
            <div class="h-4 overflow-hidden rounded border border-black/60 bg-[#0b1504]">
              <div
                class="h-full bg-[#80FF20] transition-[width] duration-300"
                :style="{ width: `${Math.min(100, fromPoints.progress * 100)}%` }"
              />
            </div>
            <div class="mt-2 text-xs text-dimmed">{{ t('xp.toNext', { n: fromPoints.toNext }) }}</div>
          </div>
        </div>

        <div class="mt-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="mb-5 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('xp.betweenTitle') }}</div>

          <div class="grid items-end gap-4 sm:grid-cols-[1fr_1fr_2fr]">
            <div>
              <label class="mb-2 block text-sm text-muted">{{ t('xp.fromLevel') }}</label>
              <UInput v-model.number="fromLevel" type="number" size="lg" class="w-full font-mono" />
            </div>
            <div>
              <label class="mb-2 block text-sm text-muted">{{ t('xp.toLevel') }}</label>
              <UInput v-model.number="toLevel" type="number" size="lg" class="w-full font-mono" />
            </div>
            <button
              type="button"
              class="cursor-pointer rounded-2xl border border-white/10 bg-black/40 p-4 text-left transition-colors hover:border-zinc-500"
              @click="copy(String(between))"
            >
              <div class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ t('xp.needed') }}</div>
              <div class="font-mono text-2xl">{{ between }}</div>
            </button>
          </div>

          <div class="mt-5 grid gap-3 sm:grid-cols-3">
            <div v-for="b in [
              { label: t('xp.bottlesAvg'), value: bottles.average, accent: true },
              { label: t('xp.bottlesBest'), value: bottles.best },
              { label: t('xp.bottlesWorst'), value: bottles.worst }
            ]" :key="b.label" class="rounded-2xl border border-white/10 bg-black/40 p-4">
              <div class="text-[10px] uppercase tracking-[0.12em] text-dimmed">{{ b.label }}</div>
              <div class="font-mono" :class="b.accent ? 'text-xl' : 'text-sm text-muted'">{{ b.value }}</div>
            </div>
          </div>
          <p class="mt-3 text-xs text-dimmed">{{ t('xp.bottleHint') }}</p>
        </div>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <h2 v-reveal class="mb-5 text-2xl font-semibold tracking-tight">{{ t('xp.sourcesTitle') }}</h2>

        <div class="grid gap-4 md:grid-cols-2">
          <div
            v-for="g in groups"
            :key="g.key"
            class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm"
          >
            <div class="mb-4 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t(`xp.groups.${g.key}`) }}</div>
            <div class="flex flex-col">
              <div
                v-for="s in g.sources"
                :key="s.key"
                class="flex items-center justify-between gap-4 border-b border-white/[0.06] py-2 last:border-b-0"
              >
                <span class="text-sm text-muted">{{ t(`xp.sources.${s.key}`) }}</span>
                <span class="shrink-0 font-mono text-sm text-[#80FF20]">{{ amount(s) }}</span>
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
