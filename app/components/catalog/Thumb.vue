<script setup lang="ts">
defineProps<{
  src?: string | null
  fallback: string
}>()
</script>

<template>
  <span class="grid shrink-0 place-items-center overflow-hidden rounded-xl border border-inset-line bg-inset">
    <img v-if="src" :src="src" alt="" class="size-full object-cover">
    <UIcon v-else :name="fallback" class="size-2/5 text-dimmed" />
  </span>
</template>
