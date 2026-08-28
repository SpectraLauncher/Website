<script setup lang="ts">
const localePath = useLocalePath()

const { t } = useI18n()

const pillars = computed(() => [
  { icon: 'i-lucide-rocket', to: localePath('/launcher'), t: t('home.p1t'), d: t('home.p1d'), cta: t('home.p1cta') },
  { icon: 'i-lucide-wrench', to: localePath('/tools'), t: t('home.p2t'), d: t('home.p2d'), cta: t('home.p2cta') },
  { icon: 'i-simple-icons-discord', to: DISCORD_INVITE, t: t('home.p3t'), d: t('home.p3d'), cta: t('home.p3cta') }
])
</script>

<template>
  <section class="container mx-auto px-4 py-20">
    <div class="grid gap-4 md:grid-cols-3">
      <GlassCard
        v-for="p in pillars"
        :key="p.t"
        v-reveal
        :to="p.to"
        :target="p.to.startsWith('http') ? '_blank' : undefined"
        class="p-7"
      >
        <UIcon :name="p.icon" class="mb-6 size-6 text-muted transition-colors group-hover:text-default" />

        <h3 class="mb-2.5 text-xl font-semibold tracking-tight">{{ p.t }}</h3>
        <p class="mb-5 text-sm/relaxed text-muted">{{ p.d }}</p>

        <div class="flex items-center gap-1.5 text-sm text-muted transition-colors group-hover:text-default">
          {{ p.cta }}
          <UIcon name="i-lucide-arrow-right" class="size-4 transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </GlassCard>
    </div>
  </section>
</template>
