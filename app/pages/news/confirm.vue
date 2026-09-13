<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const token = computed(() => String(route.query.token ?? ''))
const state = ref<'working' | 'done'>('working')

// The link is the whole point of the message, so it acts on arrival rather than
// asking the reader to press a second button.
onMounted(async () => {
  if (!token.value) return

  await $fetch('/api/news/confirm', { method: 'POST', body: { token: token.value } })
    .catch(() => {})

  state.value = 'done'
})

useSeoMeta({ title: () => t('news.confirmTitle'), robots: 'noindex' })
</script>

<template>
  <UiPageShell width="max-w-lg">
    <UiPanel class="p-8 text-center">
      <UIcon
        :name="state === 'done' ? 'i-pixelarticons-check' : 'i-pixelarticons-mail'"
        class="mx-auto size-10"
        :class="state === 'done' ? 'text-success' : 'text-dimmed'"
      />

      <h1 class="mt-4 text-xl font-bold text-highlighted">
        {{ token ? t(state === 'done' ? 'news.confirmed' : 'news.confirmTitle') : t('news.confirmNoToken') }}
      </h1>

      <p v-if="token && state === 'done'" class="mt-2 text-sm text-muted">
        {{ t('news.confirmedBody') }}
      </p>

      <UButton
        class="mt-6"
        color="neutral"
        variant="subtle"
        :to="localePath('/news')"
        :label="t('news.title')"
      />
    </UiPanel>
  </UiPageShell>
</template>
