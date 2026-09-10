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
const latest = computed(() => project.value?.versions[0] ?? null)
const meta = computed(() => latest.value?.meta ?? {})

const previewUrl = computed(() => {
  const url = meta.value.preview
  return typeof url === 'string' && url ? url : null
})

const materials = computed(() =>
  (Array.isArray(meta.value.materials) ? meta.value.materials : []) as Array<{
    item: string
    count: number
  }>)

const size = computed(() => {
  const s = meta.value.size
  return s && typeof s === 'object' ? `${s.x} × ${s.y} × ${s.z}` : null
})

const count = (n: number) => new Intl.NumberFormat().format(n)
const itemName = (id: string) => id.replace('minecraft:', '').replace(/_/g, ' ')

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
      icon="i-pixelarticons-blocks"
      :gallery="data?.gallery ?? []"
      :tab="parts.tab"
      :version-id="parts.versionId"
      :back-to="'/schematic'"
      :back-label="t('catalog.schematics.title')"
    >
      <template #lead>
        <ProjectSchematicViewer v-if="previewUrl" :src="previewUrl" />
      </template>

      <template #sidebar>
        <UiPanel v-if="size || meta.blockCount" class="p-5">
          <h2 class="mb-3 text-[11px] font-bold uppercase tracking-[0.09em] text-dimmed">
            {{ t('catalog.schematic.details') }}
          </h2>
          <dl class="space-y-2 text-sm">
            <div v-if="size" class="flex justify-between gap-4">
              <dt class="text-dimmed">{{ t('catalog.schematic.size') }}</dt>
              <dd class="font-mono text-default">{{ size }}</dd>
            </div>
            <div v-if="meta.blockCount" class="flex justify-between gap-4">
              <dt class="text-dimmed">{{ t('catalog.schematic.blocks') }}</dt>
              <dd class="font-mono text-default">{{ count(meta.blockCount) }}</dd>
            </div>
            <div v-if="meta.format" class="flex justify-between gap-4">
              <dt class="text-dimmed">{{ t('catalog.schematic.format') }}</dt>
              <dd class="font-mono text-default">{{ meta.format }}</dd>
            </div>
          </dl>
        </UiPanel>

        <UiPanel v-if="materials.length" class="p-5">
          <h2 class="mb-3 text-[11px] font-bold uppercase tracking-[0.09em] text-dimmed">
            {{ t('catalog.schematic.materials') }}
          </h2>
          <ul class="space-y-1.5 text-sm">
            <li
              v-for="material in materials"
              :key="material.item"
              class="flex items-baseline justify-between gap-4"
            >
              <span class="truncate capitalize text-muted">{{ itemName(material.item) }}</span>
              <span class="shrink-0 font-mono text-dimmed">{{ count(material.count) }}</span>
            </li>
          </ul>
        </UiPanel>
      </template>
    </CatalogProject>

    <UiPanel v-else-if="error" class="mx-auto max-w-lg p-12 text-center">
      <UIcon name="i-pixelarticons-package" class="mx-auto size-10 text-dimmed" />
      <h1 class="mt-3 text-xl font-bold text-highlighted">{{ t('catalog.notFound') }}</h1>
      <UButton class="mt-6" :to="localePath('/schematic')" :label="t('catalog.schematics.title')" />
    </UiPanel>
  </UiPageShell>
</template>
