<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const { ask } = useConfirm()
const localePath = useLocalePath()

const id = computed(() => String(route.params.id ?? ''))
const versionId = computed(() => String(route.params.version ?? ''))

const { project, refresh, may } = useProjectEditor(id)

const busy = ref('')
const problem = ref('')
const notice = ref('')

const path = computed(() => `/api/catalog/project/${encodeURIComponent(project.value?.slug ?? '')}`)

const version = computed(() =>
  project.value?.versions.find(entry => entry.id === versionId.value) ?? null)

const draft = reactive({
  number: '',
  name: '',
  channel: 'release',
  changelog: '',
  gameVersions: [] as string[],
  loaders: [] as string[],
})

// The form is filled from the project fetch rather than from a request of its
// own: the editor already has every version, and a second fetch would only be a
// second thing to keep in step.
watchEffect(() => {
  const current = version.value
  if (!current) return

  draft.number = current.number
  draft.name = current.name === current.number ? '' : current.name
  draft.channel = current.channel
  draft.changelog = current.changelog ?? ''
  draft.gameVersions = [...current.gameVersions]
  draft.loaders = [...current.loaders]
})

const gameVersions = ref<PickableVersion[]>([])
const versionsFailed = ref(false)

onMounted(async () => {
  try {
    const res = await $fetch<{ versions: PickableVersion[] }>('/api/catalog/game-versions')
    gameVersions.value = res.versions
    versionsFailed.value = !res.versions.length
  }
  catch { versionsFailed.value = true }
})

const manual = ref('')
watchEffect(() => { manual.value = draft.gameVersions.join(', ') })

const channelOptions = computed(() =>
  VERSION_CHANNELS.map(value => ({ value, label: t(`catalog.channels.${value}`) })))

// Only the loaders that make sense for this kind of project — offering Iris on
// a plugin is offering a wrong answer.
const loaderOptions = computed(() =>
  loadersForType(project.value?.type as ProjectType).map(value => ({ value, label: value })))

const when = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms))

const size = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function save() {
  busy.value = 'save'
  problem.value = ''
  notice.value = ''

  try {
    await $fetch(`${path.value}/versions/${encodeURIComponent(versionId.value)}`, {
      method: 'PATCH',
      body: {
        number: draft.number,
        name: draft.name,
        channel: draft.channel,
        changelog: draft.changelog,
        gameVersions: versionsFailed.value
          ? manual.value.split(',').map(part => part.trim()).filter(Boolean)
          : draft.gameVersions,
        loaders: draft.loaders,
      },
    })
    await refresh()
    notice.value = t('catalog.version.saved')
  }
  catch (e: any) { problem.value = e?.data?.statusMessage || t('auth.genericError') }
  finally { busy.value = '' }
}

async function remove() {
  const current = version.value
  if (!current) return

  const ok = await ask({
    title: t('catalog.version.remove'),
    body: current.number,
    confirmLabel: t('catalog.version.remove'),
    danger: true,
  })
  if (!ok) return

  busy.value = 'delete'
  problem.value = ''

  try {
    await $fetch(`${path.value}/versions/${encodeURIComponent(versionId.value)}`, { method: 'DELETE' })
    await refresh()
    await router.push(localePath(`/project/${id.value}/settings/versions`))
  }
  catch (e: any) { problem.value = e?.data?.statusMessage || t('auth.genericError') }
  finally { busy.value = '' }
}

useSeoMeta({ title: () => t('catalog.version.editTitle'), robots: 'noindex' })
</script>

