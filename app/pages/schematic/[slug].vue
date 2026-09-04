<script setup lang="ts">
import type { CatalogProjectData } from '~/components/CatalogProject.vue'

definePageMeta({ middleware: 'catalog' })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

const slug = computed(() => String(route.params.slug ?? ''))

const { data, error } = await useFetch<{ project: CatalogProjectData, listed: boolean }>(
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
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <CatalogProject
        v-if="project"
        :project="project"
        icon="i-lucide-blocks"
        :back-to="'/schematic'"
        :back-label="t('catalog.schematics.title')"
      >
        <template #lead>
          <SchematicViewer v-if="previewUrl" :src="previewUrl" />
        </template>

        <template #sidebar>
          <div
            v-if="size || meta.blockCount"
            class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
          >
            <h2 class="text-lg font-semibold">{{ t('catalog.schematic.details') }}</h2>
            <dl class="mt-4 space-y-2 text-sm">
              <div v-if="size" class="flex justify-between gap-4">
                <dt class="text-dimmed">{{ t('catalog.schematic.size') }}</dt>
                <dd class="font-mono">{{ size }}</dd>
              </div>
              <div v-if="meta.blockCount" class="flex justify-between gap-4">
                <dt class="text-dimmed">{{ t('catalog.schematic.blocks') }}</dt>
                <dd class="font-mono">{{ count(meta.blockCount) }}</dd>
              </div>
              <div v-if="meta.format" class="flex justify-between gap-4">
                <dt class="text-dimmed">{{ t('catalog.schematic.format') }}</dt>
                <dd class="font-mono">{{ meta.format }}</dd>
              </div>
            </dl>
          </div>

          <div
            v-if="materials.length"
            class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
          >
            <h2 class="text-lg font-semibold">{{ t('catalog.schematic.materials') }}</h2>
            <ul class="mt-4 space-y-1.5 text-sm">
              <li
                v-for="material in materials"
                :key="material.item"
                class="flex items-baseline justify-between gap-4"
              >
                <span class="truncate capitalize text-muted">{{ itemName(material.item) }}</span>
                <span class="shrink-0 font-mono text-dimmed">{{ count(material.count) }}</span>
              </li>
            </ul>
          </div>
        </template>
      </CatalogProject>

      <section v-else-if="error" class="container mx-auto max-w-2xl px-4 py-40 text-center">
        <h1 class="text-2xl font-semibold">{{ t('catalog.notFound') }}</h1>
        <UButton class="mt-6" :to="localePath('/schematic')" :label="t('catalog.schematics.title')" />
      </section>
    </div>
  </div>
</template>
