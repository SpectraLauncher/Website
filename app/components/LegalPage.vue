<script setup lang="ts">

const props = defineProps<{ section: string }>()

const { t, tm, rt } = useI18n()

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
  body: lines((entry as { body: unknown[] }).body)
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
        <h1 class="mb-3 text-4xl font-semibold tracking-tight md:text-5xl">{{ t(`${section}.title`) }}</h1>
        <p class="mb-2 text-lg/relaxed text-muted">{{ fill(t(`${section}.intro`)) }}</p>
        <p class="mb-10 text-xs text-dimmed">{{ updated }}</p>

        <div class="space-y-8">
          <section v-for="(part, index) in sections" :key="index">
            <h2 class="mb-3 text-xl font-semibold tracking-tight">{{ part.title }}</h2>
            <div class="space-y-3">
              <p v-for="(line, i) in part.body" :key="i" class="text-sm/relaxed text-muted">{{ line }}</p>
            </div>
          </section>
        </div>

        <slot />
      </section>
    </div>
  </div>
</template>
