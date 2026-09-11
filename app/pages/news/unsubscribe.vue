<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const token = computed(() => String(route.query.token ?? ''))
const state = ref<'asking' | 'done'>('asking')
const busy = ref(false)

async function unsubscribe() {
  busy.value = true

  try {
    await $fetch('/api/news/unsubscribe', { method: 'POST', body: { token: token.value } })
    state.value = 'done'
  }
  finally { busy.value = false }
}

useSeoMeta({ title: () => t('news.unsubscribe'), robots: 'noindex' })
</script>

<template>
  <UiPageShell width="max-w-lg">
    <UiPanel class="p-8 text-center">
      <UIcon name="i-pixelarticons-mail" class="mx-auto size-10 text-dimmed" />

      <template v-if="state === 'done'">
        <h1 class="mt-4 text-xl font-bold text-highlighted">{{ t('news.unsubscribed') }}</h1>
        <UButton
          class="mt-5"
          color="neutral"
          variant="subtle"
          :to="localePath('/news')"
          :label="t('news.title')"
        />
      </template>

      <template v-else>
        <h1 class="mt-4 text-xl font-bold text-highlighted">{{ t('news.unsubscribe') }}</h1>
        <p class="mt-2 text-sm text-muted">
          {{ token ? t('news.unsubscribeHint') : t('news.unsubscribeNoToken') }}
        </p>
        <UButton
          v-if="token"
          class="mt-5"
          color="error"
          :loading="busy"
          :label="t('news.unsubscribeConfirm')"
          @click="unsubscribe"
        />
      </template>
    </UiPanel>
  </UiPageShell>
</template>
