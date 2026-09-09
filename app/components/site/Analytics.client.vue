<script setup lang="ts">

const config = useRuntimeConfig().public

const src = String(config.umamiSrc || '')
const id = String(config.umamiId || '')

useHead(() => ({
  script: src && id
    ? [{ src, defer: true, 'data-website-id': id, key: 'umami' }]
    : []
}))
</script>

<template>
  <div class="hidden" />
</template>
