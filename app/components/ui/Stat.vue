<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  sub?: string
}>()
</script>

<template>
  <div class="min-w-0">
    <p class="truncate text-[11px] font-bold uppercase tracking-[0.09em] text-dimmed">{{ label }}</p>
    <p class="mt-1.5 truncate font-mono text-2xl font-extrabold text-highlighted">{{ value }}</p>
    <p v-if="sub" class="mt-0.5 truncate text-xs text-muted">{{ sub }}</p>
  </div>
</template>
