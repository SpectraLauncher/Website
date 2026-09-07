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

const categories = ref<string[]>([])
const environment = ref<string[]>([])

watchEffect(() => {
  if (!project.value) return
  categories.value = [...project.value.categories]
  environment.value = [...(project.value.environment ?? [])]
})

const categoryOptions = computed(() =>
  (CATEGORIES[project.value?.type as keyof typeof CATEGORIES] ?? [])
    .map(value => ({ value, label: t(`catalog.categoryNames.${value}`) })))

const environmentOptions = computed(() =>
  ENVIRONMENTS.map(value => ({ value, label: t(`catalog.environments.${value}`) })))
</script>

<template>
  <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
    <h2 class="mb-1 text-lg font-semibold">{{ t('catalog.projectTabs.tags') }}</h2>
    <p class="mb-5 text-sm text-muted">{{ t('catalog.settingsHint.tags') }}</p>

    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      class="mb-4 rounded-2xl"
      icon="i-pixelarticons-warning-box"
      :description="problem"
    />

    <UFormField :label="t('catalog.categories')" :help="t('catalog.settingsHint.categories')">
      <UCheckboxGroup
        v-model="categories"
        :items="categoryOptions"
        value-key="value"
        size="sm"
        class="mt-2"
      />
    </UFormField>

    <UFormField :label="t('catalog.environment')" class="mt-5">
      <UCheckboxGroup
        v-model="environment"
        :items="environmentOptions"
        value-key="value"
        size="sm"
        class="mt-2"
      />
    </UFormField>

    <div class="mt-5 flex items-center gap-3">
      <UButton
        class="rounded-xl"
        :label="t('account.save')"
        :loading="busy"
        @click="save({ categories, environment })"
      />
      <span v-if="saved" class="text-sm text-primary">{{ t('account.saved') }}</span>
    </div>
  </div>
</template>
