<script setup lang="ts">
const localePath = useLocalePath()

const { t, tm, rt } = useI18n()

const bullets = computed(() => (tm('home.launcherBullets') as unknown[]).map(b => rt(b as string)))
</script>

<template>
  <section v-reveal class="relative mx-auto w-full max-w-[110rem] overflow-hidden rounded-3xl md:rounded-4xl">
      <div class="absolute inset-0 bg-linear-to-br from-[#328bbe] via-[#1e58af] to-[#388ed4]"></div>
      <div class="pointer-events-none absolute inset-0" style="background: radial-gradient(circle at 30% 20%, rgba(34, 211, 238, 0.15), transparent 50%), radial-gradient(circle at 80% 80%, rgba(99, 102, 241, 0.2), transparent 50%);"></div>
      <div class="pointer-events-none absolute inset-0 opacity-[0.02]" style="background-image: linear-gradient(to right, rgb(255, 255, 255) 1px, transparent 1px), linear-gradient(rgb(255, 255, 255) 1px, transparent 1px); background-size: 3rem 3rem; mask-image: linear-gradient(black 30%, transparent 90%);"></div>
      <div class="relative container mx-auto grid items-center gap-8 px-4 py-12 md:gap-11 md:py-20 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <div class="mb-4 text-sm font-semibold text-white flex items-center gap-2 bg-black/10 rounded-md w-fit py-1 px-2">
            <NuxtImg src="/logo-transparent.png" width="24" height="24" lazy />
            {{ t('home.launcherKicker') }}
          </div>
          <h2 class="mb-4 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">{{ t('home.launcherTitle') }}</h2>
          <p class="mb-7 text-gray-300">{{ t('home.launcherSub') }}</p>

          <div class="mb-8 flex flex-col gap-2.5">
            <div
              v-for="(b, i) in bullets"
              :key="i"
              class="flex items-start gap-3 rounded-2xl border border-zinc-300/50 bg-sky-300/30 px-4 py-3.5 text-sm/relaxed backdrop-blur-sm"
            >
              <span class="shrink-0 pt-0.5 text-xs text-gray-300">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="font-semibold text-white">{{ b }}</span>
            </div>
          </div>

          <UButton :to="localePath('/launcher')" variant="solid" color="neutral" size="lg" :label="t('home.launcherCta')" trailing-icon="i-lucide-arrow-right" class="mb-4 w-full justify-center rounded-xl sm:w-auto" />
          
          <div data-hero="" class="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-xs text-white/70 sm:text-sm">
            <span class="inline-flex items-center gap-[7px]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5 10 4v7.5H3V5.5Zm0 13L10 20v-7.3H3V18.5ZM11 3.8 21 2v9.5H11V3.8Zm0 16.4L21 22v-9.4H11v7.6Z"></path>
              </svg>
              Windows
            </span>
            <span class="inline-flex items-center gap-[7px]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.8-3.5.8s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.8ZM14.1 5c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3Z"></path>
              </svg>macOS
            </span>
            <span class="inline-flex items-center gap-[7px]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-1.7 0-3 1.4-3 3.2 0 1 .1 2.2-.5 3.4-.7 1.3-2 2.4-2 4.7 0 .9.3 1.7.7 2.4-.5.4-.9 1-.9 1.8 0 1.5 1.4 2.3 3.2 2.7 1 .2 1.8.9 2.5.9s1.5-.7 2.5-.9c1.8-.4 3.2-1.2 3.2-2.7 0-.8-.4-1.4-.9-1.8.4-.7.7-1.5.7-2.4 0-2.3-1.3-3.4-2-4.7-.6-1.2-.5-2.4-.5-3.4C15 3.4 13.7 2 12 2Z"></path>
              </svg>
              Linux
            </span>
            <span style="color:#3f4d63;">·</span>
            <span class="font-mono">GPLv3</span>
          </div>
        </div>

        <GlassCard v-reveal class="p-3">
          
          <NuxtImg
            src="/screenshots/MainMenu.png"
            alt="Spectra Launcher"
            class="block w-full rounded-2xl"
            loading="lazy"
          />
        </GlassCard>
      </div>
  </section>

</template>
