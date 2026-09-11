<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

const id = computed(() => String(route.params.id ?? ''))
const { data, error, status, project, refresh, may } = useProjectEditor(id)

const base = computed(() => `/project/${id.value}/settings`)

// Modrinth's order, and for the same reason: what the project is, then what it
// says about itself, then what it ships, then who works on it. Moderation-facing
// things sit at the end because they are answered once.
const TABS = [
  // Declarations first: it is the one thing a moderator will not accept a guess
  // at, and the one an author is most likely to skip.
  { id: 'disclosures', to: '/disclosures', icon: 'i-pixelarticons-alert', need: 'edit_details' },
  { id: 'general', to: '', icon: 'i-pixelarticons-circle-info', need: 'edit_details' },
  { id: 'tags', to: '/tags', icon: 'i-pixelarticons-label', need: 'edit_details' },
  { id: 'description', to: '/description', icon: 'i-pixelarticons-align-left', need: 'edit_body' },
  { id: 'license', to: '/license', icon: 'i-pixelarticons-book-open', need: 'edit_details' },
  { id: 'pricing', to: '/pricing', icon: 'i-pixelarticons-coin', need: 'edit_details' },
  { id: 'gallery', to: '/gallery', icon: 'i-pixelarticons-image', need: 'edit_details' },
  { id: 'links', to: '/links', icon: 'i-pixelarticons-link', need: 'edit_details' },
  { id: 'versions', to: '/versions', icon: 'i-pixelarticons-archive', need: 'upload_version' },
  { id: 'members', to: '/members', icon: 'i-pixelarticons-users', need: 'edit_member' },
  { id: 'analytics', to: '/dashboard/analytics', icon: 'i-pixelarticons-chart-line', need: 'view_analytics' },
] as const

const tabs = computed<SideNavItem[]>(() => TABS
  .filter(tab => may(tab.need))
  .map(tab => ({
    id: tab.id,
    icon: tab.icon,
    label: t(`catalog.projectTabs.${tab.id}`),
    to: localePath(`${base.value}${tab.to}`),
  })))

// A prefix match would light both the first tab and the open one, so the current
// entry is the one whose address is exactly this one.
const here = computed(() => route.path.replace(/\/$/, ''))
const current = computed(() => tabs.value.find(tab => tab.to === here.value)?.id ?? 'index')

const submitting = ref(false)
const problem = ref('')

async function submit() {
  if (!project.value) return

  submitting.value = true
  problem.value = ''
  try {
    await $fetch(`/api/catalog/project/${encodeURIComponent(project.value.slug)}/submit`, {
      method: 'POST',
    })
    await refresh()
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally { submitting.value = false }
}

useSeoMeta({
  title: () => `${project.value?.title ?? ''} — ${t('catalog.settings')}`,
  robots: 'noindex',
})
</script>

<template>
  <UiPageShell>
    <!-- Not v-if="project": a child route cannot mount into a parent that has
         not rendered <NuxtPage /> yet, so on a hard refresh of a tab the whole
         page came up empty. The shell is always here; the parts that need the
         project wait for it. -->
    <UiPanel v-if="error" class="mx-auto max-w-lg p-12 text-center">
      <h1 class="text-xl font-bold text-highlighted">{{ t('catalog.notFound') }}</h1>
      <p class="mt-2 text-sm text-muted">{{ t('catalog.noRightsHere') }}</p>
      <UButton
        class="mt-6"
        variant="subtle"
        color="neutral"
        :to="localePath('/dashboard/projects')"
        :label="t('nav.account.projects')"
      />
    </UiPanel>

    <template v-else>
      <UAlert
        v-if="problem"
        color="error"
        variant="subtle"
        class="mb-6 rounded-2xl"
        icon="i-pixelarticons-warning-box"
        :description="problem"
      />

      <!-- The list of what is still missing goes above everything, because it
           is the reason most people opened this area at all. -->
      <ProjectChecklist
        v-if="project && project.status !== 'published' && project.status !== 'archived'"
        class="mb-6"
        :status="project.status"
        :slug="project.slug"
        :settings-path="base"
        :submitting="submitting"
        :project="{
          summary: project.summary,
          description: project.description,
          icon: project.icon,
          license: project.license,
          categories: project.categories,
          versions: project.versions,
          links: project.links,
          disclosures: project.disclosures,
          gallery: data?.gallery ?? [],
        }"
        @submit="submit"
      />

      <div class="grid gap-4 lg:grid-cols-[240px_1fr] lg:items-start">
        <UiSideNav :model-value="current" :items="tabs">
          <template #header>
            <NuxtLink
              v-if="project"
              :to="localePath(project.path)"
              class="flex items-center gap-3 rounded-xl px-1.5 py-1 transition-colors hover:bg-white/5"
            >
              <span class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-raised-line bg-raised">
                <img v-if="project.icon" :src="project.icon" alt="" class="size-full object-cover">
                <UIcon v-else name="i-pixelarticons-package" class="size-5 text-dimmed" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-bold text-highlighted">{{ project.title }}</span>
                <span class="block truncate text-xs text-dimmed">{{ t(`catalog.status.${project.status}`) }}</span>
              </span>
              <UIcon name="i-pixelarticons-arrow-left" class="size-4 shrink-0 text-dimmed" />
            </NuxtLink>
          </template>
        </UiSideNav>

        <div class="min-w-0">
          <p v-if="status === 'pending' && !project" class="text-sm text-dimmed">
            {{ t('catalog.loading') }}
          </p>
          <NuxtPage />
        </div>
      </div>
    </template>
  </UiPageShell>
</template>
