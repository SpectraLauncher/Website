<script setup lang="ts">
const props = defineProps<{ disclosures: DisclosureMap }>()

const { t } = useI18n()

const active = computed(() => activeDisclosures(props.disclosures ?? {}))

// The options a disclosure carries are the interesting part — "uses AI" says
// much less than "uses AI for code and assets".
function detail(key: DisclosureKey): string {
  const entry = props.disclosures[key]
  if (!entry) return ''

  const options = entry.options.map(o => t(`disclosures.options.${key}.${o}`)).join(', ')
  return [options, entry.note].filter(Boolean).join(' — ')
}
</script>

<template>
  <div
    v-if="active.length"
    class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
  >
    <h2 class="mb-1 text-lg font-semibold">{{ t('disclosures.title') }}</h2>
    <p class="mb-4 text-xs text-muted">{{ t('disclosures.hint') }}</p>

    <ul class="space-y-3">
      <li v-for="key in active" :key="key" class="flex items-start gap-3">
        <UIcon :name="DISCLOSURES[key].icon" class="mt-0.5 size-4 shrink-0 text-warning" />
        <div class="min-w-0">
          <p class="text-sm font-medium">{{ t(`disclosures.${key}`) }}</p>
          <p v-if="detail(key)" class="text-xs/relaxed break-words text-muted">
            {{ detail(key) }}
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>
