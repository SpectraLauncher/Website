<script setup lang="ts">
const { t } = useI18n()
const { pending, answer } = useConfirm()

// The modal owns the open state, so closing it any other way — the escape key,
// the backdrop — has to answer no rather than leave the caller waiting.
const open = computed({
  get: () => pending.value !== null,
  set: (value: boolean) => { if (!value) answer(false) },
})
</script>

<template>
  <UModal v-model:open="open" :title="pending?.title ?? ''">
    <template #body>
      <p v-if="pending?.body" class="text-sm/relaxed text-muted">{{ pending.body }}</p>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          variant="ghost"
          color="neutral"
          :label="t('catalog.cancel')"
          @click="answer(false)"
        />
        <UButton
          :color="pending?.danger ? 'error' : 'primary'"
          class="rounded-xl"
          :label="pending?.confirmLabel || t('confirm.yes')"
          @click="answer(true)"
        />
      </div>
    </template>
  </UModal>
</template>
