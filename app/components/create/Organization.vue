<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const auth = useAuthClient()
const creating = useCreateFlows()

const open = creating.organization

const name = ref('')
const slug = ref('')
const slugField = useTemplateRef('slugField')
const summary = ref('')
const busy = ref(false)
const error = ref('')

watch(name, value => slugField.value?.follow(value))

const ready = computed(() =>
  Boolean(name.value.trim()) && Boolean(slug.value) && !slugProblem(slug.value))

async function create() {
  busy.value = true
  error.value = ''
  try {
    // better-auth owns the organization tables, so creation goes through its
    // client rather than a route of ours — the membership row has to be written
    // by the same code that reads it.
    const res = await auth.organization.create({ name: name.value.trim(), slug: slug.value })
    if (res.error) throw new Error(res.error.message || 'failed')

    const created = res.data!

    // The description is ours rather than better-auth's, so it goes in a second
    // step. Failing here must not lose the organization that already exists.
    if (summary.value.trim()) {
      try {
        await $fetch(`/api/org/${encodeURIComponent(created.slug)}`, {
          method: 'PATCH',
          body: { summary: summary.value.trim() },
        })
      }
      catch { /* the description can be written again from the settings */ }
    }

    open.value = false
    name.value = ''
    slug.value = ''
    summary.value = ''

    await navigateTo(localePath(`/org/${created.slug}`))
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

        <UiSlugField
          ref="slugField"
          v-model="slug"
          :label="t('create.organization.url')"
          prefix="usespectra.app/org/"
        />

        <UFormField
          :label="t('create.organization.description')"
          :help="t('create.organization.descriptionHint')"
        >
          <UTextarea
            v-model="summary"
            :rows="3"
            :maxlength="300"
            :placeholder="t('create.organization.descriptionPlaceholder')"
            class="w-full"
          />
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
