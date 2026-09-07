<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const creating = useCreateFlows()

const open = creating.project

const title = ref('')
const slug = ref('')
const slugTouched = ref(false)
const type = ref<string>('mod')
const owner = ref('me')
const visibility = ref<string>('public')
const summary = ref('')
const authorship = ref(false)
const busy = ref(false)
const error = ref('')

const organizations = ref<Array<{ id: string, name: string }>>([])

const typeOptions = computed(() =>
  PROJECT_TYPES.map(value => ({ value, label: t(`catalog.admin.types.${value}`) })))

const ownerOptions = computed(() => [
  { value: 'me', label: t('create.project.ownerSelf') },
  ...organizations.value.map(org => ({ value: org.id, label: org.name })),
])

const visibilityOptions = computed(() =>
  VISIBILITIES.map(value => ({ value, label: t(`create.visibility.${value}`) })))

// The address follows the name until somebody edits it, and then it stops —
// changing a slug somebody has already typed is the one thing this must not do.
watch(title, (value) => {
  if (!slugTouched.value) slug.value = normalizeSlug(value)
})

const problem = computed(() => (slug.value ? slugProblem(slug.value) : null))

const ready = computed(() =>
  Boolean(title.value.trim()) && Boolean(slug.value) && !problem.value
  && summary.value.trim().length >= 3 && authorship.value)

watch(open, async (value) => {
  if (!value) return

  error.value = ''
  try {
    const res = await $fetch<{ organizations: Array<{ id: string, name: string }> }>('/api/org/mine')
    organizations.value = res.organizations
  }
  catch { organizations.value = [] }
})

async function create() {
  busy.value = true
  error.value = ''
  try {
    const res = await $fetch<{ project: { slug: string, path: string } }>('/api/catalog/projects', {
      method: 'POST',
      body: {
        title: title.value.trim(),
        slug: slug.value,
        type: type.value,
        summary: summary.value.trim(),
        orgId: owner.value === 'me' ? undefined : owner.value,
        visibility: visibility.value,
        authorship: true,
      },
    })

    open.value = false
    title.value = ''
    slug.value = ''
    summary.value = ''
    slugTouched.value = false
    authorship.value = false

    await navigateTo(localePath(res.project.path))
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('create.project.title')">
    <template #body>
      <div class="space-y-4">
        <UFormField :label="t('create.project.type')">
          <USelect v-model="type" :items="typeOptions" value-key="value" class="w-full" />
        </UFormField>

        <UFormField :label="t('create.project.name')">
          <UInput
            v-model="title"
            :maxlength="64"
            :placeholder="t('create.project.namePlaceholder')"
            autocomplete="off"
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="t('create.project.url')"
          :error="problem ? t(`catalog.slugProblem.${problem}`) : undefined"
        >
          <UInput
            v-model="slug"
            :maxlength="64"
            autocomplete="off"
            class="w-full"
            @update:model-value="slugTouched = true"
          />
          <template #help>
            <span class="break-all font-mono text-xs text-dimmed">
              usespectra.app/{{ TYPE_PREFIX[type as keyof typeof TYPE_PREFIX] }}/{{ slug || '…' }}
            </span>
          </template>
        </UFormField>

        <UFormField :label="t('create.project.owner')" :help="t('create.project.ownerHint')">
          <USelect v-model="owner" :items="ownerOptions" value-key="value" class="w-full" />
        </UFormField>

        <UFormField :label="t('create.project.visibility')" :help="t(`create.visibilityHint.${visibility}`)">
          <USelect
            v-model="visibility"
            :items="visibilityOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('create.project.summary')" :help="t('create.project.summaryHint')">
          <UTextarea
            v-model="summary"
            :rows="3"
            :maxlength="256"
            :placeholder="t('create.project.summaryPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <label class="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <input v-model="authorship" type="checkbox" class="mt-0.5 size-4 shrink-0 accent-primary">
          <span class="text-sm/relaxed text-muted">{{ t('create.project.authorship') }}</span>
        </label>

        <UAlert v-if="error" color="error" variant="subtle" :description="error" />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          variant="ghost"
          color="neutral"
          :label="t('catalog.cancel')"
          @click="open = false"
        />
        <UButton
          color="primary"
          icon="i-pixelarticons-plus"
          :disabled="!ready"
          :loading="busy"
          :label="t('create.project.submit')"
          @click="create"
        />
      </div>
    </template>
  </UModal>
</template>
