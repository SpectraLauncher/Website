<script setup lang="ts">
definePageMeta({ middleware: 'catalog-author' })

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
  channel: string
  loaders: string[]
  gameVersions: string[]
  meta: Record<string, unknown>
  warnings: Array<{ code: string, params: Record<string, string> }>
}

const { t } = useI18n()
const localePath = useLocalePath()

const STEPS = ['basics', 'license', 'description', 'file', 'review'] as const
const step = ref(0)

const type = ref<string>(ACTIVE_TYPES[0]!)
const title = ref('')
const slug = ref('')
const slugField = useTemplateRef('slugField')
const owner = ref('me')
const visibility = ref<string>('public')

const license = ref<string | null>(null)
const licenseUrl = ref('')
const source = ref('')

const summary = ref('')
const description = ref('')
const categories = ref<string[]>([])
const icon = ref<File | null>(null)
const iconPreview = computed(() => (icon.value ? URL.createObjectURL(icon.value) : null))
const authorship = ref(false)

const created = ref<{ slug: string, path: string, status: string } | null>(null)
const upload = ref<Upload | null>(null)
const analysis = ref<Analysis | null>(null)
const version = reactive({ number: '', channel: 'release', changelog: '' })
const note = ref('')

const busy = ref('')
const problem = ref('')

watch(title, value => slugField.value?.follow(value))

const organizations = ref<Array<{ id: string, name: string, logo?: string | null }>>([])
onMounted(async () => {
  try {
    organizations.value = (await $fetch<{ organizations: typeof organizations.value }>('/api/org/mine')).organizations
  }
  catch { organizations.value = [] }
})

const typeOptions = computed(() => ACTIVE_TYPES.map(value => ({ value, label: t(`catalog.admin.types.${value}`) })))
const ownerOptions = computed(() => [
  { value: 'me', label: t('create.project.ownerSelf') },
  ...organizations.value.map(org => ({ value: org.id, label: org.name })),
])
const visibilityOptions = computed(() => VISIBILITIES.map(value => ({ value, label: t(`create.visibility.${value}`) })))
const licenseOptions = computed(() => LICENSES.map(value => ({ value, label: value })))
const channelOptions = computed(() => VERSION_CHANNELS.map(value => ({ value, label: t(`catalog.channels.${value}`) })))
const available = computed(() => CATEGORIES[type.value as ProjectType] ?? [])

const links = computed(() => (source.value.trim() ? { source: source.value.trim() } : {}))
const rule = computed(() => licenseProblem({ license: license.value, licenseUrl: licenseUrl.value, links: links.value }))
const checks = computed(() => checklistState({
  summary: summary.value,
  description: description.value,
  categories: categories.value,
}))

const stepReady = computed(() => {
  switch (STEPS[step.value]) {
    case 'basics': return Boolean(title.value.trim()) && Boolean(slug.value) && !slugProblem(slug.value)
    case 'license': return !rule.value
    case 'description': return checks.value.summary && checks.value.description && checks.value.categories && authorship.value
    case 'file': return Boolean(upload.value) && Boolean(version.number.trim())
    default: return true
  }
})

function toggleCategory(category: string) {
  categories.value = categories.value.includes(category)
    ? categories.value.filter(c => c !== category)
    : [...categories.value, category]
}

function pickIcon(event: Event) {
  const input = event.target as HTMLInputElement
  icon.value = input.files?.[0] ?? null
  input.value = ''
}

const failed = (e: any) => { problem.value = e?.data?.statusMessage || t('auth.genericError') }

async function run(name: string, task: () => Promise<void>) {
  busy.value = name
  problem.value = ''
  try { await task() }
  catch (e) { failed(e) }
  finally { busy.value = '' }
}

const api = computed(() => `/api/catalog/project/${encodeURIComponent(created.value?.slug ?? '')}`)

const createProject = () => run('create', async () => {
  const res = await $fetch<{ project: { slug: string, path: string, status: string } }>('/api/catalog/projects', {
    method: 'POST',
    body: {
      type: type.value,
      title: title.value.trim(),
      slug: slug.value,
      orgId: owner.value === 'me' ? undefined : owner.value,
      visibility: visibility.value,
      summary: summary.value.trim(),
      description: description.value,
      categories: categories.value,
      license: license.value,
      licenseUrl: license.value === 'other' ? licenseUrl.value.trim() : undefined,
      links: links.value,
      authorship: true,
    },
  })
  created.value = res.project
  step.value = STEPS.indexOf('file')

  if (icon.value) {
    await $fetch(`${api.value}/icon`, {
      method: 'POST',
      body: await icon.value.arrayBuffer(),
      headers: { 'content-type': icon.value.type },
    }).catch(failed)
  }
})

async function takeFile(file: File) {
  await run('upload', async () => {
    const res = await $fetch<{ file: Upload, analysis: Analysis }>(
      `${api.value}/analyze?filename=${encodeURIComponent(file.name)}`,
      { method: 'POST', body: await file.arrayBuffer(), headers: { 'content-type': 'application/octet-stream' } },
    )
    upload.value = res.file
    analysis.value = res.analysis
    version.number = res.analysis.version ?? version.number
    version.channel = res.analysis.channel || version.channel
  })
}

