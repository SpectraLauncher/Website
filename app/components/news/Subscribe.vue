<script setup lang="ts">
const { t } = useI18n()

const email = ref('')
const busy = ref(false)
const done = ref(false)
const error = ref('')

async function submit() {
  busy.value = true
  error.value = ''

  try {
    await $fetch('/api/news/subscribe', { method: 'POST', body: { email: email.value } })
    done.value = true
    email.value = ''
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally { busy.value = false }
}
</script>

<template>
  <UiPanel class="p-5 sm:p-6">
    <h2 class="text-lg font-bold text-highlighted">{{ t('news.subscribeTitle') }}</h2>
    <p class="mt-1.5 text-sm text-muted">{{ t('news.subscribeHint') }}</p>

    <p v-if="done" class="mt-4 flex items-center gap-2 text-sm text-success">
      <UIcon name="i-pixelarticons-check" class="size-4 shrink-0" />
      {{ t('news.subscribed') }}
    </p>

    <form v-else class="mt-4 flex flex-wrap gap-2" @submit.prevent="submit">
      <UInput
        v-model="email"
        type="email"
        required
        size="lg"
        class="min-w-56 flex-1"
        :placeholder="t('news.emailPlaceholder')"
      />
      <UButton
        type="submit"
        size="lg"
        icon="i-pixelarticons-mail"
        :loading="busy"
        :label="t('news.subscribe')"
      />
    </form>

    <p v-if="error" class="mt-2 text-sm text-error">{{ error }}</p>
  </UiPanel>
</template>
