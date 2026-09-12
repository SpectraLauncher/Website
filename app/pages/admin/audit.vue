<script setup lang="ts">
interface AuditEntry {
  id: string
  actorId: string | null
  actor: string
  action: string
  subjectKind: string
  subjectId: string
  summary: string
  meta: Record<string, unknown>
  source: string
  created: number
}

definePageMeta({ middleware: 'admin' })

const { t, locale } = useI18n()
const localePath = useLocalePath()

// A prefix, because the server matches on one: "project" answers with approvals,
// rejections and removals together, which is how somebody actually looks.
const GROUPS = ['', 'project', 'report', 'user', 'verification', 'badge', 'post', 'newsletter'] as const

const group = ref<string>('')
const page = ref(0)
const PER_PAGE = 50

const { data, status } = await useFetch<{ entries: AuditEntry[], total: number }>('/api/admin/audit', {
  query: computed(() => ({
    action: group.value || undefined,
    limit: PER_PAGE,
    offset: page.value * PER_PAGE,
  })),
})

watch(group, () => { page.value = 0 })

const entries = computed(() => data.value?.entries ?? [])
const total = computed(() => data.value?.total ?? 0)

const when = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ms))

// The colour says what kind of action it was, not which row it is: a removal and
// a rejection read the same at a glance otherwise.
const TONE: Record<string, string> = {
  approve: 'success',
  reject: 'error',
  remove: 'error',
  delete: 'error',
  ban: 'error',
  unban: 'warning',
  revoke: 'warning',
  send: 'info',
}

const tone = (action: string) => TONE[action.split('.')[1] ?? ''] ?? 'neutral'

const SUBJECT_PATH: Record<string, (id: string) => string> = {
  user: id => `/admin?tab=users&id=${encodeURIComponent(id)}`,
  project: id => `/admin/catalog?id=${encodeURIComponent(id)}`,
  post: id => `/admin/posts?id=${encodeURIComponent(id)}`,
}

const subjectTo = (entry: AuditEntry) =>
  (entry.subjectId && SUBJECT_PATH[entry.subjectKind]
    ? localePath(SUBJECT_PATH[entry.subjectKind]!(entry.subjectId))
    : undefined)

useSeoMeta({ title: () => t('audit.title'), robots: 'noindex' })
</script>

<template>
  <UiPageShell width="max-w-6xl">
    <UiPageHeader :title="t('audit.title')" :description="t('audit.lead')">
      <div class="flex flex-wrap gap-2 pb-1.5">
        <UButton
          variant="subtle"
          color="neutral"
          size="lg"
          icon="i-pixelarticons-arrow-left"
          :label="t('catalog.admin.backToPanel')"
          :to="localePath('/admin')"
        />
      </div>
    </UiPageHeader>

    <div class="mb-4 flex flex-wrap items-center gap-1.5">
      <UButton
        v-for="entry in GROUPS"
        :key="entry || 'all'"
        size="sm"
        color="neutral"
        :variant="group === entry ? 'subtle' : 'ghost'"
        :label="entry ? t(`audit.groups.${entry}`) : t('audit.groups.all')"
        @click="group = entry"
      />
      <span class="ml-auto font-mono text-xs text-dimmed">{{ total }}</span>
    </div>

    <UiPanel class="overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[46rem] text-sm">
          <thead>
            <tr class="border-b border-panel-line text-left text-xs uppercase tracking-[0.09em] text-dimmed">
              <th class="px-4 py-3 font-semibold">{{ t('audit.when') }}</th>
              <th class="px-4 py-3 font-semibold">{{ t('audit.who') }}</th>
              <th class="px-4 py-3 font-semibold">{{ t('audit.what') }}</th>
              <th class="px-4 py-3 font-semibold">{{ t('audit.source') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in entries"
              :key="entry.id"
              class="border-b border-raised-line last:border-b-0"
            >
              <td class="whitespace-nowrap px-4 py-3 font-mono text-xs text-dimmed">
                {{ when(entry.created) }}
              </td>
              <td class="px-4 py-3 font-medium text-highlighted">{{ entry.actor || '—' }}</td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap items-center gap-2">
                  <UBadge size="sm" variant="subtle" :color="tone(entry.action)" :label="entry.action" />
                  <NuxtLink
                    v-if="subjectTo(entry)"
                    :to="subjectTo(entry)"
                    class="text-muted underline-offset-2 transition-colors hover:text-default hover:underline"
                  >
                    {{ entry.summary }}
                  </NuxtLink>
                  <span v-else class="text-muted">{{ entry.summary }}</span>
                </div>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-xs text-dimmed">{{ entry.source }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="!entries.length" class="p-12 text-center text-sm text-dimmed">
        {{ status === 'pending' ? '…' : t('audit.empty') }}
      </p>
    </UiPanel>

    <div v-if="total > PER_PAGE" class="mt-4 flex items-center justify-between gap-3">
      <UButton
        color="neutral"
        variant="subtle"
        icon="i-pixelarticons-chevron-left"
        :disabled="page === 0"
        :label="t('audit.newer')"
        @click="page--"
      />
      <span class="font-mono text-xs text-dimmed">{{ page + 1 }}</span>
      <UButton
        color="neutral"
        variant="subtle"
        trailing-icon="i-pixelarticons-chevron-right"
        :disabled="(page + 1) * PER_PAGE >= total"
        :label="t('audit.older')"
        @click="page++"
      />
    </div>
  </UiPageShell>
</template>
