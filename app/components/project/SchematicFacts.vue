<script setup lang="ts">
// What a schematic carries that no other project type does: its bounding box,
// its block count, the format it was saved in and the materials it will cost to
// build. All of it is read out of the file at upload and lives in the version's
// meta, so this draws whatever is there and nothing when there is not.
const props = defineProps<{ meta: Record<string, any> }>()

const { t } = useI18n()
const { count } = useCatalogFormat()

const size = computed(() => {
  const box = props.meta.size
  return box && typeof box === 'object' ? `${box.x} × ${box.y} × ${box.z}` : null
})

const materials = computed(() =>
  (Array.isArray(props.meta.materials) ? props.meta.materials : []) as Array<{
    item: string
    count: number
  }>)

const itemName = (id: string) => id.replace('minecraft:', '').replace(/_/g, ' ')
</script>

<template>
  <UiPanel v-if="size || meta.blockCount" class="p-5">
    <h2 class="mb-3 text-[11px] font-bold uppercase tracking-[0.09em] text-dimmed">
      {{ t('catalog.schematic.details') }}
    </h2>
    <dl class="space-y-2 text-sm">
      <div v-if="size" class="flex justify-between gap-4">
        <dt class="text-dimmed">{{ t('catalog.schematic.size') }}</dt>
        <dd class="font-mono text-default">{{ size }}</dd>
      </div>
      <div v-if="meta.blockCount" class="flex justify-between gap-4">
        <dt class="text-dimmed">{{ t('catalog.schematic.blocks') }}</dt>
        <dd class="font-mono text-default">{{ count(meta.blockCount) }}</dd>
      </div>
      <div v-if="meta.format" class="flex justify-between gap-4">
        <dt class="text-dimmed">{{ t('catalog.schematic.format') }}</dt>
        <dd class="font-mono text-default">{{ meta.format }}</dd>
      </div>
    </dl>
  </UiPanel>

  <UiPanel v-if="materials.length" class="p-5">
    <h2 class="mb-3 text-[11px] font-bold uppercase tracking-[0.09em] text-dimmed">
      {{ t('catalog.schematic.materials') }}
    </h2>
    <ul class="space-y-1.5 text-sm">
      <li
        v-for="material in materials"
        :key="material.item"
        class="flex items-baseline justify-between gap-4"
      >
        <span class="truncate capitalize text-muted">{{ itemName(material.item) }}</span>
        <span class="shrink-0 font-mono text-dimmed">{{ count(material.count) }}</span>
      </li>
    </ul>
  </UiPanel>
</template>
