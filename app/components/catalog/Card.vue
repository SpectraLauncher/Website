<script setup lang="ts">
defineProps<{
  hit: CatalogHit
  fallbackIcon: string
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const { count, when, price } = useCatalogFormat()
</script>

<template>
  <UiPanel :to="localePath(hit.path)" class="flex h-full flex-col p-4 sm:p-5">
    <span class="flex items-start gap-3">
      <CatalogThumb :src="hit.icon" :fallback="fallbackIcon" class="size-14" />

      <span class="min-w-0 flex-1">
        <span class="block truncate font-bold text-highlighted">{{ hit.title }}</span>
        <span class="mt-0.5 block text-xs text-dimmed">{{ t(`catalog.admin.types.${hit.type}`) }}</span>
      </span>

      <span
        class="inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-bold"
        :class="hit.price > 0
          ? 'bg-primary font-mono text-white'
          : 'border border-raised-line bg-raised text-muted'"
      >{{ price(hit.price) }}</span>
    </span>

    <span class="mt-3 line-clamp-2 text-pretty text-sm text-muted">{{ hit.summary }}</span>

    <span v-if="hit.categories.length" class="mt-3 flex flex-wrap gap-1.5">
      <span
        v-for="category in hit.categories.slice(0, 3)"
        :key="category"
        class="inline-flex items-center gap-1.5 rounded-md border border-raised-line bg-raised px-2 py-0.5 text-xs font-semibold text-muted"
      >
        <IconCategory :name="category" />
        {{ t(`catalog.categoryNames.${category}`) }}
      </span>
    </span>

    <span class="flex-1"></span>

    <span class="mt-4 flex items-center justify-between gap-3 border-t border-raised-line pt-3 text-xs text-dimmed">
      <span class="text-default">{{ t('catalog.downloads', { n: count(hit.downloads) }) }}</span>
      <span>{{ when(hit.updated) }}</span>
    </span>
  </UiPanel>
</template>
