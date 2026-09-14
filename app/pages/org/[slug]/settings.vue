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

// To add a tab: one entry here and one page under settings/ whose file name
// matches `to` — the address is built by gluing it onto the settings path, so
// an entry naming a page that is not there renders the frame and nothing in it.
const TABS = [
  { id: 'overview', to: '', icon: 'i-pixelarticons-gear' },
  { id: 'members', to: '/members', icon: 'i-pixelarticons-users' },
  { id: 'projects', to: '/projects', icon: 'i-pixelarticons-package' },
  { id: 'split', to: '/split', icon: 'i-pixelarticons-coin' },
  { id: 'analytics', to: '/analytics', icon: 'i-pixelarticons-chart-line' },
]

const tabs = computed<SideNavItem[]>(() => TABS.map(tab => ({
  id: tab.id,
  icon: tab.icon,
  label: t(`catalog.org.tabs.${tab.id}`),
  to: localePath(`/org/${slug.value}/settings${tab.to}`),
})))

// A prefix match would light both Overview and Members on the members page, so
// the current entry is the one whose address is exactly this one.
const here = computed(() => route.path.replace(/\/$/, ''))
const current = computed(() => tabs.value.find(tab => tab.to === here.value)?.id ?? 'overview')

useSeoMeta({
  title: () => `${org.value?.name ?? ''} — ${t('catalog.org.settings')}`,
  robots: 'noindex',
})
</script>

<template>
  <UiPageShell width="max-w-6xl">
    <!-- The identity sits in the sidebar with the navigation, so both columns
         start at the top. A header spanning the full width above them pushes the
         tabs into the middle of the page, which is the one thing this layout
         exists to avoid. -->
    <div class="grid gap-4 lg:grid-cols-[260px_1fr] lg:items-start">
      <UiSideNav :model-value="current" :items="tabs">
        <template #header>
          <NuxtLink
            :to="localePath(`/org/${slug}`)"
            class="flex items-center gap-3 rounded-xl px-1.5 py-1 transition-colors hover:bg-white/5"
          >
            <span class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-raised-line bg-raised">
              <img v-if="org?.logo" :src="org.logo" alt="" class="size-full object-cover">
              <UIcon v-else name="i-pixelarticons-users" class="size-5 text-dimmed" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-bold text-highlighted">{{ org?.name }}</span>
              <span class="block truncate text-xs text-dimmed">
                {{ t('catalog.org.memberCount', { n: data?.members.length ?? 0 }) }}
              </span>
            </span>
            <UIcon name="i-pixelarticons-arrow-left" class="size-4 shrink-0 text-dimmed" />
          </NuxtLink>
        </template>
      </UiSideNav>

      <div class="min-w-0">
        <NuxtPage />
      </div>
    </div>
  </UiPageShell>
</template>
