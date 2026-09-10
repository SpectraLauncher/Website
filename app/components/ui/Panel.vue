<script setup lang="ts">
const props = defineProps<{
  to?: string
  inset?: boolean
}>()

const tag = computed(() => (props.to ? resolveComponent('NuxtLink') : 'div'))
</script>

<template>
  <component
    :is="tag"
    :to="to"
    class="block rounded-2xl border transition-colors"
    :class="[
      inset ? 'border-inset-line bg-inset' : 'border-panel-line bg-panel',
      to && 'hover:border-zinc-600',
    ]"
  >
    <slot />
  </component>
</template>
