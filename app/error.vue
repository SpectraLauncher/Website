<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const { t, te } = useI18n()
const localePath = useLocalePath()

const status = computed(() => Number(props.error?.statusCode) || 500)

const key = computed(() => {
  const code = `error.${status.value}.title`
  return te(code) ? String(status.value) : 'default'
})

const title = computed(() => t(`error.${key.value}.title`))
const body = computed(() => t(`error.${key.value}.body`))

useSeoMeta({
  title: () => `${status.value} — ${title.value}`,
  robots: 'noindex'
})

const goHome = () => clearError({ redirect: localePath('/') })
</script>

<template>
  <UApp>
    <div class="relative flex min-h-screen flex-col overflow-x-clip">
      <Navbar />

      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-4 py-40 text-center">
        <p class="font-mono text-7xl font-semibold tracking-tight text-primary md:text-8xl">{{ status }}</p>
        <h1 class="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">{{ title }}</h1>
        <p class="mt-3 max-w-lg text-base/relaxed text-muted">{{ body }}</p>

        <p v-if="error?.statusMessage && status >= 500" class="mt-4 max-w-lg break-words rounded-xl border border-white/10 bg-black/30 px-4 py-2 font-mono text-xs text-dimmed">
          {{ error.statusMessage }}
        </p>

        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <UButton size="lg" class="rounded-xl" icon="i-lucide-house" :label="t('error.home')" @click="goHome" />
          <UButton
            size="lg"
            variant="soft"
            color="neutral"
            class="rounded-xl"
            icon="i-lucide-arrow-left"
            :label="t('error.back')"
            @click="$router.back()"
          />
        </div>
      </section>

      <SiteFooter />
    </div>
  </UApp>
</template>
