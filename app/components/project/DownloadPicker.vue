<script setup lang="ts">
import type { CatalogVersion } from '~/types/catalog'

const props = defineProps<{
  versions: CatalogVersion[]
  path: string
  /** Falls back to the newest file when the project supports only one setup. */
  fallbackFileId: string | null
}>()

const { t } = useI18n()
const localePath = useLocalePath()

const picks = computed(() => versionPicks(props.versions))

// One choice is not a choice: a project that ships for a single game version and
// a single platform gets the plain button it had before.
const choose = computed(() => picks.value.length > 1)

const fileOf = (version: CatalogVersion) =>
  version.files.find(file => file.primary) ?? version.files[0] ?? null

const items = computed(() => picks.value
  .filter(pick => fileOf(pick.version))
  .map(pick => ({
    label: `${pick.gameVersion} · ${t(`catalog.loaderNames.${pick.loader}`, pick.loader)}`,
    // The version number earns its place here: two rows can differ only by it.
    description: pick.version.number,
    icon: 'i-pixelarticons-download',
    to: `/api/catalog/download/${fileOf(pick.version)!.id}`,
    external: true,
  })))
</script>

<template>
  <UDropdownMenu v-if="choose" :items="[items]" :content="{ align: 'start' }">
    <UButton
      size="lg"
      color="primary"
      icon="i-pixelarticons-download"
      trailing-icon="i-pixelarticons-chevron-down"
      :label="t('catalog.download')"
    />
  </UDropdownMenu>

  <UButton
    v-else-if="fallbackFileId"
    size="lg"
    color="primary"
    icon="i-pixelarticons-download"
    :label="t('catalog.download')"
    :to="`/api/catalog/download/${fallbackFileId}`"
    external
  />
</template>
