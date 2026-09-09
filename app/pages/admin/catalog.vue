<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const localePath = useLocalePath()
const { t } = useI18n()
const { ask } = useConfirm()

interface ShortProject {
  id: string
  slug: string
  type: string
  path: string
  title: string
  summary: string
  status: string
  icon: string | null
  categories: string[]
  gameVersions: string[]
  loaders: string[]
  downloads: number
  updated: number
}

interface VersionFile {
  id: string
  filename: string
  size: number
  hashes: { sha1: string, sha512: string }
  primary: boolean
  url: string | null
}

interface Version {
  id: string
  number: string
  name: string
  changelog: string
  channel: string
  gameVersions: string[]
  loaders: string[]
  downloads: number
  created: number
  meta: Record<string, unknown>
  files: VersionFile[]
}

interface FullProject extends ShortProject {
  orgId: string | null
  environment: string[]
  price: number
  currency: string
  description: string
  license: string | null
  licenseUrl: string | null
  links: Record<string, string>
  meta: Record<string, unknown>
  versions: Version[]
}

interface Warning {
  code: string
  params: Record<string, string>
}

interface Analysis {
  detected: string | null
  environment: string[]
  title: string | null
  slug: string | null
  summary: string | null
  version: string | null
  license: string | null
  links: Record<string, string>
  loaders: string[]
  gameVersionRange: string | null
  gameVersions: string[]
  meta: Record<string, unknown>
  warnings: Warning[]
}

// reka-ui reserves the empty string for "nothing is selected", so a select item
// may not use it as a value. Both sentinels below stand for a real choice, and
// are translated back at the edges: the wire format is unchanged.
const OWN_ACCOUNT = 'me'
const ANY_TYPE = 'all'

const TYPE_IDS = ['schematic', 'resourcepack', 'shader', 'mod', 'plugin', 'modpack'] as const
const STATUS_IDS = PROJECT_STATUSES

const TYPES = computed(() =>
  TYPE_IDS.map(id => ({ value: id, label: t(`catalog.admin.types.${id}`) })))

const STATUSES = computed(() =>
  STATUS_IDS.map(id => ({ value: id, label: t(`catalog.admin.statuses.${id}`) })))

const statusBadge = (status: string) =>
  (STATUS_IDS as readonly string[]).includes(status)
    ? t(`catalog.admin.badges.${status}`)
    : status

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  published: 'success',
  pending: 'warning',
  unlisted: 'warning',
  rejected: 'error',
}

interface QueueEntry {
  id: string
  title: string
  path: string
  type: string
  status: string
  icon: string | null
  waiting: number
  owner: { kind: string, slug: string | null, name: string | null, image: string | null } | null
}

const queue = ref<QueueEntry[]>([])
const queueCounts = ref({ pending: 0, rejected: 0, draft: 0 })
const queueStatus = ref('pending')

async function loadQueue() {
  busy.value = 'queue'
  try {
    const res = await $fetch<{ hits: QueueEntry[], counts: typeof queueCounts.value }>(
      '/api/admin/catalog/queue', { query: { status: queueStatus.value } })
    queue.value = res.hits
    queueCounts.value = res.counts
  } catch (e) { fail(e) } finally { busy.value = '' }
}

// Days rather than a date: what matters in a queue is how long somebody has
// been waiting, not when they pressed the button.
function waitingDays(ms: number): number {
  return Math.floor(ms / 86_400_000)
}

const CHANNELS = [
  { value: 'release', label: 'Release' },
  { value: 'beta', label: 'Beta' },
  { value: 'alpha', label: 'Alpha' },
]

const CURRENCIES = [
  { value: 'eur', label: 'EUR' },
]

const LICENSES = [
  'MIT', 'Apache-2.0', 'LGPL-3.0-only', 'LGPL-2.1-only', 'GPL-3.0-only', 'MPL-2.0',
  'BSD-3-Clause', 'ISC', 'Zlib', 'Unlicense', 'CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0',
  'CC-BY-NC-SA-4.0', 'ARR', 'other',
].map(id => ({ value: id, label: id }))

const busy = ref('')
const error = ref('')
const notice = ref('')

const projects = ref<ShortProject[]>([])
const total = ref(0)
const search = ref('')
const filterType = ref(ANY_TYPE)

const selected = ref<FullProject | null>(null)
const gameVersions = ref<string[]>([])
const organizations = ref<Array<{ id: string, slug: string, name: string }>>([])
// The categories and environments are a registry in shared/utils, so both sides
// already have them — there is nothing to fetch.
const categoryOptions = computed(() =>
  (CATEGORIES[selected.value?.type as keyof typeof CATEGORIES] ?? [])
    .map(value => ({ value, label: t(`catalog.categoryNames.${value}`) })))

const environmentOptions = computed(() =>
  ENVIRONMENTS.map(value => ({
    value,
    label: t(`catalog.environments.${value}`),
  })))

// The schema allows exactly one of the two owners, never both and never neither.
const ownerOptions = computed(() => [
  { value: OWN_ACCOUNT, label: t('catalog.admin.myAccount') },
  ...organizations.value.map(org => ({ value: org.id, label: org.name })),
])

