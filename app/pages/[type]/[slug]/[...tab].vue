<script setup lang="ts">
import type { CatalogProjectData } from '~/components/catalog/Project.vue'

definePageMeta({ middleware: 'catalog' })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

// This page answers any first segment, so an unknown one has to be refused
// rather than fetched as a project nobody named.
const info = catalogTypeByPrefix(route.params.type)
if (!info) throw createError({ statusCode: 404, statusMessage: 'no such listing' })

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

// The URL says which type this is; the project says which type it is. When they
// disagree the project wins and the address is corrected, permanently, so the
// same project cannot be indexed once per prefix.
const canonical = canonicalProjectPath(info!.prefix, data.value?.project.path ?? '', parts.value)
if (canonical) await navigateTo(localePath(canonical), { redirectCode: 301, replace: true })

// Only a schematic has a preview and a bill of materials, and both are read out
// of the newest version's meta at upload.
const schematicMeta = computed(() =>
  (project.value?.type === 'schematic' ? project.value.versions[0]?.meta : null) ?? null)

const previewUrl = computed(() => {
  const url = schematicMeta.value?.preview
  return typeof url === 'string' && url ? url : null
})

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
      :icon="info!.icon"
      :gallery="data?.gallery ?? []"
      :tab="parts.tab"
      :version-id="parts.versionId"
      :back-to="`/${info!.prefix}`"
      :back-label="t(`catalog.${info!.key}.title`)"
    >
      <template v-if="previewUrl" #lead>
        <ProjectSchematicViewer :src="previewUrl" />
      </template>

      <template v-if="schematicMeta" #sidebar>
        <ProjectSchematicFacts :meta="schematicMeta" />
      </template>
    </CatalogProject>

    <UiPanel v-else-if="error" class="mx-auto max-w-lg p-12 text-center">
      <UIcon name="i-pixelarticons-package" class="mx-auto size-10 text-dimmed" />
      <h1 class="mt-3 text-xl font-bold text-highlighted">{{ t('catalog.notFound') }}</h1>
      <UButton
        class="mt-6"
        :to="localePath(`/${info!.prefix}`)"
        :label="t(`catalog.${info!.key}.title`)"
      />
    </UiPanel>
  </UiPageShell>
</template>
