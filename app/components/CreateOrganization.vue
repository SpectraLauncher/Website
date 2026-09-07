<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const auth = useAuthClient()
const creating = useCreateFlows()

const open = creating.organization

const name = ref('')
const slug = ref('')
const slugTouched = ref(false)
const busy = ref(false)
const error = ref('')

watch(name, (value) => {
  if (!slugTouched.value) slug.value = normalizeSlug(value)
})

const problem = computed(() => (slug.value ? slugProblem(slug.value) : null))
const ready = computed(() => Boolean(name.value.trim()) && Boolean(slug.value) && !problem.value)

async function create() {
  busy.value = true
  error.value = ''
  try {
    // better-auth owns the organization tables, so creation goes through its
    // client rather than a route of ours — the membership row has to be written
    // by the same code that reads it.
    const res = await auth.organization.create({ name: name.value.trim(), slug: slug.value })
    if (res.error) throw new Error(res.error.message || 'failed')

    open.value = false
    name.value = ''
    slug.value = ''
    slugTouched.value = false

    await navigateTo(localePath(`/org/${res.data!.slug}`))
  }
  catch (e: any) {
    error.value = e?.message || t('auth.genericError')
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('create.organization.title')">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">{{ t('create.organization.hint') }}</p>

        <UFormField :label="t('create.organization.name')">
          <UInput
            v-model="name"
            :maxlength="64"
            :placeholder="t('create.organization.namePlaceholder')"
            autocomplete="off"
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="t('create.organization.url')"
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
              usespectra.app/org/{{ slug || '…' }}
            </span>
          </template>
        </UFormField>

        <UAlert v-if="error" color="error" variant="subtle" :description="error" />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" :label="t('catalog.cancel')" @click="open = false" />
        <UButton
          color="primary"
          icon="i-pixelarticons-plus"
          :disabled="!ready"
          :loading="busy"
          :label="t('create.organization.submit')"
          @click="create"
        />
      </div>
    </template>
  </UModal>
</template>
