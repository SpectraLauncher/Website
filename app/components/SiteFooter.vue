<script setup lang="ts">
const localePath = useLocalePath()
const { t } = useI18n()

const LEGAL = [
  { key: 'privacy.title', to: '/privacy' },
  { key: 'terms.title', to: '/terms' },
  { key: 'cookies.title', to: '/cookies' }
]
</script>

<template>
  <footer class="border-t border-white/10 bg-black/30">
    <div class="container mx-auto flex flex-wrap items-center justify-between gap-6 px-4 py-10">
      <div class="flex items-center gap-3">
        <img src="/logo-transparent.png" width="28" height="28" alt="" />
        <div>
          <p class="text-sm font-semibold">Spectra</p>
          <p class="text-xs text-dimmed">{{ t('footer.tagline') }}</p>
        </div>
      </div>

      <nav class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <NuxtLink
          v-for="item in LEGAL"
          :key="item.to"
          :to="localePath(item.to)"
          class="text-muted transition-colors hover:text-default"
        >
          {{ t(item.key) }}
        </NuxtLink>

        <a
          href="https://github.com/MakotoPD/Spectra-Launcher"
          target="_blank"
          rel="noopener"
          class="text-muted transition-colors hover:text-default"
        >GitHub</a>
      </nav>
    </div>

    <div class="container mx-auto px-4 pb-8">
      <p class="text-xs/relaxed text-dimmed">{{ t('footer.disclaimer') }}</p>
    </div>
  </footer>
</template>
