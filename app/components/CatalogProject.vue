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
  changelog?: string
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
  disclosures: DisclosureMap
  categories: string[]
  loaders: string[]
  gameVersions: string[]
  environment?: string[]
  downloads: number
  created: number
  updated: number
  versions: CatalogVersion[]
  price?: number
  currency?: string
  owned?: boolean
  follows: number
  following?: boolean
  favourited?: boolean
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
  tab?: string
  gallery?: Array<{ id: string, url: string, title: string, featured: boolean }>
}>()

const { t, locale } = useI18n()
const localePath = useLocalePath()
const session = useAuthSession()

const body = computed(() => renderMarkdown(props.project.description))
const count = (n: number) => new Intl.NumberFormat(locale.value).format(n)

// The settings area answers 404 to anybody with no rights on the project, so
// asking it is both the check and the answer.
//
// The session resolves after the first render, so this has to watch the account
// as well as the project: asked once while the session was still loading, it
// answered "not signed in" and never asked again, and the owner of the project
// never saw the button.
const account = computed(() => (session.value.data?.user as { id?: string } | undefined)?.id ?? '')

const { data: editor } = await useAsyncData(
  `project-editable:${props.project.id}`,
  async () => {
    if (session.value.isPending || !account.value) return null

    try {
      return await $fetch<{ permissions: string[] }>(
        `/api/catalog/project/${encodeURIComponent(props.project.slug)}/editor`)
    }
    catch { return null }
  },
  { watch: [() => props.project.id, account, () => session.value.isPending] },
)

const canEdit = computed(() => Boolean(editor.value?.permissions.length))

// The one file somebody actually wants. A project whose newest version has no
// primary file has nothing to offer behind a download button, so there is none.
const latest = computed(() => props.project.versions[0] ?? null)
const primaryFile = computed(() =>
  latest.value?.files.find(file => file.primary) ?? latest.value?.files[0] ?? null)

const gallery = computed(() => props.gallery ?? [])

// To add a tab: one entry here and one branch in the body below. `shown` keeps a
// tab out of the row when it would open on nothing.
const TABS = [
  { id: 'description', shown: true },
  { id: 'gallery', shown: computed(() => gallery.value.length > 0) },
  { id: 'changelog', shown: computed(() => props.project.versions.some(v => v.changelog)) },
  { id: 'versions', shown: computed(() => props.project.versions.length > 0) },
  { id: 'moderation', shown: computed(() => canEdit.value) },
]

const tabs = computed(() => TABS
  .filter(tab => (typeof tab.shown === 'boolean' ? tab.shown : tab.shown.value))
  .map(tab => ({
    id: tab.id,
    path: localePath(tab.id === 'description'
      ? props.project.path
      : `${props.project.path}/${tab.id}`),
  })))

const current = computed(() => {
  const wanted = props.tab || 'description'
  return tabs.value.some(tab => tab.id === wanted) ? wanted : 'description'
})

const followCount = ref(props.project.follows)
const following = ref(Boolean(props.project.following))
const followBusy = ref(false)

watch(() => props.project.id, () => {
  followCount.value = props.project.follows
  following.value = Boolean(props.project.following)
})

async function toggleFollow() {
  if (!session.value.data) return await navigateTo(localePath('/login'))

  const next = !following.value
  followBusy.value = true
  try {
    await $fetch(`/api/catalog/project/${encodeURIComponent(props.project.slug)}/follow`, {
      method: next ? 'POST' : 'DELETE',
    })
    following.value = next
    followCount.value += next ? 1 : -1
  }
  catch { /* the count is cosmetic; a failure leaves it as it was */ }
  finally { followBusy.value = false }
}
</script>

<template>
  <section class="container mx-auto max-w-6xl px-4 pb-24 pt-40">
    <NuxtLink
      :to="localePath(backTo)"
      class="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-highlighted"
    >
      <UIcon name="i-pixelarticons-arrow-left" class="size-4" />
      {{ backLabel }}
    </NuxtLink>

    <header class="mt-6 flex flex-wrap items-start gap-6">
      <span class="grid size-24 shrink-0 place-items-center overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <img v-if="project.icon" :src="project.icon" alt="" class="size-full object-cover">
        <UIcon v-else :name="icon" class="size-10 text-dimmed" />
      </span>

      <div class="min-w-0 flex-1">
        <h1 class="text-3xl font-semibold tracking-tight">{{ project.title }}</h1>
        <p class="mt-2 max-w-2xl text-base/relaxed text-muted">{{ project.summary }}</p>

        <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-dimmed">
          <span class="inline-flex items-center gap-1.5">
            <UIcon name="i-pixelarticons-download" class="size-4" />
            {{ t('catalog.downloads', { n: count(project.downloads) }) }}
          </span>
          <button
            class="inline-flex items-center gap-1.5 transition-colors hover:text-highlighted"
            :disabled="followBusy"
            :aria-pressed="following"
            @click="toggleFollow"
          >
            <UIcon name="i-pixelarticons-heart" class="size-4" :class="following ? 'text-primary' : ''" />
            {{ t('catalog.follows', { n: count(followCount) }) }}
          </button>
          <ReportButton item-type="project" :item-id="project.id" size="xs" />
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="primaryFile"
          size="lg"
          color="primary"
          class="rounded-xl"
          icon="i-pixelarticons-download"
          :label="t('catalog.download')"
          :to="`/api/catalog/download/${primaryFile.id}`"
          external
        />
        <UButton
          v-if="canEdit"
          size="lg"
          variant="subtle"
          color="neutral"
          class="rounded-xl"
          icon="i-pixelarticons-edit"
          :label="t('catalog.editProject')"
          :to="localePath(`/project/${project.id}/settings`)"
        />
      </div>
    </header>

    <nav class="mt-8 border-b border-white/10">
      <ul class="-mb-px flex gap-1 overflow-x-auto">
        <li v-for="entry in tabs" :key="entry.id" class="shrink-0">
          <NuxtLink
            :to="entry.path"
            class="block whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors"
            :class="current === entry.id
              ? 'border-primary font-medium text-default'
              : 'border-transparent text-muted hover:text-default'"
          >
            {{ t(`catalog.tabs.${entry.id}`) }}
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <div class="mt-6 grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
      <div class="min-w-0 space-y-6">
        <template v-if="current === 'description'">
          <slot name="lead" />

          <ProjectDisclosures :disclosures="project.disclosures" />

          <!-- eslint-disable-next-line vue/no-v-html -- markdown-it runs with html:false -->
          <article
            v-if="project.description"
            class="prose prose-invert max-w-none rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm prose-a:text-primary"
            v-html="body"
          />
          <p v-else class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 text-sm text-dimmed backdrop-blur-sm">
            {{ t('catalog.noDescription') }}
          </p>
        </template>

        <ProjectGallery v-else-if="current === 'gallery'" :gallery="gallery" />
        <ProjectChangelog v-else-if="current === 'changelog'" :versions="project.versions" />
        <ProjectVersions v-else-if="current === 'versions'" :versions="project.versions" />

        <template v-else-if="current === 'moderation'">
          <ProjectMembers :slug="project.slug" />
          <ProjectModeration :slug="project.slug" />
        </template>

        <ProjectComments v-if="current === 'description'" :slug="project.slug" />
      </div>

      <div class="space-y-4">
        <slot name="sidebar" />
        <ProjectSidebar :project="project" />
      </div>
    </div>
  </section>
</template>
