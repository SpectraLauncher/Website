<script setup lang="ts">
import type { CatalogProjectData } from '~/components/catalog/Project.vue'

definePageMeta({ middleware: 'catalog' })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

const slug = computed(() => String(route.params.slug ?? ''))
// /mod/x, /mod/x/versions and /mod/x/version/<id> all land here.
const parts = computed(() => projectRouteParts(route.params.tab))

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
  <UiPageShell>
    <CatalogProject
      v-if="project"
      :project="project"
      icon="i-pixelarticons-shapes"
      :gallery="data?.gallery ?? []"
      :tab="parts.tab"
      :version-id="parts.versionId"
      :back-to="'/mod'"
      :back-label="t('catalog.mods.title')"
    />

    <UiPanel v-else-if="error" class="mx-auto max-w-lg p-12 text-center">
      <UIcon name="i-pixelarticons-package" class="mx-auto size-10 text-dimmed" />
      <h1 class="mt-3 text-xl font-bold text-highlighted">{{ t('catalog.notFound') }}</h1>
      <UButton class="mt-6" :to="localePath('/mod')" :label="t('catalog.mods.title')" />
    </UiPanel>
  </UiPageShell>
</template>
