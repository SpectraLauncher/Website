<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const creating = useCreateFlows()

const open = creating.collection

const title = ref('')
const summary = ref('')
const busy = ref(false)
const error = ref('')

async function create() {
  busy.value = true
  error.value = ''
  try {
    const res = await $fetch<{ collection: { id: string } }>('/api/catalog/collections', {
      method: 'POST',
      body: { title: title.value.trim(), summary: summary.value.trim() },
    })

    open.value = false
    title.value = ''
    summary.value = ''

    await navigateTo(localePath(`/collection/${res.collection.id}`))
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
  <UModal v-model:open="open" :title="t('create.collection.title')">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">{{ t('create.collection.hint') }}</p>

        <UFormField :label="t('create.collection.name')">
          <UInput
            v-model="title"
            :maxlength="80"
            :placeholder="t('create.collection.namePlaceholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('create.collection.summary')">
          <UTextarea
            v-model="summary"
            :rows="3"
            :maxlength="300"
            :placeholder="t('create.collection.summaryPlaceholder')"
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
          :disabled="!title.trim()"
          :loading="busy"
          :label="t('create.collection.submit')"
          @click="create"
        />
      </div>
    </template>
  </UModal>
</template>
