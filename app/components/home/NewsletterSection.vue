<script setup lang="ts">
// Its own band under the articles: reading the blog and subscribing to it are
// two different asks, and folding them into one section made the heading claim
// the articles were an e-mail.
const { t } = useI18n()
</script>

<template>
  <section class="container mx-auto px-4 pb-20">
    <UiGlassCard v-reveal class="p-8 sm:p-10">
      <div class="grid gap-8 lg:grid-cols-2 lg:items-center">
        <div>
          <div class="mb-4 flex size-11 items-center justify-center rounded-2xl bg-white/5">
            <UIcon name="i-pixelarticons-mail" class="size-5 text-muted" />
          </div>

          <h2 class="text-3xl font-semibold tracking-tight">{{ t('home.newsletterTitle') }}</h2>
          <p class="mt-3 max-w-[52ch] text-muted">{{ t('home.newsletterSub') }}</p>
        </div>

        <NewsSubscribe plain />
      </div>
    </UiGlassCard>
  </section>
</template>
