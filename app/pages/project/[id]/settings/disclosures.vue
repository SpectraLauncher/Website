<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()

const id = computed(() => String(route.params.id ?? ''))
const { project, refresh } = useProjectEditor(id)

const busy = ref(false)
const saved = ref(false)
const problem = ref('')

const draft = reactive<Record<string, { on: boolean, options: string[], note: string }>>({})

watchEffect(() => {
  if (!project.value) return
  for (const key of DISCLOSURE_KEYS) {
    const entry = project.value.disclosures?.[key]
    draft[key] = {
      on: Boolean(entry),
      options: [...(entry?.options ?? [])],
      note: entry?.note ?? '',
    }
  }
})

// A moderator who has established that something is true can pin it, and after
// that the form shows the state without offering to change it.
const lockOf = (key: DisclosureKey) => project.value?.disclosures?.[key]?.lock ?? 'open'
const editable = (key: DisclosureKey) => canAuthorEdit(lockOf(key))
const removable = (key: DisclosureKey) => canAuthorRemove(lockOf(key))

const optionsFor = (key: DisclosureKey) =>
  (DISCLOSURES[key].options as readonly string[])
    .map(value => ({ value, label: t(`disclosures.options.${key}.${value}`) }))

async function save() {
  busy.value = true
  problem.value = ''
  try {
    const payload: Record<string, unknown> = {}
    for (const key of DISCLOSURE_KEYS) {
      if (!draft[key]?.on) continue
      payload[key] = { options: draft[key]!.options, note: draft[key]!.note }
    }

    await $fetch(`/api/catalog/project/${encodeURIComponent(project.value!.slug)}/disclosures`, {
      method: 'PATCH',
      body: { disclosures: payload },
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
</script>

<template>
  <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
    <h2 class="mb-1 text-lg font-semibold">{{ t('catalog.projectTabs.disclosures') }}</h2>
    <p class="mb-5 text-sm text-muted">{{ t('catalog.settingsHint.disclosures') }}</p>

    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      class="mb-4 rounded-2xl"
      icon="i-pixelarticons-warning-box"
      :description="problem"
    />

    <ul class="space-y-4">
      <li
        v-for="key in DISCLOSURE_KEYS"
        :key="key"
        class="rounded-2xl border border-white/10 bg-white/5 p-4"
      >
        <label class="flex cursor-pointer items-start gap-3">
          <input
            v-model="draft[key]!.on"
            type="checkbox"
            class="mt-0.5 size-4 shrink-0 accent-primary"
            :disabled="!editable(key) || (draft[key]!.on && !removable(key))"
          >
          <span class="min-w-0 flex-1">
            <span class="flex flex-wrap items-center gap-2">
              <UIcon :name="DISCLOSURES[key].icon" class="size-4 shrink-0 text-dimmed" />
              <span class="text-sm font-medium">{{ t(`disclosures.${key}`) }}</span>
              <UBadge
                v-if="lockOf(key) !== 'open'"
                size="sm"
                variant="subtle"
                color="warning"
                :label="t(`catalog.disclosureLock.${lockOf(key)}`)"
              />
            </span>
            <span class="mt-1 block text-xs/relaxed text-dimmed">
              {{ t(`disclosures.hints.${key}`) }}
            </span>
          </span>
        </label>

        <div v-if="draft[key]!.on" class="mt-3 space-y-3 pl-7">
          <UCheckboxGroup
            v-if="DISCLOSURES[key].options.length"
            v-model="draft[key]!.options"
            :items="optionsFor(key)"
            value-key="value"
            size="sm"
            :disabled="!editable(key)"
          />
          <UInput
            v-model="draft[key]!.note"
            size="sm"
            class="w-full"
            :maxlength="MAX_NOTE"
            :disabled="!editable(key)"
            :placeholder="t('catalog.disclosureNote')"
          />
        </div>
      </li>
    </ul>

    <div class="mt-5 flex items-center gap-3">
      <UButton class="rounded-xl" :label="t('account.save')" :loading="busy" @click="save" />
      <span v-if="saved" class="text-sm text-primary">{{ t('account.saved') }}</span>
    </div>
  </div>
</template>