// selected.orgId is null for the admin's own project; the select needs a value.
const selectedOwner = computed({
  get: () => selected.value?.orgId ?? OWN_ACCOUNT,
  set: (value: string) => {
    if (selected.value) selected.value.orgId = value === OWN_ACCOUNT ? null : value
  },
})

const creating = ref(false)
const draft = reactive({ title: '', type: 'schematic', slug: '', orgId: OWN_ACCOUNT })
const authorship = ref(false)

const versionDraft = reactive({
  number: '',
  name: '',
  changelog: '',
  channel: 'release',
  gameVersions: [] as string[],
  loaders: [] as string[],
})

interface GalleryImage {
  id: string
  url: string
  title: string
  ordering: number
  featured: boolean
}

const gallery = ref<GalleryImage[]>([])

const pendingFile = ref<{
  filename: string
  size: number
  sha1: string
  sha512: string
  url: string | null
} | null>(null)
const analysis = ref<Analysis | null>(null)

function fail(e: any) {
  error.value = e?.data?.statusMessage || e?.message || t('catalog.admin.genericError')
}

function announce(message: string) {
  notice.value = message
  error.value = ''
  setTimeout(() => (notice.value = ''), 4000)
}

async function loadProjects() {
  busy.value = 'list'
  error.value = ''
  try {
    const res = await $fetch<{ hits: ShortProject[], total: number }>(
      '/api/admin/catalog/projects', {
        query: { q: search.value || undefined, type: filterType.value === ANY_TYPE ? undefined : filterType.value, limit: 100 },
      })
    projects.value = res.hits
    total.value = res.total
  } catch (e) { fail(e) } finally { busy.value = '' }
}

async function loadOrganizations() {
  try {
    const res = await $fetch<{ organizations: typeof organizations.value }>('/api/org/mine')
    organizations.value = res.organizations
  } catch { organizations.value = [] }
}

async function loadGameVersions() {
  try {
    const res = await $fetch<{ releases: string[] }>('/api/admin/catalog/game-versions')
    gameVersions.value = res.releases
  } catch { gameVersions.value = [] }
}

function withAllLinks(project: FullProject): FullProject {
  const links: Record<string, string> = {}
  for (const kind of LINK_KINDS) links[kind] = project.links?.[kind] ?? ''
  return { ...project, links }
}

const decisionNote = ref('')

const disclosures = ref<DisclosureMap>({})

function loadDisclosures(project: FullProject) {
  disclosures.value = JSON.parse(JSON.stringify(project.disclosures ?? {}))
}

function toggleDisclosure(key: DisclosureKey) {
  if (disclosures.value[key]) {
    const next = { ...disclosures.value }
    delete next[key]
    disclosures.value = next
    return
  }
  disclosures.value = { ...disclosures.value, [key]: { note: '', options: [], lock: 'open' } }
}

function toggleOption(key: DisclosureKey, option: string) {
  const entry = disclosures.value[key]
  if (!entry) return

  entry.options = entry.options.includes(option)
    ? entry.options.filter(o => o !== option)
    : [...entry.options, option]
}

const saveDisclosures = async () => {
  if (!selected.value) return
  busy.value = 'disclosures'
  try {
    await $fetch(`/api/admin/catalog/projects/${selected.value.id}/disclosures`, {
      method: 'PATCH',
      body: { disclosures: disclosures.value },
    })
    announce(t('catalog.admin.saved'))
  } catch (e) { fail(e) } finally { busy.value = '' }
}

const lockChoices = computed(() =>
  LOCK_STATES.map(value => ({ value, label: t(`disclosures.lock.${value}`) })))

interface ReportEntry {
  id: string
  reason: string
  itemType: string
  body: string
  status: string
  created: number
  target: { label: string, path: string } | null
  reporter: { username: string | null, name: string | null } | null
}

const reports = ref<ReportEntry[]>([])
const openReports = ref(0)
const reportNote = ref<Record<string, string>>({})

async function loadReports() {
  busy.value = 'reports'
  try {
    const res = await $fetch<{ reports: ReportEntry[], open: number }>(
      '/api/admin/catalog/reports')
    reports.value = res.reports
    openReports.value = res.open
  } catch (e) { fail(e) } finally { busy.value = '' }
}

async function decideReport(report: ReportEntry, status: 'resolved' | 'dismissed') {
  busy.value = report.id
  try {
    await $fetch(`/api/admin/catalog/reports/${report.id}`, {
      method: 'PATCH',
      body: { status, note: reportNote.value[report.id] ?? '' },
    })
    delete reportNote.value[report.id]
    await loadReports()
  } catch (e) { fail(e) } finally { busy.value = '' }
}

async function moderate(decision: 'approve' | 'reject' | 'remove') {
  if (!selected.value) return
  busy.value = decision
  error.value = ''
  try {
    const res = await $fetch<{ project: FullProject }>(
      `/api/admin/catalog/projects/${selected.value.id}/moderate`,
      { method: 'POST', body: { decision, body: decisionNote.value } },
    )
    selected.value = { ...withAllLinks(res.project), versions: selected.value.versions }
    decisionNote.value = ''
    announce(t('catalog.admin.saved'))
    await Promise.all([loadProjects(), loadQueue()])
  } catch (e) { fail(e) } finally { busy.value = '' }
}

