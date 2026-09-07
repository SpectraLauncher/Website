<script setup lang="ts">
const route = useRoute()
const { t, locale } = useI18n()
const { ask } = useConfirm()

const id = computed(() => String(route.params.id ?? ''))
const { project, refresh } = useProjectEditor(id)

const busy = ref('')
const problem = ref('')
const creating = ref(false)

const draft = reactive({
  number: '',
  name: '',
  channel: 'release',
  changelog: '',
  gameVersions: '' as string,
  loaders: '' as string,
})

const path = computed(() => `/api/catalog/project/${encodeURIComponent(project.value?.slug ?? '')}`)

const channelOptions = computed(() =>
  VERSION_CHANNELS.map(value => ({ value, label: t(`catalog.channels.${value}`) })))

const when = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms))

// A comma or a space between them; people paste both and neither is wrong.
const list = (value: string) =>
  value.split(/[\s,]+/).map(part => part.trim()).filter(Boolean)

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
        gameVersions: list(draft.gameVersions),
        loaders: list(draft.loaders),
      },
    })
    draft.number = ''
    draft.name = ''
    draft.changelog = ''
    creating.value = false
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
</script>

<template>
  <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
    <h2 class="mb-1 text-lg font-semibold">{{ t('catalog.projectTabs.versions') }}</h2>
    <p class="mb-5 text-sm text-muted">{{ t('catalog.settingsHint.versions') }}</p>

    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      class="mb-4 rounded-2xl"
      icon="i-pixelarticons-warning-box"
      :description="problem"
    />

    <UButton
      class="rounded-xl"
      icon="i-pixelarticons-plus"
      :label="t('catalog.addVersion')"
      @click="creating = !creating"
    />

    <div v-if="creating" class="mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField :label="t('catalog.versionNumber')">
          <UInput v-model="draft.number" class="w-full" placeholder="1.0.0" />
        </UFormField>
        <UFormField :label="t('catalog.versionName')">
          <UInput v-model="draft.name" class="w-full" />
        </UFormField>
        <UFormField :label="t('catalog.channel')">
          <USelect v-model="draft.channel" :items="channelOptions" value-key="value" class="w-full" />
        </UFormField>
        <UFormField :label="t('catalog.gameVersions')">
          <UInput v-model="draft.gameVersions" class="w-full" placeholder="1.20.1, 1.21" />
        </UFormField>
        <UFormField :label="t('catalog.loaders')" class="sm:col-span-2">
          <UInput v-model="draft.loaders" class="w-full" placeholder="fabric, neoforge" />
        </UFormField>
      </div>

      <UFormField :label="t('catalog.changelog')">
        <UTextarea v-model="draft.changelog" :rows="6" class="w-full font-mono text-sm" />
      </UFormField>

      <div class="flex gap-2">
        <UButton
          class="rounded-xl"
          :disabled="!draft.number.trim()"
          :loading="busy === 'create'"
          :label="t('catalog.addVersion')"
          @click="create"
        />
        <UButton
          variant="ghost"
          color="neutral"
          class="rounded-xl"
          :label="t('catalog.cancel')"
          @click="creating = false"
        />
      </div>
    </div>

    <ul v-if="project?.versions.length" class="mt-5 space-y-2">
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
            · {{ when(version.created) }}
            · {{ t('catalog.fileCount', { n: version.files.length }) }}
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

    <p v-else class="mt-5 text-sm text-dimmed">{{ t('catalog.noVersions') }}</p>

    <p class="mt-5 text-xs/relaxed text-dimmed">{{ t('catalog.settingsHint.uploadElsewhere') }}</p>
  </div>
</template>
