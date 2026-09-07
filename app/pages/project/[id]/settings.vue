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
  { id: 'gallery', to: '/gallery', icon: 'i-pixelarticons-image', need: 'edit_details' },
  { id: 'links', to: '/links', icon: 'i-pixelarticons-link', need: 'edit_details' },
  { id: 'versions', to: '/versions', icon: 'i-pixelarticons-archive', need: 'upload_version' },
  { id: 'members', to: '/members', icon: 'i-pixelarticons-users', need: 'edit_member' },
  { id: 'analytics', to: '/analytics', icon: 'i-pixelarticons-chart-line', need: 'view_analytics' },
] as const

const tabs = computed(() => TABS
  .filter(tab => may(tab.need))
  .map(tab => ({ ...tab, path: localePath(`${base.value}${tab.to}`) })))

const here = computed(() => route.path.replace(/\/$/, ''))

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
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <!-- Not v-if="project": a child route cannot mount into a parent that has
           not rendered <NuxtPage /> yet, so on a hard refresh of a tab the whole
           page came up empty. The shell is always here; the parts that need the
           project wait for it. -->
      <!-- Without this the page is a background and nothing else: no data, no
           tabs, no message, and nothing in the console either, because a
           refused fetch is an error state rather than a thrown one. -->
      <section
        v-if="error"
        class="container mx-auto max-w-2xl px-4 py-40 text-center"
      >
        <h1 class="text-2xl font-semibold">{{ t('catalog.notFound') }}</h1>
        <p class="mt-2 text-sm text-muted">{{ t('catalog.noRightsHere') }}</p>
        <UButton
          class="mt-6 rounded-xl"
          variant="subtle"
          color="neutral"
          :to="localePath('/projects')"
          :label="t('nav.account.projects')"
        />
      </section>

      <section v-else class="container mx-auto max-w-6xl px-4 pb-24 pt-40">
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

        <div class="grid gap-8 lg:grid-cols-[240px_1fr] lg:items-start">
          <aside class="space-y-4 lg:sticky lg:top-28">
            <NuxtLink
              v-if="project"
              :to="localePath(project.path)"
              class="flex items-center gap-3 rounded-2xl border border-zinc-600/50 bg-black/30 p-4 backdrop-blur-sm transition-colors hover:border-zinc-500"
            >
              <span class="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                <img v-if="project.icon" :src="project.icon" alt="" class="size-full object-cover">
                <UIcon v-else name="i-pixelarticons-package" class="size-5 text-dimmed" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold">{{ project.title }}</span>
                <span class="block text-xs text-dimmed">{{ t(`catalog.status.${project.status}`) }}</span>
              </span>
              <UIcon name="i-pixelarticons-arrow-left" class="size-4 shrink-0 text-dimmed" />
            </NuxtLink>

            <p class="px-1 text-xs font-semibold uppercase tracking-wide text-dimmed">
              {{ t('catalog.settings') }}
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
                    {{ t(`catalog.projectTabs.${tab.id}`) }}
                  </NuxtLink>
                </li>
              </ul>
            </nav>
          </aside>

          <div class="min-w-0">
            <p v-if="status === 'pending' && !project" class="text-sm text-dimmed">
              {{ t('catalog.loading') }}
            </p>
            <NuxtPage />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