<template>
  <div class="space-y-5">
    <NuxtLink
      :to="localePath(`/project/${id}/settings/versions`)"
      class="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-highlighted"
    >
      <UIcon name="i-pixelarticons-chevron-left" class="size-4" />
      {{ t('catalog.version.back') }}
    </NuxtLink>

    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      class="rounded-2xl"
      icon="i-pixelarticons-warning-box"
      :description="problem"
    />
    <UAlert
      v-if="notice"
      color="success"
      variant="subtle"
      class="rounded-2xl"
      icon="i-pixelarticons-check"
      :description="notice"
    />

    <UiPanel v-if="!version" class="p-12 text-center">
      <UIcon name="i-pixelarticons-package" class="mx-auto size-10 text-dimmed" />
      <p class="mt-3 text-sm text-muted">{{ t('catalog.notFound') }}</p>
    </UiPanel>

    <template v-else>
      <UiPanel class="p-5 sm:p-6">
        <h2 class="text-lg font-bold text-highlighted">{{ t('catalog.version.editTitle') }}</h2>
        <p class="mt-1 text-sm text-muted">{{ t('catalog.version.editHint') }}</p>

        <div class="mt-5 grid gap-3 sm:grid-cols-2">
          <UFormField :label="t('catalog.versionNumber')">
            <UInput v-model="draft.number" class="w-full" placeholder="1.0.0" />
          </UFormField>
          <UFormField :label="t('catalog.versionName')">
            <UInput v-model="draft.name" class="w-full" :placeholder="draft.number" />
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

          <div class="sm:col-span-2">
            <UFormField :label="t('catalog.gameVersions')">
              <ProjectGameVersionPicker v-model="draft.gameVersions" :versions="gameVersions" />
            </UFormField>

            <!-- The manifest comes from Mojang, so it can be unreachable. Typing
                 them in is worse than picking, and better than not publishing. -->
            <UFormField
              v-if="versionsFailed"
              class="mt-2"
              :label="t('catalog.gameVersionsManual')"
              :help="t('catalog.gameVersionsManualHint')"
            >
              <UInput v-model="manual" class="w-full" placeholder="1.21.1, 1.21.4" />
            </UFormField>
          </div>
        </div>

        <UFormField :label="t('catalog.changelog')" class="mt-3">
          <UiMarkdownEditor v-model="draft.changelog" :rows="10" />
        </UFormField>

        <div class="mt-5 flex flex-wrap gap-2">
          <UButton
            icon="i-pixelarticons-check"
            :disabled="!draft.number.trim()"
            :loading="busy === 'save'"
            :label="t('catalog.version.save')"
            @click="save"
          />
          <UButton
            variant="subtle"
            color="neutral"
            icon="i-pixelarticons-external-link"
            :label="t('catalog.version.openNewTab')"
            :to="localePath(`${project!.path}/version/${version.id}`)"
            target="_blank"
          />
        </div>
      </UiPanel>

      <UiPanel class="overflow-hidden">
        <div class="px-5 pb-3 pt-4">
          <h3 class="text-base font-bold text-highlighted">{{ t('catalog.version.files') }}</h3>
          <p class="mt-1 text-xs text-dimmed">{{ t('catalog.version.filesReadOnly') }}</p>
        </div>

        <div
          v-for="file in version.files"
          :key="file.id"
          class="flex flex-wrap items-center gap-3 border-t border-raised-line px-5 py-3"
        >
          <UIcon name="i-pixelarticons-file" class="size-4 shrink-0 text-dimmed" />
          <span class="min-w-0 flex-1 break-all font-mono text-xs text-default">{{ file.filename }}</span>
          <UBadge v-if="file.primary" size="sm" variant="subtle" :label="t('catalog.primary')" />
          <span class="font-mono text-xs text-dimmed">{{ size(file.size) }}</span>
        </div>

        <p class="border-t border-raised-line px-5 py-3 text-xs text-dimmed">
          {{ t('catalog.version.published') }} {{ when(version.created) }}
        </p>
      </UiPanel>

      <UiPanel v-if="may('delete_version')" class="border-error/40 p-5 sm:p-6">
        <h3 class="text-base font-bold text-error">{{ t('catalog.version.remove') }}</h3>
        <p class="mt-1 max-w-prose text-sm text-muted">{{ t('catalog.version.removeHint') }}</p>
        <UButton
          class="mt-4"
          color="error"
          variant="subtle"
          icon="i-pixelarticons-trash"
          :loading="busy === 'delete'"
          :label="t('catalog.version.remove')"
          @click="remove"
        />
      </UiPanel>
    </template>
  </div>
</template>
