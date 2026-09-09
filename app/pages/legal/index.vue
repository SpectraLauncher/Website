<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('legal.title'),
  description: () => t('legal.intro'),
})

defineOgImage('Spectra', {
  title: () => t('legal.title'),
  description: () => t('legal.intro'),
})
</script>

<template>
  <div>
    <SiteNavbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-3xl px-4 pb-24 pt-40">
        <h1 class="mb-3 text-4xl font-semibold tracking-tight md:text-5xl">{{ t('legal.title') }}</h1>
        <p class="mb-10 text-lg/relaxed text-muted">{{ t('legal.intro') }}</p>

        <ul class="space-y-3">
          <li v-for="doc in LEGAL_DOCUMENTS" :key="doc.id">
            <NuxtLink
              :to="localePath(doc.path)"
              class="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-white/20"
            >
              <UIcon :name="doc.icon" class="mt-0.5 size-5 shrink-0 text-primary" />
              <span class="min-w-0">
                <span class="block font-semibold">{{ t(`${doc.id}.title`) }}</span>
                <span class="mt-1 block text-sm/relaxed text-muted">{{ t(`legal.summaries.${doc.id}`) }}</span>
                <span class="mt-2 block text-xs text-dimmed">{{ t(`${doc.id}.updated`) }}</span>
              </span>
              <UIcon
                name="i-pixelarticons-chevron-right"
                class="mt-1 size-4 shrink-0 text-dimmed transition-transform group-hover:translate-x-0.5"
              />
            </NuxtLink>
          </li>
        </ul>

        <p class="mt-10 text-sm/relaxed text-dimmed">{{ t('legal.contact') }}</p>
      </section>
    </div>
  </div>
</template>
