<script setup lang="ts">
const props = defineProps<{
  banner?: string | null
  gallery?: Array<{ url: string, featured: boolean }>
}>()

// The project's own banner, or the gallery image an author ticked as featured
// before banners existed.
//
// The tick is the old way and stays only as a fallback: it asked authors to put
// a 1920x560 banner into a list of screenshots, where it then also appeared as a
// screenshot. Uploading one as itself is the way now.
//
// No stock picture behind either: a project with none is better off without one
// than wearing everybody else's.
const image = computed(() =>
  props.banner || props.gallery?.find(entry => entry.featured)?.url || null)
</script>

<template>
  <UiBackdrop :image="image" />
</template>
