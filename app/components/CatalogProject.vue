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
  disclosures: DisclosureMap
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
  gallery?: Array<{ id: string, url: string, title: string, featured: boolean }>
}>()

const shown = ref(0)

const { t, locale } = useI18n()
const localePath = useLocalePath()

const body = computed(() => renderMarkdown(props.project.description))

const session = useAuthSession()
const signedIn = computed(() => Boolean(session.value.data))

const {
  collections,
  holding,
  loaded: collectionsLoaded,
  favourited,
  busy: favouriteBusy,
  load: loadCollections,
  setMembership,
  toggleFavourite,
  createAndAdd,
} = useProjectCollections(computed(() => props.project))

watch(() => props.project.favourited, value => (favourited.value = value === true), { immediate: true })

const menuOpen = ref(false)
const naming = ref(false)
const newName = ref('')
const creating = ref(false)

watch(menuOpen, (open) => {
  if (open && !collectionsLoaded.value) loadCollections()
  if (!open) naming.value = false
})

async function submitName() {
  creating.value = true
  try {
    if (await createAndAdd(newName.value)) {
      newName.value = ''
      naming.value = false
    }
  }
  finally {
    creating.value = false
  }
}

const collectionLabel = (collection: CollectionSummary) =>
  collection.kind === 'favourites' ? t('collections.favourites') : collection.title

const collectionMenu = computed(() => {
  const rows = collections.value.map(collection => ({
    label: collectionLabel(collection),
    type: 'checkbox' as const,
    checked: holding.value.includes(collection.id),
    // Keeping the menu open lets one project be filed in several collections
    // without reopening it each time.
    onSelect: (event: Event) => event.preventDefault(),
    onUpdateChecked: (checked: boolean) => setMembership(collection.id, checked),
  }))

  return [
    rows.length ? rows : [{ label: t('collections.none'), disabled: true }],
    [{
      label: t('collections.createInline'),
      icon: 'i-lucide-plus',
      onSelect: (event: Event) => {
        event.preventDefault()
        naming.value = true
      },
    }],
    [{
      label: t('collections.manage'),
      icon: 'i-lucide-settings',
      to: localePath('/collections'),
    }],
  ]
})

const linkIcon = (name: string) => LINK_ICONS[name as LinkKind] ?? 'i-lucide-external-link'
const linkLabel = (name: string) => (isLinkKind(name) ? t(`links.${name}`) : name)

const buying = ref(false)
const buyProblem = ref('')

const following = ref(props.project.following === true)
const followCount = ref(props.project.follows ?? 0)
const followBusy = ref(false)

watch(() => props.project.id, () => {
  following.value = props.project.following === true
  followCount.value = props.project.follows ?? 0
})

async function toggleFollow() {
  followBusy.value = true
  const next = !following.value
  try {
    await $fetch(`/api/catalog/project/${encodeURIComponent(props.project.slug)}/follow`, {
      method: next ? 'POST' : 'DELETE',
    })
    following.value = next
    followCount.value += next ? 1 : -1
  } catch {
    // A failed follow leaves the button where it was rather than lying about it.
  } finally { followBusy.value = false }
}

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
          <button
            class="inline-flex items-center gap-1.5 transition-colors hover:text-highlighted"
            :disabled="followBusy"
            :aria-pressed="following"
            @click="toggleFollow"
          >
            <UIcon
              :name="following ? 'i-lucide-heart' : 'i-lucide-heart'"
              class="size-4"
              :class="following ? 'text-primary' : ''"
            />
            {{ t('catalog.follows', { n: count(followCount) }) }}
          </button>
          <UFieldGroup v-if="signedIn" size="xs">
            <UButton
              :icon="favourited ? 'i-lucide-star' : 'i-lucide-star'"
              :variant="favourited ? 'solid' : 'outline'"
              :color="favourited ? 'primary' : 'neutral'"
              :loading="favouriteBusy"
              :aria-pressed="favourited"
              :label="favourited ? t('collections.favourited') : t('collections.favourite')"
              @click="toggleFavourite"
            />
            <UDropdownMenu
              v-model:open="menuOpen"
              :items="collectionMenu"
              :content="{ align: 'end' }"
              :ui="{ content: 'w-64' }"
            >
              <UButton
                icon="i-lucide-chevron-down"
                variant="outline"
                color="neutral"
                :aria-label="t('collections.save')"
              />

              <template #content-bottom>
                <div v-if="naming" class="border-t border-default p-1.5">
                  <UInput
                    v-model="newName"
                    autofocus
                    size="xs"
                    class="w-full"
                    :placeholder="t('collections.titlePlaceholder')"
                    :loading="creating"
                    @keydown.enter.prevent="submitName"
                    @keydown.esc.prevent="naming = false"
                  />
                </div>
              </template>
            </UDropdownMenu>
          </UFieldGroup>
          <ReportButton item-type="project" :item-id="project.id" :label="t('reports.report')" />
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

        <figure
          v-if="gallery?.length"
          class="overflow-hidden rounded-3xl border border-zinc-600/50 bg-black/30 backdrop-blur-sm"
        >
          <img
            :src="gallery[shown]!.url"
            :alt="gallery[shown]!.title"
            class="max-h-[520px] w-full object-contain"
          >
          <figcaption
            v-if="gallery[shown]!.title"
            class="border-t border-white/10 px-5 py-3 text-sm text-muted"
          >{{ gallery[shown]!.title }}</figcaption>

          <div v-if="gallery.length > 1" class="flex gap-2 overflow-x-auto border-t border-white/10 p-3">
            <button
              v-for="(image, index) in gallery"
              :key="image.id"
              class="shrink-0 overflow-hidden rounded-lg border transition-colors"
              :class="index === shown ? 'border-primary' : 'border-white/10 hover:border-white/30'"
              @click="shown = index"
            >
              <img :src="image.url" alt="" class="h-14 w-20 object-cover">
            </button>
          </div>
        </figure>

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

        <ProjectDisclosures :disclosures="project.disclosures ?? {}" />

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
                <UIcon :name="linkIcon(name)" class="size-3.5" />
                {{ linkLabel(name) }}
              </a>
            </li>
          </ul>
        </div>
      </aside>
    </div>

    <ProjectMembers :slug="project.slug" />
    <ProjectModeration :slug="project.slug" />
    <ProjectComments :slug="project.slug" />
  </section>
</template>
