<script setup lang="ts">
definePageMeta({ middleware: 'catalog', layout: 'account' })

const { t } = useI18n()
const localePath = useLocalePath()
const { count, when } = useCatalogFormat()

interface Item {
  id: string
  slug: string
  path: string
  type: string
  title: string
  summary: string
  status: string
  icon: string | null
  downloads: number
  updated: number
  orgId: string | null
}

const { data } = await useFetch<{
  projects: Item[]
  organizations: Array<{ id: string, name: string }>
}>('/api/catalog/me/projects')

const orgName = (id: string | null) =>
  data.value?.organizations.find(org => org.id === id)?.name ?? null

const totalDownloads = computed(() =>
  data.value?.projects.reduce((sum, project) => sum + project.downloads, 0) ?? 0)

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  published: 'success',
  unlisted: 'warning',
  rejected: 'error',
}

useSeoMeta({ title: () => t('nav.account.projects'), robots: 'noindex' })
</script>

<template>
  <div>
    <UiPageHeader :title="t('nav.account.projects')" :description="t('account.projectsIntro')">
      <div v-if="data?.projects.length" class="flex gap-8 pb-1.5">
        <UiStat :label="t('catalog.org.projects')" :value="count(data.projects.length)" />
        <UiStat :label="t('catalog.downloadsLabel')" :value="count(totalDownloads)" />
      </div>
    </UiPageHeader>

    <UiPanel v-if="data?.projects.length" class="overflow-x-auto">
      <div class="min-w-[680px]">
        <div class="grid grid-cols-[minmax(0,2.4fr)_1fr_0.9fr_0.9fr] gap-4 border-b border-raised-line px-5 py-3 text-[11px] font-bold uppercase tracking-[0.09em] text-dimmed">
          <span>{{ t('catalog.org.projects') }}</span>
          <span>{{ t('catalog.statusLabel') }}</span>
          <span class="text-right">{{ t('catalog.downloadsLabel') }}</span>
          <span class="text-right">{{ t('catalog.updated') }}</span>
        </div>

        <NuxtLink
          v-for="project in data.projects"
          :key="project.id"
          :to="localePath(project.path)"
          class="grid grid-cols-[minmax(0,2.4fr)_1fr_0.9fr_0.9fr] items-center gap-4 border-b border-raised-line px-5 py-3.5 transition-colors last:border-b-0 hover:bg-white/5"
        >
          <span class="flex min-w-0 items-center gap-3">
            <CatalogThumb :src="project.icon" fallback="i-pixelarticons-package" class="size-10" />
            <span class="min-w-0">
              <span class="block truncate font-semibold text-highlighted">{{ project.title }}</span>
              <span class="block truncate text-xs text-dimmed">
                {{ t(`catalog.admin.types.${project.type}`) }}
                <template v-if="orgName(project.orgId)"> · {{ orgName(project.orgId) }}</template>
              </span>
            </span>
          </span>

          <span>
            <UBadge
              variant="subtle"
              size="sm"
              :color="STATUS_COLOR[project.status] ?? 'neutral'"
              :label="t(`catalog.admin.badges.${project.status}`)"
            />
          </span>

          <span class="text-right font-mono text-sm text-default">{{ count(project.downloads) }}</span>
          <span class="text-right text-xs text-dimmed">{{ when(project.updated) }}</span>
        </NuxtLink>
      </div>
    </UiPanel>

    <UiPanel v-else class="p-12 text-center">
      <UIcon name="i-pixelarticons-package" class="mx-auto size-10 text-dimmed" />
      <p class="mt-3 text-sm text-muted">{{ t('account.noProjects') }}</p>
    </UiPanel>
  </div>
</template>
