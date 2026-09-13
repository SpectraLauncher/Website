<script setup lang="ts">
const props = defineProps<{
  gallery?: Array<{ url: string, featured: boolean }>
}>()

// The gallery image an author marked as featured, if they marked one. Ordering
// is the gallery's own, so the first featured entry is the one they put first.
//
// No fallback: a project with no picture is better off without a stock one than
// with everybody's the same.
const image = computed(() => props.gallery?.find(entry => entry.featured)?.url ?? null)
</script>

<template>
  <UiBackdrop :image="image" />
</template>
