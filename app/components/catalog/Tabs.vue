<script setup lang="ts">
defineProps<{ current: string }>()

const { t } = useI18n()
const localePath = useLocalePath()

// One row of links rather than a router-driven tab widget: switching type is a
// navigation, and treating it as one keeps every entry a real link that opens
// in a new tab and reads correctly to a crawler.
//
// The types themselves come from the registry the pages read, so a type added
// there appears here without being listed twice.
</script>

<template>
  <nav class="-mx-4 overflow-x-auto border-b border-panel-line px-4">
    <ul class="flex w-max min-w-full gap-1.5 pb-4">
      <li v-for="tab in CATALOG_TYPES" :key="tab.type">
        <NuxtLink
          :to="localePath(`/${tab.prefix}`)"
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
