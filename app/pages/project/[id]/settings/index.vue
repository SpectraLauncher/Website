<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()

const id = computed(() => String(route.params.id ?? ''))
const { data, project, refresh } = useProjectEditor(id)

const busy = ref(false)
const saved = ref(false)
const problem = ref('')

async function save(body: Record<string, unknown>) {
  busy.value = true
  problem.value = ''
  try {
    await $fetch(`/api/catalog/project/${encodeURIComponent(project.value!.slug)}`, {
      method: 'PATCH',
      body,
    })
    await refresh()
    saved.value = true
    setTimeout(() => (saved.value = false), 4000)
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally { busy.value = false }
}

const form = reactive({ title: '', summary: '', slug: '', visibility: 'public' })

watchEffect(() => {
  if (!project.value) return
  form.title = project.value.title
  form.summary = project.value.summary
  form.slug = project.value.slug
  form.visibility = visibilityOf(project.value.status, project.value.requestedStatus ?? 'published')
})

const visibilityOptions = computed(() =>
  VISIBILITIES.map(value => ({ value, label: t(`create.visibility.${value}`) })))
</script>

<template>
  <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
    <h2 class="mb-1 text-lg font-semibold">{{ t('catalog.projectTabs.general') }}</h2>
    <p class="mb-5 text-sm text-muted">{{ t('catalog.settingsHint.general') }}</p>

    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      class="mb-4 rounded-2xl"
      icon="i-pixelarticons-warning-box"
      :description="problem"
    />

    <div class="space-y-4">
      <UFormField :label="t('create.project.name')">
        <UInput v-model="form.title" :maxlength="64" class="w-full" />
      </UFormField>

      <UFormField :label="t('create.project.summary')" :help="t('create.project.summaryHint')">
        <UTextarea v-model="form.summary" :rows="3" :maxlength="256" class="w-full" />
      </UFormField>

      <SlugField
        v-model="form.slug"
        :label="t('create.project.url')"
        :prefix="`usespectra.app/${project?.path.split('/')[1] ?? ''}/`"
      />

      <UFormField
        :label="t('create.project.visibility')"
        :help="t(`create.visibilityHint.${form.visibility}`)"
      >
        <ChoiceRow v-model="form.visibility" :options="visibilityOptions" />
      </UFormField>
    </div>

    <div class="mt-5 flex items-center gap-3">
      <UButton
        class="rounded-xl"
        :label="t('account.save')"
        :loading="busy"
        @click="save({ ...form })"
      />
      <span v-if="saved" class="text-sm text-primary">{{ t('account.saved') }}</span>
    </div>
  </div>
</template>
