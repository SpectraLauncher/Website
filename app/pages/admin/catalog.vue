<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const localePath = useLocalePath()
const { t } = useI18n()

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

const TYPE_IDS = ['schematic', 'resourcepack', 'shader', 'mod', 'modpack'] as const
const STATUS_IDS = ['draft', 'published', 'unlisted', 'archived', 'rejected', 'removed'] as const

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
  unlisted: 'warning',
  rejected: 'error',
}

const CHANNELS = [
  { value: 'release', label: 'Release' },
  { value: 'beta', label: 'Beta' },
  { value: 'alpha', label: 'Alpha' },
]

const CURRENCIES = [
  { value: 'eur', label: 'EUR' },
  { value: 'usd', label: 'USD' },
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
const filterType = ref('')

const selected = ref<FullProject | null>(null)
const gameVersions = ref<string[]>([])
const organizations = ref<Array<{ id: string, slug: string, name: string }>>([])
const vocabulary = ref<{ categories: Record<string, string[]>, environments: string[] }>({
  categories: {},
  environments: [],
})

const categoryOptions = computed(() =>
  (vocabulary.value.categories[selected.value?.type ?? ''] ?? [])
    .map(value => ({ value, label: t(`catalog.categoryNames.${value}`) })))

const environmentOptions = computed(() =>
  vocabulary.value.environments.map(value => ({
    value,
    label: t(`catalog.environments.${value}`),
  })))

// An empty value means the project belongs to the signed-in account; the schema
// allows exactly one of the two owners, never both and never neither.
const ownerOptions = computed(() => [
  { value: '', label: t('catalog.admin.myAccount') },
  ...organizations.value.map(org => ({ value: org.id, label: org.name })),
])

const creating = ref(false)
const draft = reactive({ title: '', type: 'schematic', slug: '', orgId: '' })
const authorship = ref(false)

const versionDraft = reactive({
  number: '',
  name: '',
  changelog: '',
  channel: 'release',
  gameVersions: [] as string[],
  loaders: [] as string[],
})

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
        query: { q: search.value || undefined, type: filterType.value || undefined, limit: 100 },
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

async function loadVocabulary() {
  try {
    vocabulary.value = await $fetch('/api/admin/catalog/vocabulary')
  } catch { vocabulary.value = { categories: {}, environments: [] } }
}

async function loadGameVersions() {
  try {
    const res = await $fetch<{ releases: string[] }>('/api/admin/catalog/game-versions')
    gameVersions.value = res.releases
  } catch { gameVersions.value = [] }
}

async function open(id: string) {
  busy.value = 'open'
  error.value = ''
  try {
    const res = await $fetch<{ project: FullProject }>(`/api/admin/catalog/projects/${id}`)
    selected.value = res.project
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
        orgId: draft.orgId || undefined,
        authorship: true,
      },
    })
    selected.value = res.project
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
        categories: p.categories,
        environment: p.environment,
      },
    })
    selected.value = { ...res.project, versions: p.versions }
    announce(t('catalog.admin.saved'))
    await loadProjects()
  } catch (e) { fail(e) } finally { busy.value = '' }
}

async function remove() {
  if (!selected.value) return
  if (!confirm(t('catalog.admin.confirmDelete', { title: selected.value.title }))) return
  busy.value = 'delete'
  try {
    await $fetch(`/api/admin/catalog/projects/${selected.value.id}`, { method: 'DELETE' })
    selected.value = null
    announce(t('catalog.admin.deleted'))
    await loadProjects()
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

async function removeVersion(id: string) {
  if (!selected.value) return
  if (!confirm(t('catalog.admin.confirmDeleteVersion'))) return
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
  loadGameVersions()
  loadOrganizations()
  loadVocabulary()
})

useSeoMeta({ title: () => t('catalog.admin.title'), robots: 'noindex' })
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-7xl px-4 pb-24 pt-40">
        <div class="mb-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="flex flex-wrap items-center gap-5">
            <span class="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5">
              <UIcon name="i-lucide-package" class="size-6 text-primary" />
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
              icon="i-lucide-arrow-left"
              :label="t('catalog.admin.backToPanel')"
              :to="localePath('/admin')"
            />
            <UButton
              size="lg"
              class="rounded-xl"
              icon="i-lucide-plus"
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
          icon="i-lucide-triangle-alert"
          :description="error"
        />
        <UAlert
          v-if="notice"
          color="success"
          variant="subtle"
          class="mb-4 rounded-2xl"
          icon="i-lucide-check"
          :description="notice"
        />

        <div class="grid gap-4 lg:grid-cols-[340px_1fr]">
          <aside class="rounded-3xl border border-zinc-600/50 bg-black/30 p-4 backdrop-blur-sm">
            <div class="flex gap-2">
              <UInput
                v-model="search"
                :placeholder="t('catalog.admin.searchPlaceholder')"
                icon="i-lucide-search"
                class="flex-1"
                @keyup.enter="loadProjects"
              />
              <UButton
                variant="subtle"
                color="neutral"
                icon="i-lucide-refresh-cw"
                :loading="busy === 'list'"
                @click="loadProjects"
              />
            </div>

            <USelect
              v-model="filterType"
              class="mt-2 w-full"
              :items="[{ value: '', label: t('catalog.admin.allTypes') }, ...TYPES]"
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
                <h2 class="min-w-0 flex-1 truncate text-lg font-semibold">{{ selected.title }}</h2>
                <UBadge variant="subtle" :label="selected.type" />
                <UButton
                  variant="ghost"
                  color="error"
                  icon="i-lucide-trash-2"
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
                  v-model="selected.orgId"
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
                icon="i-lucide-scale"
                :description="saleNote"
              />

              <p class="mt-3 text-xs text-dimmed">
                {{ t('catalog.admin.publicAddress', { path: selected.path }) }}
              </p>
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
                      color="error"
                      size="xs"
                      icon="i-lucide-trash-2"
                      @click="removeVersion(version.id)"
                    />
                  </div>
                  <div
                    v-for="file in version.files"
                    :key="file.id"
                    class="mt-2 flex items-center gap-2 text-xs text-muted"
                  >
                    <UIcon name="i-lucide-file" class="size-3.5" />
                    <span class="truncate">{{ file.filename }}</span>
                    <span class="text-dimmed">{{ sizeLabel(file.size) }}</span>
                    <code class="truncate text-dimmed">{{ file.hashes.sha1.slice(0, 12) }}…</code>
                  </div>
                </li>
              </ul>

              <div class="rounded-2xl border border-dashed border-white/15 p-4">
                <label class="flex cursor-pointer items-center gap-3">
                  <UIcon name="i-lucide-upload" class="size-5 text-primary" />
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
                icon="i-lucide-plus"
                :loading="busy === 'version'"
                :disabled="!versionDraft.number.trim()"
                @click="addVersion"
              />
            </div>

            <div
              v-if="!selected && !creating"
              class="rounded-3xl border border-zinc-600/50 bg-black/30 p-12 text-center backdrop-blur-sm"
            >
              <UIcon name="i-lucide-package-open" class="mx-auto size-10 text-dimmed" />
              <p class="mt-3 text-sm text-muted">{{ t('catalog.admin.pickOne') }}</p>
            </div>
          </main>
        </div>
      </section>
    </div>
  </div>
</template>
