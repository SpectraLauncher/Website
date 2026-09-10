<script setup lang="ts">
const props = defineProps<{
  hit: CatalogHit
  fallbackIcon: string
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const { count, when, price } = useCatalogFormat()

const versions = computed(() => gameVersionRange(props.hit.gameVersions))
</script>

<template>
  <UiPanel :to="localePath(hit.path)" class="flex flex-wrap items-start gap-x-5 gap-y-4 p-4 sm:p-5">
    <CatalogThumb :src="hit.icon" :fallback="fallbackIcon" class="size-16 sm:size-20" />

    <span class="min-w-0 flex-1 basis-60">
      <span class="block text-lg font-bold tracking-tight text-highlighted">{{ hit.title }}</span>
      <span class="mt-1.5 block text-pretty text-sm text-muted">{{ hit.summary }}</span>

      <span v-if="hit.categories.length" class="mt-3 flex flex-wrap gap-1.5">
        <span
          v-for="category in hit.categories.slice(0, 5)"
          :key="category"
          class="inline-flex items-center gap-1.5 rounded-md border border-raised-line bg-raised px-2 py-0.5 text-xs font-semibold text-muted"
        >
          <IconCategory :name="category" />
          {{ t(`catalog.categoryNames.${category}`) }}
        </span>
      </span>

      <span class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-dimmed">
        <span class="text-default">{{ t('catalog.downloads', { n: count(hit.downloads) }) }}</span>
        <span v-if="hit.follows">{{ t('catalog.follows', { n: count(hit.follows) }) }}</span>
        <span v-if="versions" class="font-mono">{{ versions }}</span>
        <span v-if="hit.loaders.length" class="flex items-center gap-1.5">
          <IconLoader v-for="loader in hit.loaders.slice(0, 4)" :key="loader" :name="loader" />
        </span>
        <span>{{ t('catalog.updated') }} {{ when(hit.updated) }}</span>
      </span>
    </span>

    <span
      class="inline-flex h-7 shrink-0 items-center rounded-full px-3 text-xs font-bold"
      :class="hit.price > 0
        ? 'bg-primary font-mono text-white'
        : 'border border-raised-line bg-raised text-muted'"
    >{{ price(hit.price) }}</span>
  </UiPanel>
</template>
