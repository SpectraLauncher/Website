<script setup lang="ts">
import type { CatalogProjectData } from '~/components/catalog/Project.vue'

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
    <SiteNavbar />

    <div class="relative">
      <ProjectBackdrop :gallery="data?.gallery ?? []" />

      <CatalogProject
        v-if="project"
        :project="project"
        icon="i-pixelarticons-shapes"
        :gallery="data?.gallery ?? []"
        :tab="tab"
        :back-to="'/mod'"
        :back-label="t('catalog.mods.title')"
      />

      <section v-else-if="error" class="container mx-auto max-w-2xl px-4 py-40 text-center">
        <h1 class="text-2xl font-semibold">{{ t('catalog.notFound') }}</h1>
        <UButton class="mt-6" :to="localePath('/mod')" :label="t('catalog.mods.title')" />
      </section>
    </div>
  </div>
</template>
