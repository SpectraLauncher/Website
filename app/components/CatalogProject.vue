<script setup lang="ts">
export interface CatalogVersionFile {
  id: string
  filename: string
  size: number
  hashes: { sha1: string, sha512: string }
  primary: boolean
}

export interface CatalogVersion {
  id: string
  number: string
  name: string
  channel: string
  gameVersions: string[]
  loaders: string[]
  downloads: number
  created: number
  meta: Record<string, any>
  files: CatalogVersionFile[]
}

export interface CatalogProjectData {
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
  loaders: string[]
  gameVersions: string[]
  downloads: number
  created: number
  updated: number
  versions: CatalogVersion[]
  price?: number
  currency?: string
  owned?: boolean
  owner?: {
    kind: 'user' | 'organization'
    slug: string | null
    name: string | null
    image: string | null
  } | null
}

const props = defineProps<{
  project: CatalogProjectData
  backTo: string
  backLabel: string
  icon: string
}>()

const { t, locale } = useI18n()
const localePath = useLocalePath()

const body = computed(() => renderMarkdown(props.project.description))

const buying = ref(false)
const buyProblem = ref('')

const priceLabel = computed(() => {
  const price = props.project.price ?? 0
  if (!price) return null
  return new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency: (props.project.currency ?? 'eur').toUpperCase(),
  }).format(price / 100)
})

async function buy() {
  buying.value = true
  buyProblem.value = ''
  try {
    const res = await $fetch<{ url: string }>(
      `/api/catalog/project/${encodeURIComponent(props.project.slug)}/buy`, { method: 'POST' })
    await navigateTo(res.url, { external: true })
  } catch (e: any) {
    buyProblem.value = e?.data?.statusMessage || e?.message || t('catalog.buyFailed')
    buying.value = false
  }
}

const when = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms))
const count = (n: number) => new Intl.NumberFormat(locale.value).format(n)
const sizeLabel = (bytes: number) =>
  bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`
</script>

<template>
  <section class="container mx-auto max-w-6xl px-4 pb-24 pt-40">
    <NuxtLink
      :to="localePath(backTo)"
      class="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-highlighted"
    >
      <UIcon name="i-lucide-arrow-left" class="size-4" />
      {{ backLabel }}
    </NuxtLink>

    <div class="mt-6 flex flex-wrap gap-6">
      <span class="grid size-24 shrink-0 place-items-center overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <img v-if="project.icon" :src="project.icon" alt="" class="size-full object-cover">
        <UIcon v-else :name="icon" class="size-10 text-dimmed" />
      </span>

      <div class="min-w-0 flex-1">
        <h1 class="text-3xl font-semibold tracking-tight">{{ project.title }}</h1>
        <p class="mt-2 max-w-2xl text-base/relaxed text-muted">{{ project.summary }}</p>

        <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-dimmed">
          <NuxtLink
            v-if="project.owner?.slug"
            :to="localePath(project.owner.kind === 'organization'
              ? `/org/${project.owner.slug}`
              : `/u/${project.owner.slug}`)"
            class="inline-flex items-center gap-1.5 transition-colors hover:text-highlighted"
          >
            <span class="grid size-5 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/5">
              <img v-if="project.owner.image" :src="project.owner.image" alt="" class="size-full object-cover">
              <UIcon
                v-else
                :name="project.owner.kind === 'organization' ? 'i-lucide-users' : 'i-lucide-user'"
                class="size-3"
              />
            </span>
            {{ project.owner.name || project.owner.slug }}
          </NuxtLink>
          <span class="inline-flex items-center gap-1.5">
            <UIcon name="i-lucide-download" class="size-4" />
            {{ t('catalog.downloads', { n: count(project.downloads) }) }}
          </span>
          <span class="inline-flex items-center gap-1.5">
            <UIcon name="i-lucide-calendar" class="size-4" />
            {{ when(project.updated) }}
          </span>
          <span v-if="priceLabel" class="inline-flex items-center gap-1.5 font-medium text-highlighted">
            <UIcon name="i-lucide-tag" class="size-4" />
            {{ priceLabel }}
          </span>
          <span v-if="project.license" class="inline-flex items-center gap-1.5">
            <UIcon name="i-lucide-scale" class="size-4" />
            <a
              v-if="project.licenseUrl"
              :href="project.licenseUrl"
              target="_blank"
              rel="nofollow noopener noreferrer"
              class="hover:underline"
            >{{ project.license }}</a>
            <template v-else>{{ project.license }}</template>
          </span>
        </div>
      </div>
    </div>

    <div v-if="priceLabel" class="mt-6">
      <UButton
        v-if="!project.owned"
        size="lg"
        class="rounded-xl"
        icon="i-lucide-shopping-cart"
        :loading="buying"
        :label="t('catalog.buyFor', { price: priceLabel })"
        @click="buy"
      />
      <UBadge
        v-else
        variant="subtle"
        color="success"
        size="lg"
        icon="i-lucide-check"
        :label="t('catalog.owned')"
      />
      <p v-if="buyProblem" class="mt-2 text-sm text-error">{{ buyProblem }}</p>
    </div>

    <div class="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
      <div class="min-w-0 space-y-6">
        <slot name="lead" />

        <!-- eslint-disable-next-line vue/no-v-html -- markdown-it runs with html:false -->
        <article
          v-if="project.description"
          class="prose prose-invert max-w-none rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm prose-a:text-primary"
          v-html="body"
        />

        <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <h2 class="text-lg font-semibold">{{ t('catalog.versions') }}</h2>

          <ul v-if="project.versions.length" class="mt-4 space-y-2">
            <li
              v-for="version in project.versions"
              :key="version.id"
              class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-mono text-sm">{{ version.number }}</span>
                <UBadge
                  variant="subtle"
                  size="sm"
                  :color="version.channel === 'release' ? 'success' : 'neutral'"
                  :label="version.channel"
                />
                <span class="text-xs text-dimmed">
                  {{ version.gameVersions.join(', ') }}
                  <template v-if="version.loaders.length"> · {{ version.loaders.join(', ') }}</template>
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

          <p v-else class="mt-4 text-sm text-dimmed">{{ t('catalog.noVersions') }}</p>
        </div>
      </div>

      <aside class="space-y-6">
        <slot name="sidebar" />

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
</template>
