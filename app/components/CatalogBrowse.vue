<script setup lang="ts">
const props = defineProps<{
  type: string
  prefix: string
  title: string
  sub: string
  icon: string
}>()

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()

interface Hit {
  id: string
  slug: string
  path: string
  title: string
  summary: string
  icon: string | null
  categories: string[]
  gameVersions: string[]
  loaders: string[]
  downloads: number
  updated: number
}

interface Facets {
  gameVersions: Array<{ value: string, count: number }>
  loaders: Array<{ value: string, count: number }>
  categories: Array<{ value: string, count: number }>
  environment: Array<{ value: string, count: number }>
  licenses: Array<{ value: string, count: number }>
}

const SORTS = ['relevance', 'downloads', 'updated', 'created'] as const
const PER_PAGE = [20, 50, 100]

const list = (value: unknown): string[] =>
  String(value ?? '').split(',').map(v => v.trim()).filter(Boolean)

// Every control writes to the query string, so a filtered listing is a link
// someone can send, and the back button walks the filters rather than the page.
const query = ref(String(route.query.q ?? ''))
const gameVersions = ref(list(route.query.v))
const loaders = ref(list(route.query.l))
const categories = ref(list(route.query.c))
const environment = ref(list(route.query.e))
const licenses = ref(list(route.query.lic))

const sort = ref(SORTS.includes(route.query.sort as never) ? String(route.query.sort) : 'downloads')
const perPage = ref(PER_PAGE.includes(Number(route.query.per)) ? Number(route.query.per) : 20)
const layout = ref(route.query.view === 'rows' ? 'rows' : 'grid')
const page = ref(Math.max(1, Number(route.query.page) || 1))

const filtersOpen = ref(false)

const activeCount = computed(() =>
  gameVersions.value.length + loaders.value.length + categories.value.length
  + environment.value.length + licenses.value.length)

const { data: facets } = await useFetch<Facets>('/api/catalog/facets', {
  query: { type: props.type },
})

const { data, pending } = await useFetch<{ hits: Hit[], total: number }>(
  '/api/catalog/search',
  {
    query: computed(() => ({
      type: props.type,
      q: query.value || undefined,
      gameVersions: gameVersions.value.join(',') || undefined,
      loaders: loaders.value.join(',') || undefined,
      categories: categories.value.join(',') || undefined,
      environment: environment.value.join(',') || undefined,
      licenses: licenses.value.join(',') || undefined,
      sort: sort.value,
      offset: (page.value - 1) * perPage.value,
      limit: perPage.value,
    })),
  },
)

const pages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / perPage.value)))

function sync(resetPage = true) {
  if (resetPage) page.value = 1

  router.replace({
    query: {
      q: query.value || undefined,
      v: gameVersions.value.join(',') || undefined,
      l: loaders.value.join(',') || undefined,
      c: categories.value.join(',') || undefined,
      e: environment.value.join(',') || undefined,
      lic: licenses.value.join(',') || undefined,
      sort: sort.value === 'downloads' ? undefined : sort.value,
      per: perPage.value === 20 ? undefined : perPage.value,
      view: layout.value === 'grid' ? undefined : layout.value,
      page: page.value > 1 ? page.value : undefined,
    },
  })
}

watch([gameVersions, loaders, categories, environment, licenses, sort, perPage], () => sync())
watch(layout, () => sync(false))

function clearFilters() {
  gameVersions.value = []
  loaders.value = []
  categories.value = []
  environment.value = []
  licenses.value = []
}

function goto(next: number) {
  page.value = next
  sync(false)
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

const when = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms))
const count = (n: number) => new Intl.NumberFormat(locale.value).format(n)

