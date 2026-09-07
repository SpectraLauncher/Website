<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const creating = useCreateFlows()

const open = creating.project

const title = ref('')
const slug = ref('')
const slugField = useTemplateRef('slugField')
const type = ref<string>('mod')
const owner = ref('me')
const visibility = ref<string>('public')
const summary = ref('')
const authorship = ref(false)
const busy = ref(false)
const error = ref('')

const organizations = ref<Array<{ id: string, name: string, logo?: string | null }>>([])

const typeOptions = computed(() =>
  PROJECT_TYPES.map(value => ({ value, label: t(`catalog.admin.types.${value}`) })))

const session = useAuthSession()
const account = computed(() =>
  session.value.data?.user as { name?: string, username?: string, image?: string } | undefined)

const ownerOptions = computed(() => [
  {
    value: 'me',
    label: account.value?.username || account.value?.name || t('create.project.ownerSelf'),
    avatar: account.value?.image ? { src: account.value.image } : undefined,
    icon: account.value?.image ? undefined : 'i-pixelarticons-user',
  },
  ...organizations.value.map(org => ({
    value: org.id,
    label: org.name,
    avatar: org.logo ? { src: org.logo } : undefined,
    icon: org.logo ? undefined : 'i-pixelarticons-users',
  })),
])

const visibilityOptions = computed(() =>
  VISIBILITIES.map(value => ({ value, label: t(`create.visibility.${value}`) })))

// The address follows the name until somebody edits it, and then it stops —
// changing a slug somebody has already typed is the one thing this must not do.
watch(title, value => slugField.value?.follow(value))

const ready = computed(() =>
  Boolean(title.value.trim()) && Boolean(slug.value) && !slugProblem(slug.value)
  && summary.value.trim().length >= 3 && authorship.value)

watch(open, async (value) => {
  if (!value) return

  error.value = ''
  try {
    const res = await $fetch<{ organizations: typeof organizations.value }>('/api/org/mine')
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

        <SlugField
          ref="slugField"
          v-model="slug"
          :label="t('create.project.url')"
          :prefix="`usespectra.app/${TYPE_PREFIX[type as keyof typeof TYPE_PREFIX]}/`"
        />

        <UFormField :label="t('create.project.owner')" :help="t('create.project.ownerHint')">
          <USelect v-model="owner" :items="ownerOptions" value-key="value" class="w-full" />
        </UFormField>

        <UFormField :label="t('create.project.visibility')" :help="t(`create.visibilityHint.${visibility}`)">
          <ChoiceRow v-model="visibility" :options="visibilityOptions" />
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
