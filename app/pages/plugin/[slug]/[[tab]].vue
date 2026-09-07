<script setup lang="ts">
import type { CatalogProjectData } from '~/components/CatalogProject.vue'

definePageMeta({ middleware: 'catalog' })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

const slug = computed(() => String(route.params.slug ?? ''))
const tab = computed(() => String(route.params.tab ?? ''))

const { data, error } = await useFetch<{
  project: CatalogProjectData
  listed: boolean
  gallery: Array<{ id: string, url: string, title: string, featured: boolean }>
}>(
  () => `/api/catalog/project/${encodeURIComponent(slug.value)}`)

const project = computed(() => data.value?.project ?? null)
useSeoMeta({
  title: () => project.value?.title ?? t('catalog.notFound'),
  description: () => project.value?.summary || markdownExcerpt(project.value?.description ?? ''),
  ogTitle: () => project.value?.title ?? '',
  ogDescription: () => project.value?.summary ?? '',
  robots: () => (project.value && data.value?.listed !== false ? 'index, follow' : 'noindex'),
})
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <CatalogProject
        v-if="project"
        :project="project"
        icon="i-pixelarticons-plug"
        :gallery="data?.gallery ?? []"
        :tab="tab"
        :back-to="'/plugin'"
        :back-label="t('catalog.plugins.title')"
      />

      <section v-else-if="error" class="container mx-auto max-w-2xl px-4 py-40 text-center">
        <h1 class="text-2xl font-semibold">{{ t('catalog.notFound') }}</h1>
        <UButton class="mt-6" :to="localePath('/plugin')" :label="t('catalog.plugins.title')" />
      </section>
    </div>
  </div>
</template>
