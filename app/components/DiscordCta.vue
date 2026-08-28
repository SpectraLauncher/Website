<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <section class="container mx-auto px-4 py-20">
    <div
      v-reveal
      class="flex flex-wrap items-center justify-between gap-9 rounded-3xl border border-zinc-600/50 bg-black/30 p-11 backdrop-blur-sm"
    >
      <div>
        <h2 class="mb-2.5 text-3xl font-semibold tracking-tight">{{ t('home.discordTitle') }}</h2>
        <p class="max-w-[48ch] text-muted">{{ t('home.discordSub') }}</p>
      </div>

      <div class="flex items-center gap-6">
        <div>
          <div class="text-3xl font-bold tracking-tight">{{ DISCORD_MEMBERS }}</div>
          <div class="mt-0.5 text-xs text-dimmed">{{ t('home.members') }}</div>
        </div>

        <UButton
          :to="DISCORD_INVITE"
          target="_blank"
          size="xl"
          color="neutral"
          icon="i-simple-icons-discord"
          :label="t('home.discordCta')"
          class="whitespace-nowrap rounded-xl"
        />
      </div>
    </div>
  </section>
</template>
