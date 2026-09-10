<script setup lang="ts">
defineProps<{ current: string }>()

const { t } = useI18n()
const localePath = useLocalePath()

// One row of links rather than a router-driven tab widget: switching type is a
// navigation, and treating it as one keeps every entry a real link that opens
// in a new tab and reads correctly to a crawler.
const TABS = [
  { type: 'mod', to: '/mod', icon: 'i-pixelarticons-shapes', key: 'mods' },
  { type: 'plugin', to: '/plugin', icon: 'i-pixelarticons-plug', key: 'plugins' },
  { type: 'resourcepack', to: '/resourcepack', icon: 'i-pixelarticons-image', key: 'resourcepacks' },
  { type: 'shader', to: '/shader', icon: 'i-pixelarticons-sun', key: 'shaders' },
  { type: 'modpack', to: '/pack', icon: 'i-pixelarticons-archive', key: 'modpacks' },
  { type: 'schematic', to: '/schematic', icon: 'i-pixelarticons-blocks', key: 'schematics' },
]
</script>

<template>
  <nav class="-mx-4 overflow-x-auto border-b border-panel-line px-4">
    <ul class="flex w-max min-w-full gap-1.5 pb-4">
      <li v-for="tab in TABS" :key="tab.type">
        <NuxtLink
          :to="localePath(tab.to)"
          class="flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border px-4 text-sm transition-colors"
          :class="tab.type === current
            ? 'border-primary/40 bg-primary/10 font-bold text-primary'
            : 'border-panel-line font-medium text-muted hover:border-zinc-600 hover:text-highlighted'"
        >
          <UIcon :name="tab.icon" class="size-4 shrink-0" />
          {{ t(`catalog.${tab.key}.title`) }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
