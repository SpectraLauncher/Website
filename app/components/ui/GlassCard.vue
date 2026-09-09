<script setup lang="ts">
const props = defineProps<{
  to?: string
  target?: string
}>()

const tag = computed(() => (props.to ? resolveComponent('NuxtLink') : 'div'))
</script>

<template>
  <component
    :is="tag"
    :to="to"
    :target="target"
    :rel="target === '_blank' ? 'noreferrer' : undefined"
    class="group relative block overflow-hidden rounded-3xl border border-zinc-600/50 bg-black/30 backdrop-blur-sm transition-colors hover:border-zinc-500"
  >
    <slot />
  </component>
</template>
