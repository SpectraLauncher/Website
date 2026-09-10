<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-wrap items-end gap-x-8 gap-y-5 pb-7">
    <div class="min-w-0 flex-1 basis-72">
      <h1 class="text-3xl font-extrabold tracking-tight text-highlighted sm:text-4xl">{{ title }}</h1>
      <p v-if="description" class="mt-2.5 max-w-xl text-pretty text-muted">{{ description }}</p>
    </div>

    <slot />
  </div>
</template>
