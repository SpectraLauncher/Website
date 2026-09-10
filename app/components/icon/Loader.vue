<script setup lang="ts">
import type { Component } from 'vue'

const props = defineProps<{ name: string }>()

// Registry: loader id -> the drawn mark next to this file. To add one, drop the
// svg in app/components/icon/ and add the pair here; anything unmapped falls
// back to the generic plug, so a loader nobody has drawn yet still renders.
const MARKS: Record<string, Component> = {
  fabric: resolveComponent('IconFabric'),
  quilt: resolveComponent('IconQuilt'),
  forge: resolveComponent('IconForge'),
  neoforge: resolveComponent('IconNeoforge'),
  minecraft: resolveComponent('IconVanilla'),
}

const mark = computed(() => MARKS[props.name.toLowerCase()])
</script>

<template>
  <component :is="mark" v-if="mark" class="size-3.5 shrink-0" />
  <UIcon v-else name="i-pixelarticons-plug" class="size-3.5 shrink-0" />
</template>
