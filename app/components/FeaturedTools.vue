<script setup lang="ts">
const localePath = useLocalePath()

const { t } = useI18n()

</script>

<template>
  <section class="container mx-auto px-4 py-20">
    <div v-reveal class="mb-3 flex flex-wrap items-end justify-between gap-6">
      <h2 class="text-4xl font-semibold tracking-tight">{{ t('home.toolsTitle') }}</h2>
      <NuxtLink :to="localePath('/tools')" class="group flex items-center gap-1.5 pb-1.5 text-sm text-muted transition-colors hover:text-default">
        {{ t('home.seeAll') }}
        <UIcon name="i-lucide-arrow-right" class="size-4 transition-transform duration-300 group-hover:translate-x-1" />
      </NuxtLink>
    </div>
    <p v-reveal class="mb-8 max-w-[62ch] text-muted">{{ t('home.toolsSub') }}</p>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <GlassCard
        v-for="tool in FEATURED_TOOLS"
        :key="tool.id"
        v-reveal
        :to="tool.page ? localePath(`/tools/${tool.id}`) : localePath('/tools') + `#${tool.id}`"
        class="flex flex-col p-6"
      >
        <div
          class="pointer-events-none absolute -bottom-16 -right-12 size-52 rounded-full opacity-25 blur-3xl transition-opacity duration-500 group-hover:opacity-45"
          :style="`background: hsl(${tool.glow ?? 210} 90% 55% / 0.4)`"
        ></div>

        <UIcon :name="tool.icon" class="mb-5 size-5 text-muted transition-colors group-hover:text-default" />

        <div class="mb-2 flex items-center gap-2">
          <span class="font-semibold tracking-tight">{{ tool.name }}</span>
        </div>

        <p class="mb-4 flex-1 text-sm/relaxed text-muted">{{ t(`tools.${tool.id}`) }}</p>

        <div class="text-xs text-dimmed">{{ t(`cats.${tool.cat}`) }}</div>
      </GlassCard>
    </div>
  </section>
</template>
