<script setup lang="ts">
// The manifest is one flat list of several hundred entries, so a dropdown is
// the wrong shape for it: you pick five versions out of it, from lines you
// already know, and you want to see which ones are next to each other. A
// searchable grid of grouped buttons is what that looks like.
const props = defineProps<{
  versions: PickableVersion[]
}>()

const selected = defineModel<string[]>({ required: true })

const { t } = useI18n()

const search = ref('')
const showAll = ref(false)

const shown = computed(() => {
  const needle = search.value.trim().toLowerCase()

  return props.versions
    .filter(version => showAll.value || version.type === 'release')
    .filter(version => !needle || version.id.toLowerCase().includes(needle))
})

const groups = computed(() => groupVersions(shown.value))

function toggle(id: string) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter(version => version !== id)
    : [...selected.value, id]
}

// Whole line at once, because a mod that works on 1.21 usually works on every
// patch of it and clicking eight buttons to say so is the tedious part.
function toggleGroup(versions: string[]) {
  const every = versions.every(version => selected.value.includes(version))

  selected.value = every
    ? selected.value.filter(version => !versions.includes(version))
    : [...new Set([...selected.value, ...versions])]
}
</script>

<template>
  <div class="space-y-2.5">
    <div class="flex flex-wrap items-center gap-2">
      <UInput
        v-model="search"
        class="min-w-40 flex-1"
        size="sm"
        icon="i-pixelarticons-search"
        :placeholder="t('catalog.searchVersions')"
      />
      <UButton
        size="sm"
        class="rounded-xl"
        :color="showAll ? 'primary' : 'neutral'"
        :variant="showAll ? 'subtle' : 'ghost'"
        :label="t('catalog.showSnapshots')"
        @click="showAll = !showAll"
      />
    </div>

    <div class="max-h-72 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3">
      <div v-for="group in groups" :key="group.key">
        <button
          class="mb-1.5 text-xs font-semibold text-dimmed transition-colors hover:text-default"
          @click="toggleGroup(group.versions)"
        >
          {{ group.key }}
        </button>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="version in group.versions"
            :key="version"
            class="rounded-lg border px-2 py-1 font-mono text-xs transition-colors"
            :class="selected.includes(version)
              ? 'border-primary/60 bg-primary/15 text-default'
              : 'border-white/10 bg-white/5 text-muted hover:border-white/25 hover:text-default'"
            :aria-pressed="selected.includes(version)"
            @click="toggle(version)"
          >{{ version }}</button>
        </div>
      </div>

      <p v-if="!groups.length" class="text-sm text-dimmed">{{ t('catalog.noVersionsFound') }}</p>
    </div>

    <div v-if="selected.length" class="flex flex-wrap items-center gap-1.5">
      <span class="text-xs text-dimmed">{{ t('catalog.selectedVersions') }}</span>
      <button
        v-for="version in selected"
        :key="version"
        class="inline-flex items-center gap-1 rounded-lg border border-primary/50 bg-primary/10 px-2 py-1 font-mono text-xs transition-colors hover:border-error/60"
        @click="toggle(version)"
      >
        {{ version }}
        <UIcon name="i-pixelarticons-close" class="size-3" />
      </button>
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        :label="t('catalog.clearAll')"
        @click="selected = []"
      />
    </div>
  </div>
</template>