useSeoMeta({
  title: () => props.title,
  description: () => props.sub,
  // A filtered or paged listing is the same content sliced differently, so only
  // the bare listing is worth indexing.
  robots: () => (activeCount.value || page.value > 1 || query.value ? 'noindex, follow' : 'index, follow'),
})
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-7xl px-4 pb-24 pt-36">
        <CatalogTabs :current="type" />

        <h1 class="mt-8 text-3xl font-semibold tracking-tight md:text-4xl">{{ title }}</h1>
        <p class="mt-3 max-w-2xl text-base/relaxed text-muted">{{ sub }}</p>

        <div class="mt-8 grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside
            class="lg:block"
            :class="filtersOpen ? 'block' : 'hidden'"
          >
            <div class="space-y-5 rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm">
              <div class="flex items-center justify-between gap-2">
                <h2 class="text-sm font-semibold">{{ t('catalog.filters') }}</h2>
                <button
                  v-if="activeCount"
                  class="text-xs text-primary transition-opacity hover:opacity-80"
                  @click="clearFilters"
                >
                  {{ t('catalog.clearFilters') }}
                </button>
              </div>

              <CatalogFacet
                v-model="gameVersions"
                :title="t('catalog.gameVersions')"
                :options="facets?.gameVersions ?? []"
              />
              <CatalogFacet
                v-model="loaders"
                :title="t('catalog.loaders')"
                :options="facets?.loaders ?? []"
                label-key="catalog.loaderNames"
              />
              <CatalogFacet
                v-model="categories"
                :title="t('catalog.categories')"
                :options="facets?.categories ?? []"
              />
              <CatalogFacet
                v-model="environment"
                :title="t('catalog.environment')"
                :options="facets?.environment ?? []"
                label-key="catalog.environments"
              />
              <CatalogFacet
                v-model="licenses"
                :title="t('catalog.license')"
                :options="facets?.licenses ?? []"
              />
            </div>
          </aside>

          <main class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <UInput
                v-model="query"
                size="lg"
                class="min-w-48 flex-1"
                icon="i-pixelarticons-search"
                :placeholder="t('catalog.searchPlaceholder')"
                @keyup.enter="sync()"
              />

              <UButton
                class="rounded-xl lg:hidden"
                size="lg"
                variant="subtle"
                color="neutral"
                icon="i-pixelarticons-sliders-horizontal"
                :label="activeCount ? String(activeCount) : ''"
                @click="filtersOpen = !filtersOpen"
              />

              <USelect
                v-model="sort"
                size="lg"
                class="w-44"
                :items="SORTS.map(value => ({ value, label: t(`catalog.sort.${value}`) }))"
                value-key="value"
              />

              <USelect
                v-model="perPage"
                size="lg"
                class="w-24"
                :items="PER_PAGE.map(value => ({ value, label: String(value) }))"
                value-key="value"
              />

              <div class="flex overflow-hidden rounded-xl border border-zinc-600/50">
                <button
                  v-for="mode in ['grid', 'rows']"
                  :key="mode"
                  class="px-3 py-2.5 transition-colors"
                  :class="layout === mode ? 'bg-white/10 text-highlighted' : 'text-dimmed hover:bg-white/5'"
                  :aria-label="t(`catalog.layout.${mode}`)"
                  :aria-pressed="layout === mode"
                  @click="layout = mode"
                >
                  <UIcon :name="mode === 'grid' ? 'i-pixelarticons-grid' : 'i-pixelarticons-layout-rows'" class="size-4" />
                </button>
              </div>
            </div>

            <p v-if="data" class="mt-4 text-sm text-dimmed">
              {{ t('catalog.results', { n: count(data.total) }) }}
            </p>

            <ul
              v-if="data?.hits.length"
              class="mt-4"
              :class="layout === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-3'"
            >
              <li v-for="hit in data.hits" :key="hit.id">
                <NuxtLink
                  :to="localePath(hit.path)"
                  class="flex h-full gap-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm transition-colors hover:border-zinc-500"
                >
                  <span
                    class="grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5"
                    :class="layout === 'grid' ? 'size-16' : 'size-20'"
                  >
                    <img v-if="hit.icon" :src="hit.icon" alt="" class="size-full object-cover">
                    <UIcon v-else :name="icon" class="size-7 text-dimmed" />
                  </span>

                  <span class="min-w-0 flex-1">
                    <span class="block truncate font-semibold">{{ hit.title }}</span>
                    <span
                      class="mt-1 block text-sm text-muted"
                      :class="layout === 'grid' ? 'line-clamp-2' : 'line-clamp-1'"
                    >{{ hit.summary }}</span>

                    <span
                      v-if="layout === 'rows' && hit.categories.length"
                      class="mt-2 flex flex-wrap gap-1.5"
                    >
                      <span
                        v-for="category in hit.categories.slice(0, 5)"
                        :key="category"
                        class="rounded-lg bg-white/5 px-2 py-0.5 text-xs text-dimmed"
                      >{{ category }}</span>
                    </span>

                    <span class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-dimmed">
                      <span>{{ t('catalog.downloads', { n: count(hit.downloads) }) }}</span>
                      <span>·</span>
                      <span>{{ when(hit.updated) }}</span>
                      <template v-if="hit.loaders.length">
                        <span>·</span>
                        <span class="truncate">{{ hit.loaders.join(', ') }}</span>
                      </template>
                    </span>
                  </span>
                </NuxtLink>
              </li>
            </ul>

            <div v-else-if="!pending" class="mt-16 text-center">
              <UIcon name="i-pixelarticons-search" class="mx-auto size-10 text-dimmed" />
              <p class="mt-3 text-muted">{{ t('catalog.empty') }}</p>
              <UButton
                v-if="activeCount"
                class="mt-4"
                variant="subtle"
                color="neutral"
                :label="t('catalog.clearFilters')"
                @click="clearFilters"
              />
            </div>

            <div v-if="pages > 1" class="mt-8 flex items-center justify-center gap-2">
              <UButton
                variant="subtle"
                color="neutral"
                icon="i-pixelarticons-chevron-left"
                :disabled="page <= 1"
                :aria-label="t('catalog.previousPage')"
                @click="goto(page - 1)"
              />
              <span class="text-sm text-muted">{{ page }} / {{ pages }}</span>
              <UButton
                variant="subtle"
                color="neutral"
                icon="i-pixelarticons-chevron-right"
                :disabled="page >= pages"
                :aria-label="t('catalog.nextPage')"
                @click="goto(page + 1)"
              />
            </div>
          </main>
        </div>
      </section>
    </div>
  </div>
</template>
