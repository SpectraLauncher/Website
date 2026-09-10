<script setup lang="ts">
const props = defineProps<{
  type: string
  prefix: string
  title: string
  sub: string
  icon: string
}>()

const { t, te } = useI18n()
const route = useRoute()
const router = useRouter()
const { count } = useCatalogFormat()

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
const layout = ref(route.query.view === 'grid' ? 'grid' : 'rows')
const page = ref(Math.max(1, Number(route.query.page) || 1))

const filtersOpen = ref(false)

// Registry: one entry per facet. The sidebar, the removable chips and the
// "clear all" button all read this list, so adding a facet is a line here plus
// the query-string key in sync() below.
const FACETS = [
  { id: 'gameVersions', model: gameVersions, title: 'catalog.gameVersions', labelKey: undefined, marks: undefined },
  { id: 'loaders', model: loaders, title: 'catalog.loaders', labelKey: 'catalog.loaderNames', marks: 'loader' },
  { id: 'categories', model: categories, title: 'catalog.categories', labelKey: 'catalog.categoryNames', marks: 'category' },
  { id: 'environment', model: environment, title: 'catalog.environment', labelKey: 'catalog.environments', marks: undefined },
  { id: 'licenses', model: licenses, title: 'catalog.license', labelKey: undefined, marks: undefined },
] as const

const activeCount = computed(() =>
  FACETS.reduce((total, facet) => total + facet.model.value.length, 0))

const chips = computed(() => FACETS.flatMap(facet =>
  facet.model.value.map((value) => {
    const key = facet.labelKey ? `${facet.labelKey}.${value}` : ''
    return {
      id: `${facet.id}:${value}`,
      label: key && te(key) ? t(key) : value,
      remove: () => { facet.model.value = facet.model.value.filter(v => v !== value) },
    }
  })))

const { data: facets } = await useFetch<Facets>('/api/catalog/facets', {
  query: { type: props.type },
})

const { data, pending } = await useFetch<{ hits: CatalogHit[], total: number }>(
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
      view: layout.value === 'rows' ? undefined : layout.value,
      page: page.value > 1 ? page.value : undefined,
    },
  })
}

watch([gameVersions, loaders, categories, environment, licenses, sort, perPage], () => sync())
watch(layout, () => sync(false))
watch(page, () => {
  sync(false)
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
})

function clearFilters() {
  for (const facet of FACETS) facet.model.value = []
}

useSeoMeta({
  title: () => props.title,
  description: () => props.sub,
  // A filtered or paged listing is the same content sliced differently, so only
  // the bare listing is worth indexing.
  robots: () => (activeCount.value || page.value > 1 || query.value ? 'noindex, follow' : 'index, follow'),
})
</script>

<template>
  <UiPageShell>
    <CatalogTabs :current="type" />

    <UiPageHeader :title="title" :description="sub" class="pt-8" />

    <div class="grid gap-5 lg:grid-cols-[264px_1fr]">
      <aside class="lg:block" :class="filtersOpen ? 'block' : 'hidden'">
        <UiPanel class="px-4 py-3">
          <div class="flex items-center justify-between gap-2 pb-2">
            <h2 class="text-sm font-bold text-highlighted">{{ t('catalog.filters') }}</h2>
            <button
              v-if="activeCount"
              type="button"
              class="cursor-pointer text-xs font-semibold text-dimmed transition-colors hover:text-highlighted"
              @click="clearFilters"
            >{{ t('catalog.clearFilters') }}</button>
          </div>

          <CatalogFacet
            v-for="facet in FACETS"
            :key="facet.id"
            v-model="facet.model.value"
            :title="t(facet.title)"
            :options="facets?.[facet.id] ?? []"
            :label-key="facet.labelKey"
            :marks="facet.marks"
          />
        </UiPanel>
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
            class="lg:hidden"
            size="lg"
            variant="subtle"
            color="neutral"
            icon="i-pixelarticons-sliders-horizontal"
            :label="activeCount ? String(activeCount) : ''"
            :aria-label="t('catalog.filters')"
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

          <div class="flex gap-1 rounded-xl border border-panel-line bg-panel p-1">
            <button
              v-for="mode in ['grid', 'rows']"
              :key="mode"
              type="button"
              class="cursor-pointer rounded-lg px-3 py-2 transition-colors"
              :class="layout === mode ? 'bg-white/10 text-highlighted' : 'text-dimmed hover:bg-white/5'"
              :aria-label="t(`catalog.layout.${mode}`)"
              :aria-pressed="layout === mode"
              @click="layout = mode"
            >
              <UIcon :name="mode === 'grid' ? 'i-pixelarticons-grid' : 'i-pixelarticons-layout-rows'" class="size-4" />
            </button>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <p v-if="data" class="text-sm text-dimmed">{{ t('catalog.results', { n: count(data.total) }) }}</p>

          <span
            v-for="chip in chips"
            :key="chip.id"
            class="inline-flex h-7 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 py-0 pl-3 pr-1 text-xs font-semibold text-primary"
          >
            {{ chip.label }}
            <button
              type="button"
              class="grid size-5 cursor-pointer place-items-center rounded-full transition-colors hover:bg-primary/20"
              :aria-label="t('catalog.clearFilters')"
              @click="chip.remove()"
            >
              <UIcon name="i-pixelarticons-close" class="size-3" />
            </button>
          </span>
        </div>

        <ul
          v-if="data?.hits.length"
          class="mt-4"
          :class="layout === 'grid' ? 'grid gap-3 sm:grid-cols-2 2xl:grid-cols-3' : 'space-y-3'"
        >
          <li v-for="hit in data.hits" :key="hit.id">
            <CatalogCard v-if="layout === 'grid'" :hit="hit" :fallback-icon="icon" />
            <CatalogRow v-else :hit="hit" :fallback-icon="icon" />
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

        <UPagination
          v-if="data && data.total > perPage"
          v-model:page="page"
          class="mt-8 justify-center"
          :total="data.total"
          :items-per-page="perPage"
        />
      </main>
    </div>
  </UiPageShell>
</template>
