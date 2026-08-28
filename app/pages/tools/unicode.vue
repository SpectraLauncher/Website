<script setup lang="ts">
const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'unicode')!

useToolSeo('unicode', 'unicode')

const query = ref('')
const asEscape = ref(false)

const mcOnly = ref(true)

const groups = computed(() => {
  const q = query.value.trim().toLowerCase()
  const all = SYMBOL_GROUPS
    .filter(g => !mcOnly.value || g.mc)
    .map(g => ({
      key: g.key,
      label: t(`unicode.groups.${g.key}`),
      mc: g.mc,
      symbols: g.symbols
    }))

  if (!q) return all

  return all
    .map(g => ({
      ...g,
      symbols: g.label.toLowerCase().includes(q)
        ? g.symbols
        : g.symbols.filter(s => s === q || codePoint(s).toLowerCase().includes(q))
    }))
    .filter(g => g.symbols.length)
})

const found = computed(() => groups.value.reduce((n, g) => n + g.symbols.length, 0))

const copy = async (symbol: string) => {
  const value = asEscape.value ? escapeSeq(symbol) : symbol
  await navigator.clipboard.writeText(value)
  toast.add({ title: t('colorCodes.copied', { value }), icon: 'i-lucide-check', color: 'success' })
}

const features = computed(() => (tm('unicode.features') as unknown[]).map(x => ({
  title: rt((x as { title: string }).title),
  body: rt((x as { body: string }).body)
})))

const faq = computed(() => (tm('unicode.faq') as unknown[]).map((x, i) => ({
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

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('unicode.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('unicode.sub') }}</p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <UInput
            v-model="query"
            icon="i-lucide-search"
            size="lg"
            :placeholder="t('unicode.searchPh')"
            class="w-full sm:w-80"
          />
          <UButton
            :variant="asEscape ? 'subtle' : 'ghost'"
            color="neutral"
            size="lg"
            class="rounded-xl"
            icon="i-lucide-code"
            :label="t('unicode.escapeMode')"
            @click="asEscape = !asEscape"
          />
          <UButton
            :variant="mcOnly ? 'subtle' : 'ghost'"
            color="neutral"
            size="lg"
            class="rounded-xl"
            icon="i-lucide-gamepad-2"
            :label="t('unicode.mcOnly')"
            :title="t('unicode.mcOnlyHint')"
            @click="mcOnly = !mcOnly"
          />
          <span class="text-sm text-dimmed">{{ t('unicode.count', { n: found }) }}</span>
        </div>
        <p class="mt-3 text-sm text-muted">
          {{ asEscape ? t('unicode.escapeOn') : t('unicode.escapeOff') }}
        </p>
      </section>

      <section v-if="!query" class="container mx-auto px-4 pb-14">
        <h2 v-reveal class="mb-5 text-2xl font-semibold tracking-tight">{{ t('unicode.popularTitle') }}</h2>
        <div class="grid grid-cols-6 gap-2 sm:grid-cols-9 lg:grid-cols-12">
          <button
            v-for="s in POPULAR"
            :key="s"
            type="button"
            class="group cursor-pointer rounded-xl border border-zinc-600/50 bg-black/30 py-4 backdrop-blur-sm transition-colors hover:border-zinc-500"
            :title="codePoint(s)"
            @click="copy(s)"
          >
            <div class="text-2xl leading-none">{{ s }}</div>
          </button>
        </div>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <h2 v-reveal class="mb-5 text-2xl font-semibold tracking-tight">{{ t('unicode.allTitle') }}</h2>

        <div v-if="!groups.length" class="rounded-3xl border border-zinc-600/50 bg-black/30 py-20 text-center backdrop-blur-sm">
          <UIcon name="i-lucide-search-x" class="mx-auto mb-3 size-8 text-dimmed" />
          <p class="text-muted">{{ t('toolsPage.empty') }}</p>
        </div>

        <div v-else class="flex flex-col gap-10">
          <div v-for="g in groups" :key="g.key">
            <div class="mb-4 flex items-center gap-4">
              <h3 class="text-lg font-semibold tracking-tight">{{ g.label }}</h3>
              <UBadge v-if="!g.mc" variant="subtle" size="sm" :label="t('unicode.notInMc')" />
              <div class="h-px flex-1 bg-zinc-600/50" />
              <span class="text-sm text-dimmed">{{ g.symbols.length }}</span>
            </div>

            <div class="grid grid-cols-6 gap-2 sm:grid-cols-9 lg:grid-cols-12">
              <button
                v-for="s in g.symbols"
                :key="s"
                type="button"
                class="cursor-pointer rounded-xl border border-zinc-600/50 bg-black/30 py-3 backdrop-blur-sm transition-colors hover:border-zinc-500"
                :title="codePoint(s)"
                @click="copy(s)"
              >
                <div class="text-xl leading-none">{{ s }}</div>
                <div class="mt-1 font-mono text-[10px] text-dimmed">{{ codePoint(s).replace('U+', '') }}</div>
              </button>
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
