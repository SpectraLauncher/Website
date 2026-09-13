<script setup lang="ts">
// The one place on the home page that asks for something back, so it is a band
// of its own rather than a footer note nobody reads.
const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <section class="border-t border-white/10 bg-black/20">
    <div class="container mx-auto grid max-w-6xl gap-8 px-4 py-20 lg:grid-cols-2 lg:items-center">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {{ t('news.title') }}
        </p>
        <h2 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {{ t('news.subscribeTitle') }}
        </h2>
        <p class="mt-4 max-w-prose text-pretty text-muted">
          {{ t('news.subscribeHint') }}
        </p>

        <NuxtLink
          :to="localePath('/news')"
          class="mt-5 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-default"
        >
          {{ t('news.readAll') }}
          <UIcon name="i-pixelarticons-arrow-right" class="size-4" />
        </NuxtLink>
      </div>

      <NewsSubscribe />
    </div>
  </section>
</template>
