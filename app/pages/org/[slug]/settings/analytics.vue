<script setup lang="ts">
const route = useRoute()
const { t, locale } = useI18n()

const slug = computed(() => String(route.params.slug ?? ''))

interface Row {
  id: string
  title: string
  path: string
  views: number
  downloads: number
}

const { data, status } = await useFetch<{
  days: number
  projects: Row[]
  totals: { views: number, downloads: number }
}>(() => `/api/catalog/me/analytics?org=${encodeURIComponent(slug.value)}`)

const count = (n: number) => new Intl.NumberFormat(locale.value).format(n)
const localePath = useLocalePath()
</script>

<template>
  <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
    <h2 class="text-lg font-semibold">{{ t('catalog.org.tabs.analytics') }}</h2>
    <p class="mt-1 text-sm text-muted">
      {{ t('catalog.org.analyticsHint', { n: data?.days ?? 30 }) }}
    </p>

    <div v-if="data" class="mt-5 grid gap-3 sm:grid-cols-2">
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs text-dimmed">{{ t('account.views') }}</p>
        <p class="mt-1 text-2xl font-semibold">{{ count(data.totals.views) }}</p>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs text-dimmed">{{ t('catalog.org.downloads') }}</p>
        <p class="mt-1 text-2xl font-semibold">{{ count(data.totals.downloads) }}</p>
      </div>
    </div>

    <ul v-if="data?.projects.length" class="mt-5 space-y-2">
      <li v-for="project in data.projects" :key="project.id">
        <NuxtLink
          :to="localePath(project.path)"
          class="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition-colors hover:border-zinc-500"
        >
          <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ project.title }}</span>
          <span class="text-xs text-dimmed">
            {{ t('account.views') }} {{ count(project.views) }}
            ·
            {{ t('catalog.org.downloads') }} {{ count(project.downloads) }}
          </span>
        </NuxtLink>
      </li>
    </ul>

    <p v-else-if="status !== 'pending'" class="mt-5 text-sm text-dimmed">
      {{ t('catalog.org.noProjects') }}
    </p>
  </div>
</template>
