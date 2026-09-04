<script setup lang="ts">
import type { CatalogProjectData } from '~/components/CatalogProject.vue'

definePageMeta({ middleware: 'catalog' })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

const slug = computed(() => String(route.params.slug ?? ''))

const { data, error } = await useFetch<{ project: CatalogProjectData }>(
  () => `/api/catalog/project/${encodeURIComponent(slug.value)}`)

const project = computed(() => data.value?.project ?? null)
const latest = computed(() => project.value?.versions[0] ?? null)
const meta = computed(() => latest.value?.meta ?? {})

useSeoMeta({
  title: () => project.value?.title ?? t('catalog.notFound'),
  description: () => project.value?.summary || markdownExcerpt(project.value?.description ?? ''),
  ogTitle: () => project.value?.title ?? '',
  ogDescription: () => project.value?.summary ?? '',
  robots: () => (project.value ? 'index, follow' : 'noindex'),
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
        icon="i-lucide-image"
        :back-to="'/resourcepack'"
        :back-label="t('catalog.resourcepacks.title')"
      >
        <template #sidebar>
          <div
            v-if="project.gameVersions.length || project.loaders.length || meta.packFormat"
            class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
          >
            <h2 class="text-lg font-semibold">{{ t('catalog.compatibility') }}</h2>
            <dl class="mt-4 space-y-2 text-sm">
              <div v-if="project.loaders.length" class="flex justify-between gap-4">
                <dt class="shrink-0 text-dimmed">{{ t('catalog.loaders') }}</dt>
                <dd class="text-right">{{ project.loaders.join(', ') }}</dd>
              </div>
              <div v-if="project.gameVersions.length" class="flex justify-between gap-4">
                <dt class="shrink-0 text-dimmed">{{ t('catalog.gameVersions') }}</dt>
                <dd class="text-right font-mono text-xs">{{ project.gameVersions.join(', ') }}</dd>
              </div>
              <div v-if="meta.packFormat" class="flex justify-between gap-4">
                <dt class="text-dimmed">pack_format</dt>
                <dd class="font-mono">{{ meta.packFormat }}</dd>
              </div>
            </dl>
          </div>
        </template>
      </CatalogProject>

      <section v-else-if="error" class="container mx-auto max-w-2xl px-4 py-40 text-center">
        <h1 class="text-2xl font-semibold">{{ t('catalog.notFound') }}</h1>
        <UButton class="mt-6" :to="localePath('/resourcepack')" :label="t('catalog.resourcepacks.title')" />
      </section>
    </div>
  </div>
</template>
