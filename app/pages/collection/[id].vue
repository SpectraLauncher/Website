<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

definePageMeta({ middleware: 'catalog' })

const id = computed(() => String(route.params.id))

const { data, error: loadError, refresh } = await useFetch<{
  collection: {
    id: string
    kind: 'favourites' | 'custom'
    title: string
    summary: string
    visibility: 'private' | 'unlisted' | 'listed'
    projects: number
    updated: number
  }
  owner: { username: string | null, name: string | null, image: string | null } | null
  isOwner: boolean
  projects: Array<{
    id: string
    title: string
    summary: string
    path: string
    icon: string | null
    type: string
    downloads: number
  }>
}>(() => `/api/catalog/collections/${id.value}`)

const title = computed(() => {
  const collection = data.value?.collection
  if (!collection) return t('nav.account.collections')
  return collection.kind === 'favourites' ? t('collections.favourites') : collection.title
})

useHead({ title })

// A collection that is not listed must not be indexed even when its address is
// shared; only a listed one may be.
useSeoMeta({
  robots: () => (data.value?.collection.visibility === 'listed' ? 'index,follow' : 'noindex,nofollow'),
})

const busy = ref('')

async function remove(projectId: string) {
  busy.value = projectId
  try {
    await $fetch(`/api/catalog/collections/${id.value}/projects`, {
      method: 'DELETE',
      query: { projectId },
    })
    await refresh()
  }
  finally {
    busy.value = ''
  }
}
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="mx-auto max-w-4xl px-4 pb-24 pt-40">
        <div v-if="loadError" class="rounded-2xl border border-white/10 p-10 text-center">
          <h1 class="text-xl font-semibold">{{ t('collections.notFound') }}</h1>
          <UButton
            class="mt-4 rounded-xl"
            variant="ghost"
            color="neutral"
            :to="localePath('/collections')"
            :label="t('nav.account.collections')"
          />
        </div>

        <template v-else-if="data">
          <div class="mb-8">
            <h1 class="text-3xl font-semibold tracking-tight">{{ title }}</h1>
            <p v-if="data.collection.summary" class="mt-2 max-w-prose text-muted">
              {{ data.collection.summary }}
            </p>
            <p class="mt-3 flex flex-wrap items-center gap-2 text-sm text-dimmed">
              <NuxtLink
                v-if="data.owner?.username"
                :to="localePath(`/u/${data.owner.username}`)"
                class="hover:underline"
              >
                {{ data.owner.name || data.owner.username }}
              </NuxtLink>
              <span>· {{ t('collections.count', { n: data.projects.length }) }}</span>
              <UBadge
                v-if="data.isOwner"
                size="sm"
                variant="subtle"
                :label="t(`collections.visibility.${data.collection.visibility}`)"
              />
            </p>
          </div>

          <ul v-if="data.projects.length" class="space-y-3">
            <li
              v-for="project in data.projects"
              :key="project.id"
              class="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
            >
              <img
                v-if="project.icon"
                :src="project.icon"
                alt=""
                class="size-12 shrink-0 rounded-xl object-cover"
              >
              <NuxtLink :to="localePath(project.path)" class="min-w-0 flex-1">
                <p class="truncate font-medium hover:underline">{{ project.title }}</p>
                <p class="truncate text-sm text-muted">{{ project.summary }}</p>
              </NuxtLink>
              <UButton
                v-if="data.isOwner"
                size="xs"
                variant="ghost"
                color="error"
                icon="i-pixelarticons-close"
                :loading="busy === project.id"
                :aria-label="t('collections.remove')"
                @click="remove(project.id)"
              />
            </li>
          </ul>

          <p v-else class="rounded-2xl border border-white/10 p-10 text-center text-sm text-dimmed">
            {{ t('collections.emptyOne') }}
          </p>
        </template>
      </section>
    </div>
  </div>
</template>
