<script setup lang="ts">
const props = defineProps<{ dye: Dye, size?: number }>()

const failed = ref(false)
const src = computed(() => `/dyes/${props.dye.file}.webp`)
</script>

<template>
  <img
    v-if="!failed"
    :src="src"
    :alt="dye.id"
    :width="size || 32"
    :height="size || 32"
    class="[image-rendering:pixelated]"
    loading="lazy"
    @error="failed = true"
  >
  <span
    v-else
    class="block rounded"
    :style="{ background: dye.hex, width: `${size || 32}px`, height: `${size || 32}px` }"
  />
</template>
