<script setup lang="ts">
const localePath = useLocalePath()

const props = defineProps<{ tool: Tool }>()

const { t } = useI18n()

const blocks = computed(() => {
  let seed = 0
  for (const ch of props.tool.id) seed = (seed * 31 + ch.charCodeAt(0)) % 100000
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)

  return Array.from({ length: 12 }, () => ({
    x: rnd() * 400,
    y: rnd() * 200,
    size: 10 + rnd() * 20,
    delay: -(rnd() * 9).toFixed(2),
    dur: (7 + rnd() * 7).toFixed(2),
    opacity: (0.02 + rnd() * 0.05).toFixed(3)
  }))
})
</script>

<template>
  <GlassCard :id="tool.id" :to="tool.page ? localePath(`/tools/${tool.id}`) : undefined" class="flex min-h-56 flex-col scroll-mt-32">
    <div
      class="pointer-events-none absolute -bottom-20 -right-14 size-64 rounded-full opacity-30 blur-3xl transition-opacity duration-500 group-hover:opacity-55"
      :style="`background: hsl(${tool.glow ?? 210} 90% 55% / 0.4)`"
    ></div>

    <img
      v-if="tool.bg"
      :src="tool.bg"
      class="pointer-events-none absolute -bottom-4 right-0 size-56 opacity-45"
      alt=""
      aria-hidden="true"
    >

    <svg
      v-else
      class="pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect
        v-for="(b, i) in blocks"
        :key="i"
        class="tc-block"
        :x="b.x"
        :y="b.y"
        :width="b.size"
        :height="b.size"
        :rx="b.size * 0.2"
        fill="white"
        :opacity="b.opacity"
        :style="{ animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s` }"
      />
    </svg>

    <div class="relative flex flex-1 flex-col p-6">
      <div class="flex items-start justify-between gap-3">
        <UIcon :name="tool.icon" class="size-5 text-muted transition-colors group-hover:text-default" />
        <UBadge v-if="!tool.live" variant="subtle" size="sm" :label="t('toolsPage.soon')" />
      </div>

      <h3 class="mt-6 text-lg font-semibold tracking-tight">{{ tool.name }}</h3>
      <p class="mt-1.5 text-sm/relaxed text-muted">{{ t(`tools.${tool.id}`) }}</p>
    </div>
  </GlassCard>
</template>

<style scoped>
.tc-block {
    animation-name: tc-drift;
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
}

@keyframes tc-drift {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-12px); }
}

@media (prefers-reduced-motion: reduce) {
    .tc-block { animation: none; }
}
</style>
