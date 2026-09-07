<script setup lang="ts">
const props = defineProps<{
  gallery?: Array<{ url: string, featured: boolean }>
}>()

// The gallery image an author marked as featured, if they marked one. Ordering
// is the gallery's own, so the first featured entry is the one they put first.
const featured = computed(() =>
  cssSafeAssetUrl(props.gallery?.find(image => image.featured)?.url))

const image = computed(() => featured.value ?? '/bg.webp')
</script>

<template>
  <div
    class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-cover bg-center mask-b-from-30% mask-b-to-100%"
    :style="{ backgroundImage: `url(${image})` }"
  ></div>
</template>
