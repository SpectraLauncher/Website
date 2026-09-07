<script setup lang="ts">
const route = useRoute()
const { t, locale } = useI18n()
const localePath = useLocalePath()

const slug = computed(() => String(route.params.slug ?? ''))
const { data } = useOrganization(slug)

const count = (n: number) => new Intl.NumberFormat(locale.value).format(n)
const when = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms))

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  published: 'success',
  unlisted: 'warning',
  pending: 'warning',
  rejected: 'error',
  removed: 'error',
}
</script>

<template>
  <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
    <h2 class="text-lg font-semibold">{{ t('catalog.org.projects') }}</h2>
    <p class="mt-1 text-sm text-muted">{{ t('catalog.org.projectsHint') }}</p>

    <ul v-if="data?.projects.length" class="mt-5 space-y-2">
      <li v-for="project in data.projects" :key="project.id">
        <NuxtLink
          :to="localePath(project.path)"
          class="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition-colors hover:border-zinc-500"
        >
          <span class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <img v-if="project.icon" :src="project.icon" alt="" class="size-full object-cover">
            <UIcon v-else name="i-pixelarticons-package" class="size-4 text-dimmed" />
          </span>

          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">{{ project.title }}</span>
            <span class="block text-xs text-dimmed">
              {{ t('catalog.downloads', { n: count(project.downloads) }) }}
              ·
              {{ when(project.updated) }}
            </span>
          </span>

          <UBadge
            variant="subtle"
            size="sm"
            :color="STATUS_COLOR[project.status] ?? 'neutral'"
            :label="t(`catalog.status.${project.status}`)"
          />
        </NuxtLink>
      </li>
    </ul>

    <p v-else class="mt-5 text-sm text-dimmed">{{ t('catalog.org.noProjects') }}</p>
  </div>
</template>
