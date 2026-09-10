<script setup lang="ts">
const props = defineProps<{
  gallery?: Array<{ url: string, featured: boolean }>
}>()

// The gallery image an author marked as featured, if they marked one. Ordering
// is the gallery's own, so the first featured entry is the one they put first.
//
// No fallback: this is a band inside the header card now rather than a wash
// behind the whole page, and a project with no picture is better off without a
// stock one than with everybody's the same.
const image = computed(() =>
  cssSafeAssetUrl(props.gallery?.find(entry => entry.featured)?.url))
</script>

<template>
  <div v-if="image" class="relative h-36 sm:h-44">
    <div
      class="absolute inset-0 bg-cover bg-center"
      :style="{ backgroundImage: `url(${image})` }"
    ></div>
    <div class="absolute inset-0 bg-gradient-to-b from-page/20 to-panel"></div>
  </div>
</template>