async function open(id: string) {
  busy.value = 'open'
  error.value = ''
  try {
    const res = await $fetch<{ project: FullProject, gallery: GalleryImage[] }>(
      `/api/admin/catalog/projects/${id}`)
    selected.value = withAllLinks(res.project)
    loadDisclosures(res.project)
    gallery.value = res.gallery ?? []
  } catch (e) { fail(e) } finally { busy.value = '' }
}

async function create() {
  if (!draft.title.trim() || !authorship.value) return
  busy.value = 'create'
  error.value = ''
  try {
    const res = await $fetch<{ project: FullProject }>('/api/admin/catalog/projects', {
      method: 'POST',
      body: {
        title: draft.title,
        type: draft.type,
        slug: draft.slug || undefined,
        orgId: draft.orgId === OWN_ACCOUNT ? undefined : draft.orgId,
        authorship: true,
      },
    })
    selected.value = withAllLinks(res.project)
    creating.value = false
    draft.title = ''
    draft.slug = ''
    authorship.value = false
    announce(t('catalog.admin.created'))
    await loadProjects()
  } catch (e) { fail(e) } finally { busy.value = '' }
}

async function save() {
  if (!selected.value) return
  busy.value = 'save'
  error.value = ''
  try {
    const p = selected.value
    const res = await $fetch<{ project: FullProject }>(`/api/admin/catalog/projects/${p.id}`, {
      method: 'PATCH',
      body: {
        slug: p.slug,
        title: p.title,
        summary: p.summary,
        description: p.description,
        status: p.status,
        license: p.license,
        licenseUrl: p.licenseUrl,
        icon: p.icon,
        categories: p.categories,
        links: p.links,
        orgId: p.orgId ?? '',
        price: Math.round(Number(p.price) || 0),
        currency: p.currency || 'eur',
        environment: p.environment,
      },
    })
    selected.value = { ...withAllLinks(res.project), versions: p.versions }
    announce(t('catalog.admin.saved'))
    await loadProjects()
  } catch (e) { fail(e) } finally { busy.value = '' }
}

async function remove() {
  if (!selected.value) return
  const ok = await ask({
    title: t('catalog.admin.confirmDelete', { title: selected.value.title }),
    confirmLabel: t('catalog.admin.delete'),
    danger: true,
  })
  if (!ok) return
  busy.value = 'delete'
  try {
    await $fetch(`/api/admin/catalog/projects/${selected.value.id}`, { method: 'DELETE' })
    selected.value = null
    announce(t('catalog.admin.deleted'))
    await loadProjects()
  } catch (e) { fail(e) } finally { busy.value = '' }
}

async function uploadIcon(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !selected.value) return

  busy.value = 'icon'
  error.value = ''
  try {
    const res = await $fetch<{ icon: string }>(
      `/api/admin/catalog/projects/${selected.value.id}/icon`, {
        method: 'POST',
        body: await file.arrayBuffer(),
        headers: { 'content-type': file.type },
      })
    selected.value.icon = res.icon
    await loadProjects()
  } catch (e) { fail(e) } finally { busy.value = '' }
}

async function uploadGallery(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !selected.value) return

  busy.value = 'gallery'
  error.value = ''
  try {
    const res = await $fetch<{ image: GalleryImage }>(
      `/api/admin/catalog/projects/${selected.value.id}/gallery`, {
        method: 'POST',
        body: await file.arrayBuffer(),
        headers: { 'content-type': file.type },
      })
    gallery.value.push(res.image)
  } catch (e) { fail(e) } finally { busy.value = '' }
}

async function removeImage(id: string) {
  busy.value = id
  try {
    await $fetch(`/api/admin/catalog/gallery/${id}`, { method: 'DELETE' })
    gallery.value = gallery.value.filter(image => image.id !== id)
  } catch (e) { fail(e) } finally { busy.value = '' }
}

async function saveImage(image: GalleryImage) {
  busy.value = image.id
  try {
    await $fetch(`/api/admin/catalog/gallery/${image.id}`, {
      method: 'PATCH',
      body: { title: image.title, featured: image.featured },
    })
  } catch (e) { fail(e) } finally { busy.value = '' }
}

async function upload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  busy.value = 'upload'
  error.value = ''
  analysis.value = null
  pendingFile.value = null

  try {
    const res = await $fetch<{ file: typeof pendingFile.value, analysis: Analysis }>(
      '/api/admin/catalog/analyze', {
        method: 'POST',
        query: { filename: file.name },
        body: await file.arrayBuffer(),
        headers: { 'content-type': 'application/octet-stream' },
      })

    pendingFile.value = res.file
    analysis.value = res.analysis

    versionDraft.number ||= res.analysis.version || ''
    if (res.analysis.loaders.length) versionDraft.loaders = res.analysis.loaders
    if (res.analysis.gameVersions.length) versionDraft.gameVersions = res.analysis.gameVersions
    if (selected.value && res.analysis.environment.length && !selected.value.environment.length) {
      selected.value.environment = res.analysis.environment
    }

    if (!selected.value && res.analysis.title) {
      draft.title = res.analysis.title
      draft.type = res.analysis.detected || draft.type
      creating.value = true
    }
  } catch (e) { fail(e) } finally { busy.value = '' }
}

