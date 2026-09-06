<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('docs.title'),
  description: () => t('docs.intro'),
})
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="mx-auto max-w-5xl px-4 pb-24 pt-40">
        <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">{{ t('docs.title') }}</h1>
        <p class="mt-3 max-w-prose text-muted">{{ t('docs.intro') }}</p>

        <div class="mt-10 grid gap-4 sm:grid-cols-2">
          <div
            v-for="section in DOC_SECTIONS"
            :key="section.id"
            class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
          >
            <h2 class="mb-1 flex items-center gap-2 text-lg font-semibold">
              <UIcon :name="section.icon" class="size-5 text-primary" />
              {{ t(`docs.sections.${section.id}`) }}
            </h2>
            <p class="mb-4 text-sm text-muted">{{ t(`docs.sectionHints.${section.id}`) }}</p>

            <ul class="space-y-1.5">
              <li v-for="slug in section.pages" :key="slug">
                <NuxtLink
                  :to="localePath(`/docs/${slug}`)"
                  class="group flex items-start gap-2 text-sm transition-colors hover:text-highlighted"
                >
                  <UIcon
                    name="i-lucide-chevron-right"
                    class="mt-0.5 size-3.5 shrink-0 text-dimmed transition-transform group-hover:translate-x-0.5"
                  />
                  <span class="min-w-0">
                    <span class="block font-medium">{{ t(`docs.pages.${slug}.title`) }}</span>
                    <span class="block text-xs text-dimmed">{{ t(`docs.pages.${slug}.summary`) }}</span>
                  </span>
                </NuxtLink>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
