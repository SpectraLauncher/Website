<script setup lang="ts">

const props = defineProps<{ section: string }>()

const { t, tm, rt } = useI18n()

const localePath = useLocalePath()

const config = useRuntimeConfig().public

const fill = (text: string) => text
  .replace(/%CONTROLLER%/g, String(config.controller || '—'))
  .replace(/%EMAIL%/g, String(config.contactEmail || '—'))

const list = (key: string) => {
  const value = tm(key)
  return Array.isArray(value) ? (value as unknown[]) : []
}

const sections = computed(() => list(`${props.section}.sections`).map(entry => ({
  title: fill(rt((entry as { title: string }).title)),
  body: lines((entry as { body: unknown[] }).body),
  points: lines((entry as { points?: unknown[] }).points)
})))

function lines(value: unknown) {
  return Array.isArray(value) ? value.map(v => fill(rt(v as string))) : []
}

const updated = computed(() => t(`${props.section}.updated`))

const seoTitle = computed(() => `${t(`${props.section}.title`)}`)
const seoDescription = computed(() => fill(t(`${props.section}.intro`)))

defineOgImage('Spectra', {
  title: () => t(`${props.section}.title`),
  description: () => seoDescription.value
})

useSeoMeta({
  title: () => seoTitle.value,
  description: () => seoDescription.value,
  ogTitle: () => seoTitle.value,
  ogDescription: () => seoDescription.value,
  twitterTitle: () => seoTitle.value,
  twitterDescription: () => seoDescription.value
})
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-3xl px-4 pb-24 pt-40">
        <NuxtLink
          :to="localePath('/legal')"
          class="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-default"
        >
          <UIcon name="i-pixelarticons-arrow-left" class="size-4" />
          {{ t('legal.title') }}
        </NuxtLink>

        <h1 class="mb-3 text-4xl font-semibold tracking-tight md:text-5xl">{{ t(`${section}.title`) }}</h1>
        <p class="mb-2 text-lg/relaxed text-muted">{{ fill(t(`${section}.intro`)) }}</p>
        <p class="mb-10 text-xs text-dimmed">{{ updated }}</p>

        <div class="space-y-8">
          <section v-for="(part, index) in sections" :key="index">
            <h2 class="mb-3 text-xl font-semibold tracking-tight">{{ part.title }}</h2>
            <div class="space-y-3">
              <p v-for="(line, i) in part.body" :key="i" class="text-sm/relaxed text-muted">{{ line }}</p>
            </div>
            <ul v-if="part.points.length" class="mt-3 space-y-2">
              <li
                v-for="(point, i) in part.points"
                :key="i"
                class="flex gap-2.5 text-sm/relaxed text-muted"
              >
                <UIcon name="i-pixelarticons-circle" class="mt-0.5 size-4 shrink-0 text-dimmed" />
                <span class="min-w-0 break-words">{{ point }}</span>
              </li>
            </ul>
          </section>
        </div>

        <slot />

        <nav class="mt-16 border-t border-white/10 pt-8">
          <p class="mb-4 text-sm font-semibold">{{ t('legal.others') }}</p>
          <div class="flex flex-wrap gap-2">
            <NuxtLink
              v-for="doc in LEGAL_DOCUMENTS.filter(d => d.id !== section)"
              :key="doc.id"
              :to="localePath(doc.path)"
              class="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-muted transition-colors hover:border-white/20 hover:text-default"
            >
              <UIcon :name="doc.icon" class="size-3.5" />
              {{ t(`${doc.id}.title`) }}
            </NuxtLink>
          </div>
        </nav>
      </section>
    </div>
  </div>
</template>
