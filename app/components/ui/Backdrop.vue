<script setup lang="ts">
const props = defineProps<{ image?: string | null }>()

// The picture at the top of a card, whole.
//
// It used to be a fixed band with the image scaled to cover it, which showed a
// strip out of the middle — of a project's feature shot and of a banner somebody
// made to be a banner. Its own height instead: no box, no padding, the picture's
// shape is the shape of the band.
//
// Shared so a project's feature image and a profile's banner cannot drift into
// looking like two different ideas.
const url = computed(() => cssSafeAssetUrl(props.image ?? undefined))
</script>

<template>
  <div v-if="url" class="relative">
    <img :src="url" alt="" class="block h-auto w-full">

    <!-- Only the last stretch fades, so the join with the card is clean without
         dimming the picture somebody chose. -->
    <div class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-panel"></div>
  </div>
</template>
