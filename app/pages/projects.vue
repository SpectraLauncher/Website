<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const { t, locale } = useI18n()
const localePath = useLocalePath()

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

const when = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms))
const count = (n: number) => new Intl.NumberFormat(locale.value).format(n)

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  published: 'success',
  unlisted: 'warning',
  rejected: 'error',
}

useSeoMeta({ title: () => t('nav.account.projects'), robots: 'noindex' })
</script>

<template>
  <div>
    <SiteNavbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-4xl px-4 pb-24 pt-40">
        <h1 class="text-3xl font-semibold tracking-tight">{{ t('nav.account.projects') }}</h1>
        <p class="mt-3 text-base/relaxed text-muted">{{ t('account.projectsIntro') }}</p>

        <ul v-if="data?.projects.length" class="mt-8 space-y-3">
          <li
            v-for="project in data.projects"
            :key="project.id"
            class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm"
          >
            <div class="flex flex-wrap items-center gap-4">
              <span class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <img v-if="project.icon" :src="project.icon" alt="" class="size-full object-cover">
                <UIcon v-else name="i-pixelarticons-package" class="size-5 text-dimmed" />
              </span>

              <div class="min-w-0 flex-1">
                <NuxtLink :to="localePath(project.path)" class="truncate font-semibold hover:underline">
                  {{ project.title }}
                </NuxtLink>
                <p class="mt-0.5 line-clamp-1 text-sm text-muted">{{ project.summary }}</p>
                <p class="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-dimmed">
                  <span>{{ t('catalog.downloads', { n: count(project.downloads) }) }}</span>
                  <span>·</span>
                  <span>{{ when(project.updated) }}</span>
                  <template v-if="orgName(project.orgId)">
                    <span>·</span>
                    <span>{{ orgName(project.orgId) }}</span>
                  </template>
                </p>
              </div>

              <UBadge
                variant="subtle"
                size="sm"
                :color="STATUS_COLOR[project.status] ?? 'neutral'"
                :label="t(`catalog.admin.badges.${project.status}`)"
              />
            </div>
          </li>
        </ul>

        <div v-else class="mt-10 rounded-3xl border border-zinc-600/50 bg-black/30 p-12 text-center backdrop-blur-sm">
          <UIcon name="i-pixelarticons-package" class="mx-auto size-10 text-dimmed" />
          <p class="mt-3 text-sm text-muted">{{ t('account.noProjects') }}</p>
        </div>
      </section>
    </div>
  </div>
</template>
