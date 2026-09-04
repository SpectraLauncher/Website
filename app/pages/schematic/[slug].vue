<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const route = useRoute()
const { t, locale } = useI18n()
const localePath = useLocalePath()

interface VersionFile {
  id: string
  filename: string
  size: number
  hashes: { sha1: string, sha512: string }
  primary: boolean
}

interface Version {
  id: string
  number: string
  name: string
  channel: string
  gameVersions: string[]
  loaders: string[]
  downloads: number
  created: number
  meta: Record<string, any>
  files: VersionFile[]
}

interface Project {
  id: string
  slug: string
  type: string
  path: string
  title: string
  summary: string
  description: string
  icon: string | null
  license: string | null
  licenseUrl: string | null
  links: Record<string, string>
  categories: string[]
  downloads: number
  follows: number
  created: number
  updated: number
  versions: Version[]
}

const slug = computed(() => String(route.params.slug ?? ''))

const { data, error } = await useFetch<{ project: Project }>(
  () => `/api/catalog/project/${encodeURIComponent(slug.value)}`)

const project = computed(() => data.value?.project ?? null)
const latest = computed(() => project.value?.versions[0] ?? null)

const meta = computed(() => latest.value?.meta ?? {})
const materials = computed(() =>
  (Array.isArray(meta.value.materials) ? meta.value.materials : []) as Array<{
    item: string
    count: number
  }>)

const size = computed(() => {
  const s = meta.value.size
  return s && typeof s === 'object' ? `${s.x} × ${s.y} × ${s.z}` : null
})

const body = computed(() => renderMarkdown(project.value?.description ?? ''))
const previewUrl = computed(() => {
  const url = meta.value.preview
  return typeof url === 'string' && url ? url : null
})

const when = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms))
const count = (n: number) => new Intl.NumberFormat(locale.value).format(n)
const sizeLabel = (bytes: number) =>
  bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`
const itemName = (id: string) => id.replace('minecraft:', '').replace(/_/g, ' ')

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

      <section v-if="project" class="container mx-auto max-w-6xl px-4 pb-24 pt-40">
        <NuxtLink
          :to="localePath('/schematic')"
          class="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-highlighted"
        >
          <UIcon name="i-lucide-arrow-left" class="size-4" />
          {{ t('catalog.schematics.title') }}
        </NuxtLink>

        <div class="mt-6 flex flex-wrap gap-6">
          <span class="grid size-24 shrink-0 place-items-center overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            <img v-if="project.icon" :src="project.icon" alt="" class="size-full object-cover">
            <UIcon v-else name="i-lucide-blocks" class="size-10 text-dimmed" />
          </span>

          <div class="min-w-0 flex-1">
            <h1 class="text-3xl font-semibold tracking-tight">{{ project.title }}</h1>
            <p class="mt-2 max-w-2xl text-base/relaxed text-muted">{{ project.summary }}</p>

            <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-dimmed">
              <span class="inline-flex items-center gap-1.5">
                <UIcon name="i-lucide-download" class="size-4" />
                {{ t('catalog.downloads', { n: count(project.downloads) }) }}
              </span>
              <span class="inline-flex items-center gap-1.5">
                <UIcon name="i-lucide-calendar" class="size-4" />
                {{ when(project.updated) }}
              </span>
              <span v-if="project.license" class="inline-flex items-center gap-1.5">
                <UIcon name="i-lucide-scale" class="size-4" />
                {{ project.license }}
              </span>
            </div>
          </div>
        </div>

        <div class="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div class="min-w-0 space-y-6">
            <SchematicViewer v-if="previewUrl" :src="previewUrl" />

            <!-- eslint-disable-next-line vue/no-v-html -- markdown-it runs with html:false -->
            <article
              v-if="project.description"
              class="prose prose-invert max-w-none rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm prose-a:text-primary"
              v-html="body"
            />

            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <h2 class="text-lg font-semibold">{{ t('catalog.versions') }}</h2>

              <ul class="mt-4 space-y-2">
                <li
                  v-for="version in project.versions"
                  :key="version.id"
                  class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-mono text-sm">{{ version.number }}</span>
                    <UBadge variant="subtle" size="sm" :label="version.channel" />
                    <span class="text-xs text-dimmed">
                      {{ version.gameVersions.join(', ') }}
                    </span>
                    <span class="flex-1"></span>
                    <UButton
                      v-for="file in version.files"
                      :key="file.id"
                      size="xs"
                      variant="subtle"
                      color="neutral"
                      icon="i-lucide-download"
                      :label="sizeLabel(file.size)"
                      :to="`/api/catalog/download/${file.id}`"
                      external
                    />
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <aside class="space-y-6">
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

            <div
              v-if="Object.keys(project.links).length"
              class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
            >
              <h2 class="text-lg font-semibold">{{ t('catalog.links') }}</h2>
              <ul class="mt-4 space-y-2 text-sm">
                <li v-for="(url, name) in project.links" :key="name">
                  <a
                    :href="url"
                    target="_blank"
                    rel="nofollow ugc noopener noreferrer"
                    class="inline-flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <UIcon name="i-lucide-external-link" class="size-3.5" />
                    {{ name }}
                  </a>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <section v-else-if="error" class="container mx-auto max-w-2xl px-4 py-40 text-center">
        <h1 class="text-2xl font-semibold">{{ t('catalog.notFound') }}</h1>
        <UButton class="mt-6" :to="localePath('/schematic')" :label="t('catalog.schematics.title')" />
      </section>
    </div>
  </div>
</template>
