<script setup lang="ts">
import type { Component } from 'vue'

const props = defineProps<{ region: string }>()

// Registry: region code -> the flag drawn in app/components/icon/flag/. Adding a
// locale to nuxt.config means dropping its flag in that folder and adding the
// pair here; an unmapped region renders nothing rather than an empty box.
//
// resolveComponent, never the name as a string — a name in <component :is> does
// not resolve, see test/unit/dynamic-component.test.ts.
const FLAGS: Record<string, Component> = {
  US: resolveComponent('IconFlagUs'),
  PL: resolveComponent('IconFlagPl'),
}

const flag = computed(() => FLAGS[props.region.toUpperCase()])
</script>

<template>
  <component
    :is="flag"
    v-if="flag"
    class="h-4 w-6 shrink-0 rounded-[3px] ring-1 ring-inset ring-black/30"
  />
</template>
