<script setup lang="ts">
defineProps<{ current: string }>()

const { t } = useI18n()
const localePath = useLocalePath()

// One row of links rather than a router-driven tab widget: switching type is a
// navigation, and treating it as one keeps every entry a real link that opens
// in a new tab and reads correctly to a crawler.
const TABS = [
  { type: 'mod', to: '/mod', icon: 'i-lucide-puzzle', key: 'mods' },
  { type: 'resourcepack', to: '/resourcepack', icon: 'i-lucide-image', key: 'resourcepacks' },
  { type: 'shader', to: '/shader', icon: 'i-lucide-sun', key: 'shaders' },
  { type: 'modpack', to: '/pack', icon: 'i-lucide-boxes', key: 'modpacks' },
  { type: 'schematic', to: '/schematic', icon: 'i-lucide-blocks', key: 'schematics' },
]
</script>

<template>
  <nav class="-mx-4 overflow-x-auto px-4">
    <ul class="flex w-max min-w-full gap-1 rounded-2xl border border-zinc-600/50 bg-black/30 p-1 backdrop-blur-sm">
      <li v-for="tab in TABS" :key="tab.type" class="flex-1">
        <NuxtLink
          :to="localePath(tab.to)"
          class="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm transition-colors"
          :class="tab.type === current
            ? 'bg-white/10 font-medium text-highlighted'
            : 'text-muted hover:bg-white/5 hover:text-highlighted'"
        >
          <UIcon :name="tab.icon" class="size-4 shrink-0" />
          {{ t(`catalog.${tab.key}.title`) }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
