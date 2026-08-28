<script setup lang="ts">

const localePath = useLocalePath()
const { t } = useI18n()

const KEY = 'spectra_cookie_notice'

const seen = ref(true)

onMounted(() => {
  try {
    seen.value = localStorage.getItem(KEY) === '1'
  }
  catch {
    seen.value = true
  }
})

function dismiss() {
  seen.value = true
  try {
    localStorage.setItem(KEY, '1')
  }
  catch { /* nie ma gdzie zapisac, trudno */ }
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-300"
    enter-from-class="translate-y-4 opacity-0"
    leave-active-class="transition duration-200"
    leave-to-class="translate-y-4 opacity-0"
  >
    <div
      v-if="!seen"
      class="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-zinc-600/50 bg-black/80 p-4 backdrop-blur-md sm:inset-x-6"
    >
      <div class="flex flex-wrap items-center gap-4">
        <UIcon name="i-lucide-cookie" class="size-5 shrink-0 text-primary" />

        <p class="min-w-0 flex-1 text-sm/relaxed text-muted">
          {{ t('cookieNotice.body') }}
          <NuxtLink :to="localePath('/cookies')" class="text-default underline underline-offset-2">
            {{ t('cookieNotice.more') }}
          </NuxtLink>
        </p>

        <UButton size="sm" color="neutral" class="rounded-xl" :label="t('cookieNotice.ok')" @click="dismiss" />
      </div>
    </div>
  </Transition>
</template>