async function addVersion() {
  if (!selected.value || !versionDraft.number.trim()) return
  busy.value = 'version'
  error.value = ''
  try {
    const created = await $fetch<{ version: Version }>(
      `/api/admin/catalog/projects/${selected.value.id}/versions`, {
        method: 'POST',
        body: {
          number: versionDraft.number,
          name: versionDraft.name,
          changelog: versionDraft.changelog,
          channel: versionDraft.channel,
          gameVersions: versionDraft.gameVersions,
          loaders: versionDraft.loaders,
          meta: analysis.value?.meta ?? {},
          packFiles: analysis.value?.packFiles ?? [],
        },
      })

    if (pendingFile.value) {
      await $fetch(`/api/admin/catalog/versions/${created.version.id}/files`, {
        method: 'POST',
        body: { ...pendingFile.value, primary: true },
      })
    }

    versionDraft.number = ''
    versionDraft.name = ''
    versionDraft.changelog = ''
    pendingFile.value = null
    analysis.value = null
    announce(t('catalog.admin.versionAdded'))
    await open(selected.value.id)
    await loadProjects()
  } catch (e) { fail(e) } finally { busy.value = '' }
}

const editingVersion = ref<Version | null>(null)

function startVersionEdit(version: Version) {
  editingVersion.value = { ...version, gameVersions: [...version.gameVersions] }
}

async function saveVersion() {
  const draft = editingVersion.value
  if (!draft || !selected.value) return

  busy.value = draft.id
  error.value = ''
  try {
    await $fetch(`/api/admin/catalog/versions/${draft.id}`, {
      method: 'PATCH',
      body: {
        number: draft.number,
        name: draft.name,
        changelog: draft.changelog,
        channel: draft.channel,
        gameVersions: draft.gameVersions,
        loaders: draft.loaders,
      },
    })
    editingVersion.value = null
    announce(t('catalog.admin.saved'))
    await open(selected.value.id)
  } catch (e) { fail(e) } finally { busy.value = '' }
}

async function removeVersion(id: string) {
  if (!selected.value) return
  const ok = await ask({
    title: t('catalog.admin.confirmDeleteVersion'),
    confirmLabel: t('catalog.admin.delete'),
    danger: true,
  })
  if (!ok) return
  busy.value = 'version'
  try {
    await $fetch(`/api/admin/catalog/versions/${id}`, { method: 'DELETE' })
    await open(selected.value.id)
    await loadProjects()
  } catch (e) { fail(e) } finally { busy.value = '' }
}