async function pickFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await takeFile(file)
}

const addVersion = () => run('version', async () => {
  await $fetch(`${api.value}/versions`, {
    method: 'POST',
    body: {
      number: version.number.trim(),
      name: `${title.value.trim()} ${version.number.trim()}`,
      channel: version.channel,
      changelog: version.changelog,
      gameVersions: analysis.value?.gameVersions ?? [],
      loaders: analysis.value?.loaders ?? [],
      meta: analysis.value?.meta ?? {},
      files: upload.value ? [{ ...upload.value, primary: true }] : [],
    },
  })
  step.value = STEPS.indexOf('review')
})

const submit = () => run('submit', async () => {
  await $fetch(`${api.value}/submit`, { method: 'POST', body: { body: note.value } })
  await navigateTo(localePath(created.value!.path))
})

const openProject = () => navigateTo(localePath(created.value!.path))
const finishLater = () => navigateTo(localePath(`${created.value!.path}/settings`))

function next() {
  if (STEPS[step.value] === 'description') return createProject()
  if (STEPS[step.value] === 'file') return addVersion()
  step.value++
}
</script>

<template>
  <UiPageShell width="max-w-3xl">
    <UiPageHeader :title="t('create.project.title')" :description="t('create.wizard.lead')" />

    <ol class="mb-6 flex flex-wrap gap-2">
      <li
        v-for="(id, index) in STEPS"
        :key="id"
        class="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm"
        :class="index === step ? 'border-primary/50 bg-primary/10' : index < step ? 'border-raised-line text-muted' : 'border-raised-line text-dimmed'"
      >
        <span class="font-mono text-xs">{{ index + 1 }}</span>
        {{ t(`create.wizard.steps.${id}`) }}
      </li>
    </ol>

    <div class="rounded-2xl border border-panel-line bg-panel p-6">
      <UAlert
        v-if="problem"
        color="error"
        variant="subtle"
        class="mb-4 rounded-2xl"
        icon="i-pixelarticons-warning-box"
        :description="problem"
      />

      <div v-if="STEPS[step] === 'basics'" class="space-y-4">
        <UFormField :label="t('create.project.type')">
          <USelect v-model="type" :items="typeOptions" value-key="value" class="w-full" />
        </UFormField>
        <UFormField :label="t('create.project.name')">
          <UInput v-model="title" :maxlength="64" :placeholder="t('create.project.namePlaceholder')" autocomplete="off" class="w-full" />
        </UFormField>
        <UiSlugField
          ref="slugField"
          v-model="slug"
          :label="t('create.project.url')"
          :prefix="`usespectra.app/${TYPE_PREFIX[type as ProjectType]}/`"
        />
        <UFormField :label="t('create.project.owner')" :help="t('create.project.ownerHint')">
          <USelect v-model="owner" :items="ownerOptions" value-key="value" class="w-full" />
        </UFormField>
        <UFormField :label="t('create.project.visibility')" :help="t(`create.visibilityHint.${visibility}`)">
          <UiChoiceRow v-model="visibility" :options="visibilityOptions" />
        </UFormField>
      </div>

      <div v-else-if="STEPS[step] === 'license'" class="space-y-4">
        <p class="text-sm text-muted">{{ t('catalog.settingsHint.license') }}</p>
        <UFormField :label="t('catalog.license')">
          <USelect v-model="license" :items="licenseOptions" value-key="value" :placeholder="t('catalog.admin.license')" class="w-full" />
        </UFormField>
        <UFormField v-if="license === 'other'" :label="t('catalog.licenseUrl')">
          <UInput v-model="licenseUrl" class="w-full" placeholder="https://" />
        </UFormField>
        <UFormField v-if="needsSource(license)" :label="t('catalog.sourceCode')" :help="t('catalog.settingsHint.sourceCode')">
          <UInput v-model="source" class="w-full" placeholder="https://github.com/you/project" />
        </UFormField>
        <p v-if="rule && license" class="text-sm text-warning">{{ t(`catalog.licenseProblems.${rule}`) }}</p>
      </div>

      <div v-else-if="STEPS[step] === 'description'" class="space-y-5">
        <div class="flex items-center gap-4">
          <label class="flex size-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/20">
            <img v-if="iconPreview" :src="iconPreview" alt="" class="size-full object-cover">
            <UIcon v-else name="i-pixelarticons-camera" class="size-6 text-dimmed" />
            <input type="file" :accept="acceptAttribute(MOVING_IMAGE_TYPES)" class="hidden" @change="pickIcon">
          </label>
          <div>
            <p class="text-xs text-dimmed">{{ t('catalog.settingsHint.icon') }}</p>
            <UiUploadHint id="projectIcon" class="mt-1" />
          </div>
        </div>

        <UFormField :label="t('create.project.summary')" :help="t('create.project.summaryHint')">
          <UTextarea v-model="summary" :rows="2" :maxlength="256" :placeholder="t('create.project.summaryPlaceholder')" class="w-full" />
        </UFormField>

        <UFormField :label="t('catalog.projectTabs.description')" :help="t('catalog.settingsHint.description')">
          <UiMarkdownEditor v-model="description" :rows="12" :placeholder="t('catalog.descriptionPlaceholder')" />
        </UFormField>

        <UFormField :label="t('catalog.projectTabs.tags')" :help="t('catalog.settingsHint.categories')">
          <div class="grid gap-2 sm:grid-cols-2">
            <label
              v-for="category in available"
              :key="category"
              class="flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm"
              :class="categories.includes(category) ? 'border-primary/50 bg-primary/10' : 'border-raised-line bg-raised'"
            >
              <input type="checkbox" class="size-4 shrink-0 accent-primary" :checked="categories.includes(category)" @change="toggleCategory(category)">
              {{ t(`catalog.categoryNames.${category}`) }}
            </label>
          </div>
        </UFormField>

        <ul class="space-y-1 text-xs">
          <li v-for="item in (['summary', 'description', 'categories'] as const)" :key="item" :class="checks[item] ? 'text-primary' : 'text-dimmed'">
            <UIcon :name="checks[item] ? 'i-pixelarticons-check' : 'i-pixelarticons-close'" class="mr-1 size-3" />
            {{ t(`checklist.items.${item}`) }}
          </li>
        </ul>

        <label class="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <input v-model="authorship" type="checkbox" class="mt-0.5 size-4 shrink-0 accent-primary">
          <span class="text-sm/relaxed text-muted">{{ t('create.project.authorship') }}</span>
        </label>
      </div>

      <div v-else-if="STEPS[step] === 'file'" class="space-y-4">
        <p class="text-sm text-muted">{{ t('create.wizard.fileHint') }}</p>
        <label
          v-if="!upload"
          class="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-white/20 p-8 text-center"
        >
          <UIcon :name="busy === 'upload' ? 'i-pixelarticons-loader' : 'i-pixelarticons-upload'" class="size-8 text-dimmed" />
          <span class="text-sm">{{ busy === 'upload' ? t('catalog.reading') : t('catalog.chooseFile') }}</span>
          <input type="file" class="hidden" @change="pickFile">
        </label>
        <template v-else>
          <div class="flex items-center gap-3 rounded-xl border border-raised-line bg-raised p-3">
            <UIcon name="i-pixelarticons-file" class="size-5 shrink-0 text-dimmed" />
            <span class="min-w-0 flex-1 break-all font-mono text-xs">{{ upload.filename }}</span>
            <UButton size="xs" variant="ghost" color="neutral" icon="i-pixelarticons-close" :aria-label="t('catalog.cancel')" @click="upload = null; analysis = null" />
          </div>
          <ul v-if="analysis?.warnings.length" class="space-y-1">
            <li v-for="warning in analysis.warnings" :key="warning.code" class="text-xs text-warning">{{ t(warning.code, warning.params) }}</li>
          </ul>
          <p class="text-xs text-dimmed">{{ t('catalog.readFromFile') }}</p>
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField :label="t('catalog.versionNumber')">
              <UInput v-model="version.number" class="w-full" />
            </UFormField>
            <UFormField :label="t('catalog.channel')">
              <USelect v-model="version.channel" :items="channelOptions" value-key="value" class="w-full" />
            </UFormField>
          </div>
          <UFormField :label="t('catalog.changelog')">
            <UTextarea v-model="version.changelog" :rows="4" class="w-full" />
          </UFormField>
        </template>
      </div>

      <div v-else class="space-y-4">
        <template v-if="created?.status === 'private'">
          <p class="text-sm text-muted">{{ t('checklist.privateNotice') }}</p>
        </template>
        <template v-else>
          <p class="text-sm text-muted">{{ t('create.wizard.reviewHint') }}</p>
          <UFormField :label="t('create.wizard.note')">
            <UTextarea v-model="note" :rows="3" :maxlength="4000" class="w-full" />
          </UFormField>
        </template>
      </div>

      <div class="mt-6 flex flex-wrap items-center gap-2">
        <UButton
          v-if="step > 0 && !created"
          variant="ghost"
          color="neutral"
          :label="t('create.wizard.back')"
          @click="step--"
        />
        <UButton
          v-if="created"
          variant="ghost"
          color="neutral"
          :label="t('create.wizard.later')"
          @click="finishLater"
        />
        <span class="flex-1"></span>
        <UButton
          v-if="STEPS[step] !== 'review'"
          :disabled="!stepReady"
          :loading="busy === 'create' || busy === 'version'"
          :label="STEPS[step] === 'description' ? t('create.project.submit') : STEPS[step] === 'file' ? t('catalog.addVersion') : t('create.wizard.next')"
          @click="next"
        />
        <UButton
          v-else-if="created?.status === 'private'"
          :label="t('create.wizard.open')"
          @click="openProject"
        />
        <UButton
          v-else
          icon="i-pixelarticons-mail"
          :loading="busy === 'submit'"
          :label="t('checklist.submit')"
          @click="submit"
        />
      </div>
      <p v-if="created && STEPS[step] !== 'review'" class="mt-3 text-xs text-dimmed">{{ t('create.wizard.saved') }}</p>
    </div>
  </UiPageShell>
</template>
