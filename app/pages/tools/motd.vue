<script setup lang="ts">
const localePath = useLocalePath()

const { t, tm, rt } = useI18n()

const tool = TOOLS.find(x => x.id === 'motd')!

useToolSeo('motd', 'motd')

const steps = computed(() => (tm('motd.steps') as unknown[]).map((s, i) => ({
  n: String(i + 1).padStart(2, '0'),
  title: rt((s as { title: string }).title),
  body: rt((s as { body: string }).body)
})))

const faq = computed(() => (tm('motd.faq') as unknown[]).map((x, i) => ({
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

        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('motd.title') }}</h1>
        <p class="max-w-[64ch] text-lg text-muted">{{ t('motd.sub') }}</p>
      </section>

      <section class="container mx-auto px-4 pb-16">
        <MotdEditor />
      </section>

      <section class="container mx-auto px-4 pb-16">
        <h2 v-reveal class="mb-5 text-2xl font-semibold tracking-tight">{{ t('motd.howTitle') }}</h2>
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
