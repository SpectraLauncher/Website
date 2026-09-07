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

const links = reactive<Record<string, string>>({})

watchEffect(() => {
  if (!project.value) return
  for (const kind of LINK_KINDS) links[kind] = project.value.links?.[kind] ?? ''
})
</script>

<template>
  <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
    <h2 class="mb-1 text-lg font-semibold">{{ t('catalog.projectTabs.links') }}</h2>
    <p class="mb-5 text-sm text-muted">{{ t('catalog.settingsHint.links') }}</p>

    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      class="mb-4 rounded-2xl"
      icon="i-pixelarticons-warning-box"
      :description="problem"
    />

    <div class="space-y-4">
      <UFormField v-for="kind in LINK_KINDS" :key="kind" :label="t(`links.${kind}`)">
        <UInput v-model="links[kind]" class="w-full" placeholder="https://" />
      </UFormField>
    </div>

    <div class="mt-5 flex items-center gap-3">
      <UButton
        class="rounded-xl"
        :label="t('account.save')"
        :loading="busy"
        @click="save({ links: { ...links } })"
      />
      <span v-if="saved" class="text-sm text-primary">{{ t('account.saved') }}</span>
    </div>
  </div>
</template>
