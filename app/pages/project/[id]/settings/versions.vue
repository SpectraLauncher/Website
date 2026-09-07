<script setup lang="ts">
interface Upload {
  filename: string
  size: number
  sha1: string
  sha512: string
  url: string
  token: string
}

interface Analysis {
  version: string | null
  loaders: string[]
  gameVersions: string[]
  gameVersionRange: string | null
  environment: string[]
  meta: Record<string, unknown>
  warnings: Array<{ code: string, params: Record<string, string> }>
}

const route = useRoute()
const { t, locale } = useI18n()
const { ask } = useConfirm()

const id = computed(() => String(route.params.id ?? ''))
const { project, refresh } = useProjectEditor(id)

const busy = ref('')
const problem = ref('')

const path = computed(() => `/api/catalog/project/${encodeURIComponent(project.value?.slug ?? '')}`)

const when = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms))

const size = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// The file is the first step and everything else follows from it: a jar carries
// its loader, its game versions and its own version number, and it does not get
// them wrong the way a person filling a form does.
const upload = ref<Upload | null>(null)
const analysis = ref<Analysis | null>(null)

const draft = reactive({
  number: '',
  name: '',
  channel: 'release',
  changelog: '',
  gameVersions: [] as string[],
  loaders: [] as string[],
})

const gameVersions = ref<string[]>([])

onMounted(async () => {
  try {
    const res = await $fetch<{ releases: string[] }>('/api/catalog/game-versions')
    gameVersions.value = res.releases
  }
  catch { gameVersions.value = [] }
})

const dropping = ref(0)

