<script setup lang="ts">
const props = defineProps<{ image?: string | null }>()

// A band across the top of the card it opens, fading into the panel below it —
// not a wash behind the whole page. Shared so a project's feature image and a
// profile's banner cannot drift into looking like two different ideas.
const url = computed(() => cssSafeAssetUrl(props.image ?? undefined))
</script>

<template>
  <div v-if="url" class="relative h-36 sm:h-44">
    <div
      class="absolute inset-0 bg-cover bg-center"
      :style="{ backgroundImage: `url(${url})` }"
    ></div>
    <div class="absolute inset-0 bg-gradient-to-b from-page/20 to-panel"></div>
  </div>
</template>
