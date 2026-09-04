<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

interface Hit {
  id: string
  slug: string
  path: string
  title: string
  summary: string
  icon: string | null
  categories: string[]
  gameVersions: string[]
  downloads: number
  updated: number
}

const query = ref(String(route.query.q ?? ''))
const page = ref(Math.max(1, Number(route.query.page) || 1))
const perPage = 20

const { data, pending, refresh } = await useFetch<{ hits: Hit[], total: number }>(
  '/api/catalog/search',
  {
    query: computed(() => ({
      type: 'schematic',
      q: query.value || undefined,
      offset: (page.value - 1) * perPage,
      limit: perPage,
    })),
  },
)

const pages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / perPage)))

function submit() {
  page.value = 1
  navigateTo({ query: { q: query.value || undefined } })
  refresh()
}

function goto(next: number) {
  page.value = next
  navigateTo({ query: { q: query.value || undefined, page: next > 1 ? next : undefined } })
}

const when = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms))

const count = (n: number) => new Intl.NumberFormat(locale.value).format(n)

useSeoMeta({
  title: () => t('catalog.schematics.title'),
  description: () => t('catalog.schematics.sub'),
})
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-6xl px-4 pb-24 pt-40">
        <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">
          {{ t('catalog.schematics.title') }}
        </h1>
        <p class="mt-3 max-w-2xl text-base/relaxed text-muted">
          {{ t('catalog.schematics.sub') }}
        </p>

        <div class="mt-8 flex gap-2">
          <UInput
            v-model="query"
            size="lg"
            class="flex-1"
            icon="i-lucide-search"
            :placeholder="t('catalog.searchPlaceholder')"
            @keyup.enter="submit"
          />
          <UButton size="lg" class="rounded-xl" :label="t('catalog.search')" @click="submit" />
        </div>

        <p v-if="data" class="mt-4 text-sm text-dimmed">
          {{ t('catalog.results', { n: count(data.total) }) }}
        </p>

        <ul v-if="data?.hits.length" class="mt-6 grid gap-4 sm:grid-cols-2">
          <li v-for="hit in data.hits" :key="hit.id">
            <NuxtLink
              :to="localePath(hit.path)"
              class="flex h-full gap-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm transition-colors hover:border-zinc-500"
            >
              <span class="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <img v-if="hit.icon" :src="hit.icon" alt="" class="size-full object-cover">
                <UIcon v-else name="i-lucide-blocks" class="size-7 text-dimmed" />
              </span>

              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold">{{ hit.title }}</span>
                <span class="mt-1 line-clamp-2 block text-sm text-muted">{{ hit.summary }}</span>
                <span class="mt-2 flex flex-wrap items-center gap-2 text-xs text-dimmed">
                  <span>{{ t('catalog.downloads', { n: count(hit.downloads) }) }}</span>
                  <span>·</span>
                  <span>{{ when(hit.updated) }}</span>
                </span>
              </span>
            </NuxtLink>
          </li>
        </ul>

        <p v-else-if="!pending" class="mt-12 text-center text-muted">
          {{ t('catalog.empty') }}
        </p>

        <div v-if="pages > 1" class="mt-8 flex items-center justify-center gap-2">
          <UButton
            variant="subtle"
            color="neutral"
            icon="i-lucide-chevron-left"
            :disabled="page <= 1"
            @click="goto(page - 1)"
          />
          <span class="text-sm text-muted">{{ page }} / {{ pages }}</span>
          <UButton
            variant="subtle"
            color="neutral"
            icon="i-lucide-chevron-right"
            :disabled="page >= pages"
            @click="goto(page + 1)"
          />
        </div>
      </section>
    </div>
  </div>
</template>
