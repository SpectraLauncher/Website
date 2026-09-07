<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

const slug = computed(() => String(route.params.slug ?? ''))
const { data, org, canManage } = useOrganization(slug)

// Nobody with nothing to change has a reason to be here, and the tabs would all
// be read-only forms. The public page is where they belong.
watchEffect(() => {
  if (org.value && !canManage.value) navigateTo(localePath(`/org/${slug.value}`), { replace: true })
})

// To add a tab: one entry here and one page under settings/.
const TABS = [
  { id: 'overview', to: '', icon: 'i-pixelarticons-gear' },
  { id: 'members', to: '/members', icon: 'i-pixelarticons-users' },
  { id: 'projects', to: '/projects', icon: 'i-pixelarticons-package' },
  { id: 'split', to: '/split', icon: 'i-pixelarticons-coin' },
  { id: 'analytics', to: '/analytics', icon: 'i-pixelarticons-chart-line' },
]

const tabs = computed(() => TABS.map(tab => ({
  ...tab,
  path: localePath(`/org/${slug.value}/settings${tab.to}`),
})))

// A prefix match would light both Overview and Members on the members page.
const here = computed(() => route.path.replace(/\/$/, ''))

useSeoMeta({
  title: () => `${org.value?.name ?? ''} — ${t('catalog.org.settings')}`,
  robots: 'noindex',
})
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-6xl px-4 pb-24 pt-40">
        <!-- The identity sits in the sidebar with the navigation, so both
             columns start at the top. A header spanning the full width above
             them pushes the tabs into the middle of the page, which is the one
             thing this layout exists to avoid. -->
        <div class="grid gap-8 lg:grid-cols-[260px_1fr] lg:items-start">
          <aside class="space-y-4 lg:sticky lg:top-28">
            <NuxtLink
              :to="localePath(`/org/${slug}`)"
              class="flex items-center gap-3 rounded-2xl border border-zinc-600/50 bg-black/30 p-4 backdrop-blur-sm transition-colors hover:border-zinc-500"
            >
              <span class="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                <img v-if="org?.logo" :src="org.logo" alt="" class="size-full object-cover">
                <UIcon v-else name="i-pixelarticons-users" class="size-5 text-dimmed" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold">{{ org?.name }}</span>
                <span class="block text-xs text-dimmed">
                  {{ t('catalog.org.memberCount', { n: data?.members.length ?? 0 }) }}
                </span>
              </span>
              <UIcon name="i-pixelarticons-arrow-left" class="size-4 shrink-0 text-dimmed" />
            </NuxtLink>

            <p class="px-1 text-xs font-semibold uppercase tracking-wide text-dimmed">
              {{ t('catalog.org.settings') }}
            </p>

            <nav>
              <ul class="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
                <li v-for="tab in tabs" :key="tab.id" class="shrink-0 lg:shrink">
                  <NuxtLink
                    :to="tab.path"
                    class="flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors"
                    :class="here === tab.path.replace(/\/$/, '')
                      ? 'bg-white/10 font-medium text-default'
                      : 'text-muted hover:bg-white/5 hover:text-default'"
                  >
                    <UIcon :name="tab.icon" class="size-4 shrink-0" />
                    {{ t(`catalog.org.tabs.${tab.id}`) }}
                  </NuxtLink>
                </li>
              </ul>
            </nav>
          </aside>

          <div class="min-w-0">
            <NuxtPage />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
