<script setup lang="ts">
const localePath = useLocalePath()

const { t, tm, rt } = useI18n()
const toast = useToast()

const tool = TOOLS.find(x => x.id === 'color-codes')!

useToolSeo('color-codes', 'colorCodes')

const copy = async (value: string) => {
  await navigator.clipboard.writeText(value)
  toast.add({ title: t('colorCodes.copied', { value }), icon: 'i-lucide-check', color: 'success' })
}

const steps = computed(() => (tm('colorCodes.steps') as unknown[]).map((s, i) => ({
  n: String(i + 1).padStart(2, '0'),
  title: rt((s as { title: string }).title),
  body: rt((s as { body: string }).body)
})))

const faq = computed(() => (tm('colorCodes.faq') as unknown[]).map((f, i) => ({
  value: String(i),
  label: rt((f as { q: string }).q),
  content: rt((f as { a: string }).a)
})))
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>
      <div
        class="pointer-events-none absolute -z-10 size-[420px] rounded-full opacity-25 blur-3xl"
        :style="`top: 60px; left: 50%; transform: translateX(-50%); background: hsl(${tool.glow} 90% 55% / 0.4)`"
      ></div>

      <section class="container mx-auto px-4 pb-14 pt-48">
        <NuxtLink :to="localePath('/tools')" class="group mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-default">
          <UIcon name="i-lucide-arrow-left" class="size-4 transition-transform duration-300 group-hover:-translate-x-1" />
          {{ t('toolsPage.title') }}
        </NuxtLink>

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('colorCodes.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('colorCodes.sub') }}</p>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <h2 v-reveal class="mb-5 text-2xl font-semibold tracking-tight">{{ t('colorCodes.colorsTitle') }}</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="c in MC_COLORS"
            :key="c.code"
            class="group flex items-center gap-3 rounded-2xl border border-zinc-600/50 bg-black/30 p-3 backdrop-blur-sm transition-colors hover:border-zinc-500"
          >
            <div class="size-11 shrink-0 rounded-xl border border-white/10" :style="{ background: c.hex }" />
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium">{{ c.name }}</div>
              <div class="font-mono text-xs text-dimmed">{{ c.hex }}</div>
            </div>
            <div class="flex shrink-0 gap-1">
              <UButton
                v-for="sym in ['§', '&']"
                :key="sym"
                size="xs"
                variant="ghost"
                color="neutral"
                class="font-mono"
                :label="`${sym}${c.code}`"
                @click="copy(`${sym}${c.code}`)"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <h2 v-reveal class="mb-5 text-2xl font-semibold tracking-tight">{{ t('colorCodes.formatsTitle') }}</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="f in MC_FORMATS"
            :key="f.code"
            class="flex items-center gap-3 rounded-2xl border border-zinc-600/50 bg-black/30 p-4 backdrop-blur-sm transition-colors hover:border-zinc-500"
          >
            <UIcon :name="f.icon" class="size-5 shrink-0 text-muted" />
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium">{{ t(`colorCodes.fmt.${f.key}`) }}</div>
              <div class="truncate text-xs text-dimmed">{{ t(`colorCodes.fmtHint.${f.key}`) }}</div>
            </div>
            <div class="flex shrink-0 gap-1">
              <UButton
                v-for="sym in ['§', '&']"
                :key="sym"
                size="xs"
                variant="ghost"
                color="neutral"
                class="font-mono"
                :label="`${sym}${f.code}`"
                @click="copy(`${sym}${f.code}`)"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <h2 v-reveal class="mb-2 text-2xl font-semibold tracking-tight">{{ t('colorCodes.genTitle') }}</h2>
        <p v-reveal class="mb-6 max-w-[62ch] text-muted">{{ t('colorCodes.genSub') }}</p>
        <McTextGenerator />
      </section>

      <section class="container mx-auto px-4 pb-16">
        <h2 v-reveal class="mb-5 text-2xl font-semibold tracking-tight">{{ t('colorCodes.howTitle') }}</h2>
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
