<script setup lang="ts">
// The page background is set here rather than on the body: only the pages
// rebuilt from docs/references are flat, and the rest of the site still paints
// /bg.webp behind glass. Wrapping the whole page — not just the content column
// — is what keeps the ground under a short page from falling back to --ui-bg.
withDefaults(defineProps<{
  width?: string
  /** A wide picture painted behind the top of the page and faded out. */
  backdrop?: string | null
}>(), { width: 'max-w-7xl', backdrop: null })
</script>

<template>
  <div class="relative min-h-screen bg-page">
    <!-- Behind the content and faded to nothing before the text starts, the way
         a project wears its feature image. Fixed height rather than the picture's
         own: a banner is a band at the top, not a background for the page. -->
    <div
      v-if="backdrop"
      class="pointer-events-none absolute inset-x-0 top-0 z-0 h-[420px] bg-cover bg-center mask-b-from-30% mask-b-to-100%"
      :style="{ backgroundImage: `url(${JSON.stringify(backdrop)})` }"
    ></div>

    <SiteNavbar />

    <!-- The navigation is fixed and sits 12 rem down the page on a wide screen,
         so the clearance is not the height of the bar alone. -->
    <section class="container relative z-10 mx-auto px-4 pb-24 pt-28 sm:pt-36" :class="width">
      <slot />
    </section>

    <slot name="after" />
  </div>
</template>
