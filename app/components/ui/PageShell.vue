<script setup lang="ts">
// The page background is set here rather than on the body: only the pages
// rebuilt from docs/references are flat, and the rest of the site still paints
// /bg.webp behind glass. Wrapping the whole page — not just the content column
// — is what keeps the ground under a short page from falling back to --ui-bg.
withDefaults(defineProps<{ width?: string }>(), { width: 'max-w-7xl' })
</script>

<template>
  <div class="min-h-screen bg-page">
    <SiteNavbar />

    <section class="container mx-auto px-4 pb-24 pt-24" :class="width">
      <slot />
    </section>

    <slot name="after" />
  </div>
</template>
