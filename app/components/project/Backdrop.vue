<script setup lang="ts">
defineProps<{ banner?: string | null }>()
</script>

<template>
  <UiBackdrop :image="banner" />
</template>
