<script setup lang="ts">
const route = useRoute()
const { t, locale } = useI18n()

const id = computed(() => String(route.params.id ?? ''))

interface Row { id: string, title: string, views: number, downloads: number }

const { data, status } = await useFetch<{
  days: number
  projects: Row[]
  totals: { views: number, downloads: number }
}>(() => `/api/catalog/me/analytics?project=${encodeURIComponent(id.value)}`)

const count = (n: number) => new Intl.NumberFormat(locale.value).format(n)
</script>

<template>
  <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
    <h2 class="mb-1 text-lg font-semibold">{{ t('catalog.projectTabs.analytics') }}</h2>
    <p class="mb-5 text-sm text-muted">
      {{ t('catalog.settingsHint.analytics', { n: data?.days ?? 30 }) }}
    </p>

    <div v-if="data" class="grid gap-3 sm:grid-cols-2">
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs text-dimmed">{{ t('account.views') }}</p>
        <p class="mt-1 text-2xl font-semibold">{{ count(data.totals.views) }}</p>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs text-dimmed">{{ t('catalog.downloadsLabel') }}</p>
        <p class="mt-1 text-2xl font-semibold">{{ count(data.totals.downloads) }}</p>
      </div>
    </div>

    <p v-else-if="status !== 'pending'" class="text-sm text-dimmed">{{ t('catalog.noStats') }}</p>
  </div>
</template>