async function take(file: File) {
  busy.value = 'upload'
  problem.value = ''
  try {
    const res = await $fetch<{ file: Upload, analysis: Analysis }>(
      `${path.value}/analyze?filename=${encodeURIComponent(file.name)}`,
      { method: 'POST', body: await file.arrayBuffer(), headers: { 'content-type': 'application/octet-stream' } },
    )

    upload.value = res.file
    analysis.value = res.analysis

    // Read out of the archive, and still editable: the reader is right almost
    // always, and "almost" is why the fields are not locked.
    draft.number = res.analysis.version ?? draft.number
    draft.name = res.analysis.version ?? draft.name
    draft.loaders = [...res.analysis.loaders]
    draft.gameVersions = [...res.analysis.gameVersions]
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally { busy.value = '' }
}

async function pick(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await take(file)
  input.value = ''
}

async function dropFile(event: DragEvent) {
  dropping.value = 0
  const file = event.dataTransfer?.files?.[0]
  if (file) await take(file)
}

const ready = computed(() => Boolean(upload.value) && Boolean(draft.number.trim()))

async function create() {
  busy.value = 'create'
  problem.value = ''
  try {
    await $fetch(`${path.value}/versions`, {
      method: 'POST',
      body: {
        number: draft.number.trim(),
        name: draft.name.trim() || draft.number.trim(),
        channel: draft.channel,
        changelog: draft.changelog,
        gameVersions: draft.gameVersions,
        loaders: draft.loaders,
        meta: analysis.value?.meta ?? {},
        files: upload.value ? [{ ...upload.value, primary: true }] : [],
      },
    })

    upload.value = null
    analysis.value = null
    draft.number = ''
    draft.name = ''
    draft.changelog = ''
    draft.gameVersions = []
    draft.loaders = []

    await refresh()
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally { busy.value = '' }
}

async function remove(version: { id: string, name: string }) {
  const ok = await ask({
    title: t('catalog.confirmDeleteVersion', { name: version.name }),
    confirmLabel: t('catalog.admin.delete'),
    danger: true,
  })
  if (!ok) return

  busy.value = version.id
  try {
    await $fetch(`${path.value}/versions/${version.id}`, { method: 'DELETE' })
    await refresh()
  }
  catch (e: any) { problem.value = e?.data?.statusMessage || t('auth.genericError') }
  finally { busy.value = '' }
}

const channelOptions = computed(() =>
  VERSION_CHANNELS.map(value => ({ value, label: t(`catalog.channels.${value}`) })))

const versionOptions = computed(() => gameVersions.value.map(value => ({ value, label: value })))
// Only the loaders that make sense for this kind of project — offering Iris on
// a plugin is offering a wrong answer.
const loaderOptions = computed(() =>
  loadersForType(project.value?.type as ProjectType).map(value => ({ value, label: value })))
</script>

<template>
  <div class="space-y-6">
    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      class="rounded-2xl"
      icon="i-pixelarticons-warning-box"
      :description="problem"
    />

    <div
      class="rounded-3xl border p-6 backdrop-blur-sm transition-colors"
      :class="dropping ? 'border-primary bg-primary/5' : 'border-zinc-600/50 bg-black/30'"
      @dragenter.prevent="dropping++"
      @dragover.prevent
      @dragleave.prevent="dropping = Math.max(0, dropping - 1)"
      @drop.prevent="dropFile"
    >
      <h2 class="mb-1 text-lg font-semibold">{{ t('catalog.addVersion') }}</h2>
      <p class="mb-5 text-sm text-muted">{{ t('catalog.settingsHint.versions') }}</p>

      <div v-if="!upload" class="rounded-2xl border border-dashed border-white/20 p-8 text-center">
        <UIcon name="i-pixelarticons-upload" class="mx-auto size-8 text-dimmed" />
        <p class="mt-3 text-sm text-muted">
          {{ dropping ? t('catalog.dropHere') : t('catalog.dropFileHint') }}
        </p>
        <label
          class="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-600/50 bg-black/30 px-3 py-2 text-sm transition-colors hover:border-zinc-500"
        >
          <UIcon :name="busy === 'upload' ? 'i-pixelarticons-loader' : 'i-pixelarticons-file'" class="size-4" />
          {{ busy === 'upload' ? t('catalog.reading') : t('catalog.chooseFile') }}
          <input type="file" class="hidden" @change="pick">
        </label>
      </div>

      <template v-else>
        <div class="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <UIcon name="i-pixelarticons-file" class="size-5 shrink-0 text-dimmed" />
          <span class="min-w-0 flex-1">
            <span class="block break-all font-mono text-xs">{{ upload.filename }}</span>
            <span class="block text-xs text-dimmed">{{ size(upload.size) }}</span>
          </span>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-pixelarticons-close"
            :aria-label="t('catalog.cancel')"
            @click="upload = null; analysis = null"
          />
        </div>

        <ul v-if="analysis?.warnings.length" class="mt-3 space-y-1">
          <li
            v-for="warning in analysis.warnings"
            :key="warning.code"
            class="flex gap-2 text-xs text-warning"
          >
            <UIcon name="i-pixelarticons-alert" class="mt-0.5 size-3.5 shrink-0" />
            {{ t(warning.code, warning.params) }}
          </li>
        </ul>

        <p class="mt-4 text-xs text-dimmed">{{ t('catalog.readFromFile') }}</p>

        <div class="mt-2 grid gap-3 sm:grid-cols-2">
          <UFormField :label="t('catalog.versionNumber')">
            <UInput v-model="draft.number" class="w-full" placeholder="1.0.0" />
          </UFormField>
          <UFormField :label="t('catalog.versionName')">
            <UInput v-model="draft.name" class="w-full" />
          </UFormField>
          <UFormField :label="t('catalog.channel')">
            <USelect v-model="draft.channel" :items="channelOptions" value-key="value" class="w-full" />
          </UFormField>
          <UFormField :label="t('catalog.loaders')">
            <USelectMenu
              v-model="draft.loaders"
              multiple
              :items="loaderOptions"
              value-key="value"
              :placeholder="t('catalog.loaders')"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('catalog.gameVersions')" class="sm:col-span-2">
            <USelectMenu
              v-model="draft.gameVersions"
              multiple
              :items="versionOptions"
              value-key="value"
              :placeholder="t('catalog.gameVersions')"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField :label="t('catalog.changelog')" class="mt-3">
          <MarkdownEditor v-model="draft.changelog" :rows="8" />
        </UFormField>

        <UButton
          class="mt-4 rounded-xl"
          icon="i-pixelarticons-plus"
          :disabled="!ready"
          :loading="busy === 'create'"
          :label="t('catalog.addVersion')"
          @click="create"
        />
      </template>
    </div>

    <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
      <h2 class="mb-4 text-lg font-semibold">{{ t('catalog.versions') }}</h2>

      <ul v-if="project?.versions.length" class="space-y-2">
        <li
          v-for="version in project.versions"
          :key="version.id"
          class="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
        >
          <UBadge size="sm" variant="subtle" :label="t(`catalog.channels.${version.channel}`)" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">{{ version.name }}</span>
            <span class="block text-xs text-dimmed">
              {{ version.gameVersions.join(', ') || '—' }}
              <template v-if="version.loaders.length"> · {{ version.loaders.join(', ') }}</template>
              · {{ when(version.created) }}
              · {{ t('catalog.fileCount', version.files.length, { n: version.files.length }) }}
            </span>
          </span>
          <UButton
            size="xs"
            variant="ghost"
            color="error"
            icon="i-pixelarticons-trash"
            :loading="busy === version.id"
            :aria-label="t('catalog.admin.delete')"
            @click="remove(version)"
          />
        </li>
      </ul>

      <p v-else class="text-sm text-dimmed">{{ t('catalog.noVersions') }}</p>
    </div>
  </div>
</template>
