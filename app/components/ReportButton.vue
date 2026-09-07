<script setup lang="ts">
const props = defineProps<{
  itemType: ReportItemType
  itemId: string
  label?: string
  size?: 'xs' | 'sm' | 'md'
}>()

const { t } = useI18n()
const session = useAuthSession()
const signedIn = computed(() => Boolean(session.value.data))

const open = ref(false)
const reason = ref<ReportReason>('spam')
const body = ref('')
const busy = ref(false)
const error = ref('')
const sent = ref(false)

const reasons = computed(() =>
  REPORT_REASONS.map(value => ({ value, label: t(`reports.reasons.${value}`) })))

async function send() {
  if (!body.value.trim()) return

  busy.value = true
  error.value = ''
  try {
    await $fetch('/api/catalog/reports', {
      method: 'POST',
      body: {
        reason: reason.value,
        itemType: props.itemType,
        itemId: props.itemId,
        body: body.value,
      },
    })
    sent.value = true
    body.value = ''
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally {
    busy.value = false
  }
}

// Reopening after a send should start clean rather than show the thank-you.
watch(open, (value) => {
  if (value) {
    sent.value = false
    error.value = ''
  }
})
</script>

<template>
  <UModal v-if="signedIn" v-model:open="open" :title="t('reports.title')">
    <UButton
      :size="props.size ?? 'xs'"
      variant="ghost"
      color="neutral"
      icon="i-pixelarticons-flag"
      :label="props.label"
      :aria-label="t('reports.title')"
    />

    <template #body>
      <div v-if="sent" class="space-y-3 text-center">
        <UIcon name="i-pixelarticons-checkbox-on" class="size-8 text-primary" />
        <p class="text-sm">{{ t('reports.thanks') }}</p>
      </div>

      <div v-else class="space-y-4">
        <p class="text-sm text-muted">{{ t('reports.intro') }}</p>

        <UFormField :label="t('reports.reason')">
          <USelect v-model="reason" :items="reasons" value-key="value" class="w-full" />
        </UFormField>

        <UFormField :label="t('reports.details')">
          <UTextarea
            v-model="body"
            :rows="4"
            :maxlength="2000"
            :placeholder="t('reports.detailsHint')"
            class="w-full"
          />
        </UFormField>

        <UAlert v-if="error" color="error" variant="subtle" :description="error" />
      </div>
    </template>

    <template v-if="!sent" #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          variant="ghost"
          color="neutral"
          :label="t('catalog.cancel')"
          @click="open = false"
        />
        <UButton
          color="error"
          :disabled="!body.trim()"
          :loading="busy"
          :label="t('reports.send')"
          @click="send"
        />
      </div>
    </template>
  </UModal>
</template>
