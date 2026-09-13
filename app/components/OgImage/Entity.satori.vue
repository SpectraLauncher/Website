<script setup lang="ts">
/**
 * A card for one thing that has a picture: a project with its icon, a player
 * with their skin render.
 *
 * Separate from Spectra.satori because the layout is genuinely different — the
 * picture is a column, not an ornament — and folding both into one template
 * meant every prop being optional and the result reading as neither.
 *
 * Satori draws a subset of CSS: every element needs an explicit `display: flex`,
 * there is no `gap` on block layout, and an image has to be an absolute URL it
 * can fetch. Keep to what is here rather than reaching for the rest.
 */
withDefaults(defineProps<{
  title?: string
  description?: string
  /** Absolute URL. The project's icon, or a render of the player's skin. */
  image?: string
  /** "Mod", "Shaderpack", "Player" — what the thing is. */
  kind?: string
  /** Up to three "2.4M downloads" style pairs. */
  facts?: Array<{ value: string, label: string }>
  /** A render of a person stands on the baseline; an icon sits in a tile. */
  portrait?: boolean
}>(), {
  title: 'Spectra',
  description: '',
  image: '',
  kind: '',
  facts: () => [],
  portrait: false,
})
</script>

<template>
  <div
    class="flex h-full w-full bg-[#05080f] text-white"
    style="font-family: Inter, sans-serif"
  >
    <div class="flex h-full w-full flex-col justify-between p-16">
      <div class="flex w-full flex-col">
        <div v-if="kind" class="flex items-center">
          <div class="flex h-2 w-16 rounded-full bg-[#0084d1]" />
          <div class="ml-4 flex text-2xl font-semibold uppercase tracking-widest text-[#0084d1]">
            {{ kind }}
          </div>
        </div>

        <div class="mt-8 flex text-7xl font-bold leading-tight tracking-tight">
          {{ title.length > 42 ? `${title.slice(0, 42)}…` : title }}
        </div>

        <div v-if="description" class="mt-6 flex text-3xl leading-snug text-[#9aa3b2]">
          {{ description.length > 110 ? `${description.slice(0, 110)}…` : description }}
        </div>
      </div>

      <div class="flex w-full items-end justify-between">
        <div class="flex items-center">
          <div v-for="fact in facts.slice(0, 3)" :key="fact.label" class="mr-12 flex flex-col">
            <div class="flex text-4xl font-bold">{{ fact.value }}</div>
            <div class="mt-1 flex text-xl text-[#6b7280]">{{ fact.label }}</div>
          </div>
        </div>

        <div class="flex text-2xl font-semibold text-white">Spectra</div>
      </div>
    </div>

    <!-- The picture column. A person is drawn standing, so it bleeds off the
         bottom edge; an icon is a square object and sits in its own tile. -->
    <div
      v-if="image"
      class="flex h-full w-[420px] shrink-0 items-center justify-center"
      :style="portrait
        ? 'background: linear-gradient(160deg, #141a2b 0%, #05080f 100%)'
        : 'background: linear-gradient(160deg, #161d2e 0%, #05080f 100%)'"
    >
      <img
        v-if="portrait"
        :src="image"
        width="340"
        height="500"
        style="object-fit: contain"
      >
      <img
        v-else
        :src="image"
        width="260"
        height="260"
        style="object-fit: cover; border-radius: 48px"
      >
    </div>
  </div>
</template>
