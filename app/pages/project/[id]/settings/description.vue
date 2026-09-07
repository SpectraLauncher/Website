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

const description = ref('')

watchEffect(() => {
  if (project.value) description.value = project.value.description
})

const preview = ref(false)
</script>

<template>
  <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
    <h2 class="mb-1 text-lg font-semibold">{{ t('catalog.projectTabs.description') }}</h2>
    <p class="mb-5 text-sm text-muted">{{ t('catalog.settingsHint.description') }}</p>

    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      class="mb-4 rounded-2xl"
      icon="i-pixelarticons-warning-box"
      :description="problem"
    />

    <div class="mb-3 flex gap-2">
      <UButton
        size="xs"
        :variant="preview ? 'ghost' : 'subtle'"
        color="neutral"
        class="rounded-xl"
        :label="t('catalog.write')"
        @click="preview = false"
      />
      <UButton
        size="xs"
        :variant="preview ? 'subtle' : 'ghost'"
        color="neutral"
        class="rounded-xl"
        :label="t('catalog.preview')"
        @click="preview = true"
      />
    </div>

    <!-- eslint-disable-next-line vue/no-v-html -- markdown-it runs with html:false -->
    <div
      v-if="preview"
      class="prose prose-invert min-h-64 max-w-none rounded-2xl border border-white/10 p-4"
      v-html="renderMarkdown(description)"
    />
    <UTextarea
      v-else
      v-model="description"
      :rows="24"
      :maxlength="100000"
      :placeholder="t('catalog.descriptionPlaceholder')"
      class="w-full font-mono text-sm"
    />

    <div class="mt-5 flex items-center gap-3">
      <UButton
        class="rounded-xl"
        :label="t('account.save')"
        :loading="busy"
        @click="save({ description })"
      />
      <span v-if="saved" class="text-sm text-primary">{{ t('account.saved') }}</span>
    </div>
  </div>
</template>
