<script setup lang="ts">
// The settings page used to live here. The address stays working because it is
// in old links, e-mails and bookmarks.
const localePath = useLocalePath()
await navigateTo(localePath('/settings'), { redirectCode: 301, replace: true })
</script>

<template>
  <div />
</template>