const sizeLabel = (bytes: number) =>
  bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`

const saleNote = computed(() => {
  const license = selected.value?.license
  if (!Number(selected.value?.price)) return null
  if (!license || license === 'other') return t('catalog.sale.unknownLicense')
  if (license === 'CC-BY-NC-SA-4.0') return t('catalog.sale.nonCommercial', { license })
  if (['GPL-3.0-only', 'LGPL-3.0-only', 'LGPL-2.1-only', 'MPL-2.0', 'CC-BY-SA-4.0'].includes(license)) {
    return t('catalog.sale.copyleft', { license })
  }
  return null
})

const materials = computed(() => {
  const list = (analysis.value?.meta?.materials ?? []) as Array<{ item: string, count: number }>
  return Array.isArray(list) ? list.slice(0, 12) : []
})

onMounted(() => {
  loadProjects()
  loadQueue()
  loadReports()
  loadGameVersions()
  loadOrganizations()
})

useSeoMeta({ title: () => t('catalog.admin.title'), robots: 'noindex' })
</script>

<template>
  <div>
    <SiteNavbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-7xl px-4 pb-24 pt-40">
        <div class="mb-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="flex flex-wrap items-center gap-5">
            <span class="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5">
              <UIcon name="i-pixelarticons-package" class="size-6 text-primary" />
            </span>

            <div class="min-w-0 flex-1">
              <h1 class="text-2xl font-semibold tracking-tight">{{ t('catalog.admin.title') }}</h1>
              <p class="truncate text-sm text-muted">{{ t('catalog.admin.subtitle', { n: total }) }}</p>
            </div>

            <UButton
              variant="ghost"
              color="neutral"
              size="lg"
              class="rounded-xl"
              icon="i-pixelarticons-arrow-left"
              :label="t('catalog.admin.backToPanel')"
              :to="localePath('/admin')"
            />
            <UButton
              size="lg"
              class="rounded-xl"
              icon="i-pixelarticons-plus"
              :label="t('catalog.admin.newProject')"
              @click="creating = true; selected = null"
            />
          </div>
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          class="mb-4 rounded-2xl"
          icon="i-pixelarticons-warning-box"
          :description="error"
        />
        <UAlert
          v-if="notice"
          color="success"
          variant="subtle"
          class="mb-4 rounded-2xl"
          icon="i-pixelarticons-check"
          :description="notice"
        />

        <div
          v-if="reports.length"
          class="mb-4 rounded-3xl border border-error/40 bg-error/5 p-6 backdrop-blur-sm"
        >
          <div class="mb-4 flex flex-wrap items-center gap-3">
            <UIcon name="i-pixelarticons-flag" class="size-5 text-error" />
            <h2 class="text-lg font-semibold">{{ t('reports.queue') }}</h2>
            <UBadge size="sm" color="error" variant="subtle" :label="String(openReports)" />
            <span class="flex-1"></span>
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-pixelarticons-refresh"
              :loading="busy === 'reports'"
              :aria-label="t('catalog.admin.refresh')"
              @click="loadReports"
            />
          </div>

          <ul class="space-y-3">
            <li
              v-for="report in reports"
              :key="report.id"
              class="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div class="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <UBadge size="sm" variant="subtle" :label="t(`reports.reasons.${report.reason}`)" />
                <UBadge size="sm" variant="subtle" color="neutral" :label="report.itemType" />
                <NuxtLink
                  v-if="report.target"
                  :to="localePath(report.target.path)"
                  class="truncate font-medium text-primary hover:underline"
                >
                  {{ report.target.label }}
                </NuxtLink>
                <span v-else class="text-dimmed">{{ t('reports.gone') }}</span>
                <span class="flex-1"></span>
                <span class="text-xs text-dimmed">
                  {{ report.reporter?.username || t('notifications.someone') }}
                </span>
              </div>

              <p class="mb-3 whitespace-pre-wrap break-words text-sm text-muted">{{ report.body }}</p>

              <UInput
                v-model="reportNote[report.id]"
                size="sm"
                class="w-full"
                :placeholder="t('reports.note')"
              />

              <div class="mt-2 flex flex-wrap justify-end gap-2">
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  :loading="busy === report.id"
                  :label="t('reports.dismiss')"
                  @click="decideReport(report, 'dismissed')"
                />
                <UButton
                  size="xs"
                  color="error"
                  variant="soft"
                  :loading="busy === report.id"
                  :label="t('reports.resolve')"
                  @click="decideReport(report, 'resolved')"
                />
              </div>
            </li>
          </ul>
        </div>

        <div class="mb-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <h2 class="mb-4 text-lg font-semibold">{{ t('ops.title') }}</h2>
          <AdminOperations />
        </div>

        <div class="mb-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="mb-4 flex flex-wrap items-center gap-3">
            <UIcon name="i-pixelarticons-inbox" class="size-5 text-muted" />
            <h2 class="text-lg font-semibold">{{ t('catalog.admin.queue') }}</h2>
            <span class="flex-1"></span>
            <UButton
              v-for="entry in ([
                { id: 'pending', n: queueCounts.pending },
                { id: 'rejected', n: queueCounts.rejected },
                { id: 'draft', n: queueCounts.draft },
              ] as const)"
              :key="entry.id"
              size="xs"
              :variant="queueStatus === entry.id ? 'solid' : 'ghost'"
              color="neutral"
              class="rounded-lg"
              :label="`${t(`catalog.admin.statuses.${entry.id}`)} (${entry.n})`"
              @click="queueStatus = entry.id; loadQueue()"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-pixelarticons-refresh"
              :loading="busy === 'queue'"
              :aria-label="t('catalog.admin.refresh')"
              @click="loadQueue"
            />
          </div>

          <ul v-if="queue.length" class="space-y-2">
            <li
              v-for="entry in queue"
              :key="entry.id"
              class="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
            >
              <img
                v-if="entry.icon"
                :src="entry.icon"
                alt=""
                class="size-9 shrink-0 rounded-lg object-cover"
              >
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">{{ entry.title }}</p>
                <p class="truncate text-xs text-dimmed">
                  {{ t(`catalog.admin.types.${entry.type}`) }}
                  <template v-if="entry.owner"> · {{ entry.owner.name || entry.owner.slug }}</template>
                </p>
              </div>
              <UBadge
                variant="subtle"
                size="sm"
                :color="waitingDays(entry.waiting) >= 7 ? 'error' : 'neutral'"
                :label="t('catalog.admin.waiting', { days: waitingDays(entry.waiting) })"
              />
              <UButton
                size="xs"
                variant="subtle"
                color="neutral"
                :label="t('catalog.admin.review')"
                @click="creating = false; open(entry.id)"
              />
            </li>
          </ul>

          <p v-else class="py-6 text-center text-sm text-dimmed">{{ t('catalog.admin.queueEmpty') }}</p>
        </div>

        <div class="grid gap-4 lg:grid-cols-[340px_1fr]">
          <aside class="rounded-3xl border border-zinc-600/50 bg-black/30 p-4 backdrop-blur-sm">
            <div class="flex gap-2">
              <UInput
                v-model="search"
                :placeholder="t('catalog.admin.searchPlaceholder')"
                icon="i-pixelarticons-search"
                class="flex-1"
                @keyup.enter="loadProjects"
              />
              <UButton
                variant="subtle"
                color="neutral"
                icon="i-pixelarticons-refresh"
                :loading="busy === 'list'"
                @click="loadProjects"
              />
            </div>

            <USelect
              v-model="filterType"
              class="mt-2 w-full"
              :items="[{ value: ANY_TYPE, label: t('catalog.admin.allTypes') }, ...TYPES]"
              value-key="value"
              @update:model-value="loadProjects"
            />

            <ul class="mt-3 space-y-1">
              <li v-for="project in projects" :key="project.id">
                <button
                  class="w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/10"
                  :class="selected?.id === project.id ? 'bg-white/10' : ''"
                  @click="creating = false; open(project.id)"
                >
                  <span class="flex items-center gap-2">
                    <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ project.title }}</span>
                    <UBadge
                      variant="subtle"
                      size="sm"
                      :color="STATUS_COLORS[project.status] ?? 'neutral'"
                      :label="statusBadge(project.status)"
                    />
                  </span>
                  <span class="truncate text-xs text-dimmed">{{ project.path }}</span>
                </button>
              </li>
              <li v-if="!projects.length && busy !== 'list'" class="px-3 py-6 text-center text-sm text-dimmed">
                {{ t('catalog.admin.emptyList') }}
              </li>
            </ul>
          </aside>

          <main class="space-y-4">
            <div v-if="creating" class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <h2 class="mb-4 text-lg font-semibold">{{ t('catalog.admin.newProject') }}</h2>
              <div class="grid gap-3 sm:grid-cols-2">
                <UInput v-model="draft.title" :placeholder="t('catalog.admin.projectTitle')" />
                <USelect v-model="draft.type" :items="TYPES" value-key="value" />
                <UInput v-model="draft.slug" :placeholder="t('catalog.admin.slugOptional')" />
                <USelect
                  v-if="organizations.length"
                  v-model="draft.orgId"
                  :items="ownerOptions"
                  value-key="value"
                />
              </div>

              <label class="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <input v-model="authorship" type="checkbox" class="mt-0.5 size-4 shrink-0 accent-primary">
                <span class="text-sm text-muted">{{ t('catalog.admin.authorship') }}</span>
              </label>

              <div class="mt-4 flex gap-2">
                <UButton
                  :label="t('catalog.admin.create')"
                  :loading="busy === 'create'"
                  :disabled="!authorship || !draft.title.trim()"
                  @click="create"
                />
                <UButton
                  variant="ghost"
                  color="neutral"
                  :label="t('catalog.admin.cancel')"
                  @click="creating = false"
                />
              </div>
            </div>

            <div
              v-if="selected"
              class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
            >
              <div class="mb-4 flex flex-wrap items-center gap-3">
                <label class="relative grid size-12 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                  <img v-if="selected.icon" :src="selected.icon" alt="" class="size-full object-cover">
                  <UIcon v-else name="i-pixelarticons-image-plus" class="size-5 text-dimmed" />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    class="hidden"
                    @change="uploadIcon"
                  >
                </label>
                <h2 class="min-w-0 flex-1 truncate text-lg font-semibold">{{ selected.title }}</h2>
                <UBadge variant="subtle" :label="selected.type" />
                <UButton
                  variant="ghost"
                  color="error"
                  icon="i-pixelarticons-trash"
                  :loading="busy === 'delete'"
                  @click="remove"
                />
                <UButton :label="t('catalog.admin.save')" :loading="busy === 'save'" @click="save" />
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <UInput v-model="selected.title" :placeholder="t('catalog.admin.projectTitle')" />
                <UInput v-model="selected.slug" placeholder="slug" />
                <UInput
                  v-model="selected.summary"
                  :placeholder="t('catalog.admin.summary')"
                  class="sm:col-span-2"
                />
                <UTextarea
                  v-model="selected.description"
                  :rows="8"
                  :placeholder="t('catalog.admin.description')"
                  class="sm:col-span-2"
                />
                <USelect v-model="selected.status" :items="STATUSES" value-key="value" />
                <USelect
                  v-model="selected.license"
                  :items="LICENSES"
                  value-key="value"
                  :placeholder="t('catalog.admin.license')"
                />
                <USelect
                  v-if="organizations.length"
                  v-model="selectedOwner"
                  :items="ownerOptions"
                  value-key="value"
                  class="sm:col-span-2"
                />
                <USelectMenu
                  v-model="selected.categories"
                  :items="categoryOptions"
                  value-key="value"
                  multiple
                  :placeholder="t('catalog.categories')"
                  class="sm:col-span-2"
                />
                <USelectMenu
                  v-model="selected.environment"
                  :items="environmentOptions"
                  value-key="value"
                  multiple
                  :placeholder="t('catalog.environment')"
                  class="sm:col-span-2"
                />
                <UInput
                  v-model.number="selected.price"
                  type="number"
                  min="0"
                  :placeholder="t('catalog.admin.price')"
                />
                <USelect v-model="selected.currency" :items="CURRENCIES" value-key="value" />
              </div>

              <p class="mt-2 text-xs text-dimmed">{{ t('catalog.admin.priceHint') }}</p>

              <UAlert
                v-if="saleNote"
                color="warning"
                variant="subtle"
                class="mt-3 rounded-2xl"
                icon="i-pixelarticons-scale"
                :description="saleNote"
              />

              <div class="mt-6">
                <h3 class="mb-1 text-sm font-semibold">{{ t('catalog.links') }}</h3>
                <p class="mb-3 text-xs text-dimmed">{{ t('catalog.admin.linksHint') }}</p>
                <div class="grid gap-2 sm:grid-cols-2">
                  <UInput
                    v-for="kind in LINK_KINDS"
                    :key="kind"
                    v-model="selected.links[kind]"
                    :icon="LINK_ICONS[kind]"
                    type="url"
                    :placeholder="t(`links.${kind}`)"
                  />
                </div>
              </div>

              <div class="mt-6">
                <h3 class="mb-1 text-sm font-semibold">{{ t('disclosures.manage') }}</h3>
                <p class="mb-3 text-xs text-dimmed">{{ t('disclosures.hint') }}</p>

                <ul class="space-y-2">
                  <li
                    v-for="key in DISCLOSURE_KEYS"
                    :key="key"
                    class="rounded-2xl border border-white/10 bg-white/5 p-3"
                  >
                    <UCheckbox
                      :model-value="Boolean(disclosures[key])"
                      :label="t(`disclosures.${key}`)"
                      size="sm"
                      @update:model-value="toggleDisclosure(key)"
                    />

                    <div v-if="disclosures[key]" class="mt-3 space-y-2 pl-6">
                      <div v-if="DISCLOSURES[key].options.length" class="flex flex-wrap gap-3">
                        <UCheckbox
                          v-for="option in DISCLOSURES[key].options"
                          :key="option"
                          :model-value="disclosures[key]!.options.includes(option)"
                          :label="t(`disclosures.options.${key}.${option}`)"
                          size="sm"
                          @update:model-value="toggleOption(key, option)"
                        />
                      </div>

                      <UInput
                        v-model="disclosures[key]!.note"
                        size="sm"
                        class="w-full"
                        :maxlength="500"
                        :placeholder="t('disclosures.note')"
                      />

                      <USelect
                        v-model="disclosures[key]!.lock"
                        :items="lockChoices"
                        value-key="value"
                        size="sm"
                        class="w-full sm:w-64"
                      />
                    </div>
                  </li>
                </ul>

                <UButton
                  class="mt-3 rounded-xl"
                  size="sm"
                  color="neutral"
                  :loading="busy === 'disclosures'"
                  :label="t('account.save')"
                  @click="saveDisclosures"
                />
              </div>

              <p class="mt-3 text-xs text-dimmed">
                {{ t('catalog.admin.publicAddress', { path: selected.path }) }}
              </p>
            </div>

            <div
              v-if="selected"
              class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
            >
              <h2 class="mb-1 text-lg font-semibold">{{ t('catalog.moderation') }}</h2>
              <p class="mb-4 text-xs text-dimmed">{{ t('catalog.admin.moderationHint') }}</p>

              <UTextarea
                v-model="decisionNote"
                :rows="3"
                :maxlength="4000"
                :placeholder="t('catalog.staffReplyPlaceholder')"
                class="w-full"
              />

              <div class="mt-3 flex flex-wrap gap-2">
                <UButton
                  color="success"
                  variant="soft"
                  class="rounded-xl"
                  icon="i-pixelarticons-check-double"
                  :loading="busy === 'approve'"
                  :label="t('catalog.admin.approve')"
                  @click="moderate('approve')"
                />
                <UButton
                  color="error"
                  variant="soft"
                  class="rounded-xl"
                  icon="i-pixelarticons-close-box"
                  :disabled="!decisionNote.trim()"
                  :loading="busy === 'reject'"
                  :label="t('catalog.admin.reject')"
                  @click="moderate('reject')"
                />
                <UButton
                  color="error"
                  variant="soft"
                  class="rounded-xl"
                  icon="i-pixelarticons-trash"
                  :disabled="!decisionNote.trim()"
                  :loading="busy === 'remove'"
                  :label="t('catalog.admin.remove')"
                  @click="moderate('remove')"
                />
              </div>

              <ProjectModeration :key="selected.slug" :slug="selected.slug" />
            </div>

            <div
              v-if="selected"
              class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
            >
              <h2 class="mb-4 text-lg font-semibold">{{ t('catalog.gallery') }}</h2>

              <ul v-if="gallery.length" class="mb-4 space-y-2">
                <li
                  v-for="image in gallery"
                  :key="image.id"
                  class="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
                >
                  <img :src="image.url" alt="" class="h-14 w-24 shrink-0 rounded-lg object-cover">
                  <UInput
                    v-model="image.title"
                    size="sm"
                    class="min-w-40 flex-1"
                    :placeholder="t('catalog.admin.imageTitle')"
                    @blur="saveImage(image)"
                  />
                  <UButton
                    size="xs"
                    :variant="image.featured ? 'solid' : 'ghost'"
                    color="neutral"
                    icon="i-pixelarticons-star"
                    :aria-label="t('catalog.admin.featured')"
                    @click="image.featured = !image.featured; saveImage(image)"
                  />
                  <UButton
                    size="xs"
                    variant="ghost"
                    color="error"
                    icon="i-pixelarticons-trash"
                    :loading="busy === image.id"
                    @click="removeImage(image.id)"
                  />
                </li>
              </ul>

              <label class="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-white/15 p-4">
                <UIcon name="i-pixelarticons-image-plus" class="size-5 text-primary" />
                <span class="text-sm">{{ t('catalog.admin.addImage') }}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  class="hidden"
                  @change="uploadGallery"
                >
              </label>
            </div>

            <div
              v-if="selected"
              class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
            >
              <h2 class="mb-4 text-lg font-semibold">{{ t('catalog.admin.versions') }}</h2>

              <ul v-if="selected.versions.length" class="mb-6 space-y-2">
                <li
                  v-for="version in selected.versions"
                  :key="version.id"
                  class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-mono text-sm">{{ version.number }}</span>
                    <UBadge variant="subtle" size="sm" :label="version.channel" />
                    <span class="text-xs text-dimmed">
                      {{ version.gameVersions.join(', ') || t('catalog.admin.noGameVersions') }}
                      <template v-if="version.loaders.length"> · {{ version.loaders.join(', ') }}</template>
                    </span>
                    <span class="flex-1"></span>
                    <UButton
                      variant="ghost"
                      color="neutral"
                      size="xs"
                      icon="i-pixelarticons-pencil"
                      @click="startVersionEdit(version)"
                    />
                    <UButton
                      variant="ghost"
                      color="error"
                      size="xs"
                      icon="i-pixelarticons-trash"
                      @click="removeVersion(version.id)"
                    />
                  </div>

                  <div v-if="editingVersion?.id === version.id" class="mt-3 grid gap-2 sm:grid-cols-2">
                    <UInput v-model="editingVersion.number" size="sm" :placeholder="t('catalog.admin.versionNumber')" />
                    <USelect v-model="editingVersion.channel" size="sm" :items="CHANNELS" value-key="value" />
                    <UInput
                      v-model="editingVersion.name"
                      size="sm"
                      class="sm:col-span-2"
                      :placeholder="t('catalog.admin.versionName')"
                    />
                    <UTextarea
                      v-model="editingVersion.changelog"
                      :rows="3"
                      class="sm:col-span-2"
                      :placeholder="t('catalog.admin.changelog')"
                    />
                    <USelectMenu
                      v-model="editingVersion.gameVersions"
                      :items="gameVersions"
                      multiple
                      class="sm:col-span-2"
                      :placeholder="t('catalog.admin.gameVersions')"
                    />
                    <div class="flex gap-2 sm:col-span-2">
                      <UButton
                        size="sm"
                        :loading="busy === version.id"
                        :label="t('catalog.admin.save')"
                        @click="saveVersion"
                      />
                      <UButton
                        size="sm"
                        variant="ghost"
                        color="neutral"
                        :label="t('catalog.admin.cancel')"
                        @click="editingVersion = null"
                      />
                    </div>
                  </div>
                  <div
                    v-for="file in version.files"
                    :key="file.id"
                    class="mt-2 flex items-center gap-2 text-xs text-muted"
                  >
                    <UIcon name="i-pixelarticons-file" class="size-3.5" />
                    <span class="truncate">{{ file.filename }}</span>
                    <span class="text-dimmed">{{ sizeLabel(file.size) }}</span>
                    <code class="truncate text-dimmed">{{ file.hashes.sha1.slice(0, 12) }}…</code>
                  </div>
                </li>
              </ul>

              <div class="rounded-2xl border border-dashed border-white/15 p-4">
                <label class="flex cursor-pointer items-center gap-3">
                  <UIcon name="i-pixelarticons-upload" class="size-5 text-primary" />
                  <span class="text-sm">
                    {{ pendingFile ? pendingFile.filename : t('catalog.admin.pickFile') }}
                  </span>
                  <input type="file" class="hidden" @change="upload">
                </label>

                <div v-if="busy === 'upload'" class="mt-2 text-xs text-dimmed">
                  {{ t('catalog.admin.readingFile') }}
                </div>

                <div v-if="analysis" class="mt-3 space-y-2 text-xs">
                  <p v-if="analysis.detected" class="text-muted">
                    {{ t('catalog.admin.detected', { kind: analysis.detected }) }}
                    <template v-if="analysis.gameVersionRange">
                      · {{ t('catalog.admin.declaredRange', { range: analysis.gameVersionRange }) }}
                    </template>
                  </p>
                  <p v-for="warning in analysis.warnings" :key="warning.code" class="text-warning">
                    {{ t(warning.code, warning.params) }}
                  </p>
                  <div v-if="materials.length" class="text-muted">
                    {{ t('catalog.admin.materials') }}:
                    <span v-for="material in materials" :key="material.item" class="text-dimmed">
                      {{ material.count }}× {{ material.item.replace('minecraft:', '') }},
                    </span>
                  </div>
                </div>
              </div>

              <div class="mt-4 grid gap-3 sm:grid-cols-2">
                <UInput v-model="versionDraft.number" :placeholder="t('catalog.admin.versionNumber')" />
                <USelect v-model="versionDraft.channel" :items="CHANNELS" value-key="value" />
                <UInput
                  v-model="versionDraft.name"
                  :placeholder="t('catalog.admin.versionName')"
                  class="sm:col-span-2"
                />
                <UTextarea
                  v-model="versionDraft.changelog"
                  :rows="3"
                  :placeholder="t('catalog.admin.changelog')"
                  class="sm:col-span-2"
                />
                <USelectMenu
                  v-model="versionDraft.gameVersions"
                  :items="gameVersions"
                  multiple
                  :placeholder="t('catalog.admin.gameVersions')"
                  class="sm:col-span-2"
                />
              </div>

              <UButton
                class="mt-4"
                :label="t('catalog.admin.addVersion')"
                icon="i-pixelarticons-plus"
                :loading="busy === 'version'"
                :disabled="!versionDraft.number.trim()"
                @click="addVersion"
              />
            </div>

            <div
              v-if="!selected && !creating"
              class="rounded-3xl border border-zinc-600/50 bg-black/30 p-12 text-center backdrop-blur-sm"
            >
              <UIcon name="i-pixelarticons-package" class="mx-auto size-10 text-dimmed" />
              <p class="mt-3 text-sm text-muted">{{ t('catalog.admin.pickOne') }}</p>
            </div>
          </main>
        </div>
      </section>
    </div>
  </div>
</template>
