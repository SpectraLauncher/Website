<script setup lang="ts">
defineProps<{ label: string, note?: string }>()
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <p class="font-mono text-xs text-toned">{{ label }}</p>
      <p v-if="note" class="text-xs text-dimmed">{{ note }}</p>
    </div>
    <div class="flex flex-wrap items-center gap-3 rounded-lg border border-default bg-default p-4">
      <slot />
    </div>
  </div>
</template>
