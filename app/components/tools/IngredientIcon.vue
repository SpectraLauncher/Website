<script setup lang="ts">
const props = withDefaults(defineProps<{ ingredient: string, size?: number }>(), { size: 22 })

const failed = ref(false)
const src = computed(() => ingredientTexture(props.ingredient))

watch(src, () => { failed.value = false })
</script>

<template>
  <img
    v-if="!failed"
    :src="src"
    :width="props.size"
    :height="props.size"
    alt=""
    aria-hidden="true"
    class="shrink-0 [image-rendering:pixelated]"
    loading="lazy"
    @error="failed = true"
  >
</template>
