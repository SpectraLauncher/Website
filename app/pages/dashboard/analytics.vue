<script setup lang="ts">
definePageMeta({ middleware: 'catalog', layout: 'account' })

const { t, locale } = useI18n()
const localePath = useLocalePath()

const days = ref(30)

const { data } = await useFetch<{
  days: number
  totals: { views: number, downloads: number }
  projects: Array<{
    id: string
    title: string
    path: string
    views: number
    downloads: number
    series: Array<{ day: string, views: number, downloads: number }>
  }>
}>('/api/catalog/me/analytics', { query: computed(() => ({ days: days.value })) })

const count = (n: number) => new Intl.NumberFormat(locale.value).format(n)

// A bar per day, scaled to the busiest day in the window, so a quiet project
// still shows its shape instead of a flat line.
function bars(series: Array<{ views: number }>) {
  const peak = Math.max(1, ...series.map(point => point.views))
  return series.map(point => Math.max(2, Math.round((point.views / peak) * 100)))
}

useSeoMeta({ title: () => t('nav.account.analytics'), robots: 'noindex' })
</script>

<template>
  <div>
    <UiPageHeader :title="t('nav.account.analytics')" :description="t('account.analyticsIntro')">
      <USelect
        v-model="days"
        :items="[7, 30, 90, 365].map(value => ({ value, label: t('account.lastDays', { n: value }) }))"
        value-key="value"
        size="lg"
        class="mb-1.5 w-44"
      />
    </UiPageHeader>

    <div class="mt-8 grid gap-4 sm:grid-cols-2">
      <div class="rounded-2xl border border-panel-line bg-panel p-6">
        <p class="text-sm text-dimmed">{{ t('account.views') }}</p>
        <p class="mt-1 text-3xl font-semibold">{{ count(data?.totals.views ?? 0) }}</p>
      </div>
      <div class="rounded-2xl border border-panel-line bg-panel p-6">
        <p class="text-sm text-dimmed">{{ t('catalog.downloads', { n: '' }).trim() }}</p>
        <p class="mt-1 text-3xl font-semibold">{{ count(data?.totals.downloads ?? 0) }}</p>
      </div>
    </div>

    <ul v-if="data?.projects.length" class="mt-6 space-y-3">
      <li
        v-for="project in data.projects"
        :key="project.id"
        class="rounded-2xl border border-panel-line bg-panel p-5"
      >
        <div class="flex flex-wrap items-baseline gap-3">
          <NuxtLink :to="localePath(project.path)" class="min-w-0 flex-1 truncate font-semibold hover:underline">
            {{ project.title }}
          </NuxtLink>
          <span class="text-sm text-dimmed">
            {{ count(project.views) }} · {{ count(project.downloads) }}
          </span>
        </div>

        <div v-if="project.series.length" class="mt-3 flex h-12 items-end gap-0.5">
          <span
            v-for="(height, index) in bars(project.series)"
            :key="index"
            class="flex-1 rounded-sm bg-primary/60"
            :style="{ height: `${height}%` }"
            :title="`${project.series[index]!.day}: ${project.series[index]!.views}`"
          />
        </div>
        <p v-else class="mt-2 text-xs text-dimmed">{{ t('account.noData') }}</p>
      </li>
    </ul>

    <div v-else class="mt-10 rounded-2xl border border-panel-line bg-panel p-12 text-center">
      <UIcon name="i-pixelarticons-chart-line" class="mx-auto size-10 text-dimmed" />
      <p class="mt-3 text-sm text-muted">{{ t('account.noProjects') }}</p>
    </div>
  </div>
</template>
