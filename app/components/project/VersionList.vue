<script setup lang="ts">
import type { CatalogVersion } from '~/components/catalog/Project.vue'

const props = defineProps<{
  versions: CatalogVersion[]
  /** Where the project lives, so a version address can be built from it. */
  path: string
  projectId: string
  canEdit: boolean
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const { count, when } = useCatalogFormat()
const versionLink = useVersionLink(() => props.path)
const menu = useVersionMenu(() => ({ path: props.path, projectId: props.projectId, canEdit: props.canEdit }))

const CHANNEL_COLOR: Record<string, 'success' | 'warning' | 'error'> = {
  release: 'success',
  beta: 'warning',
  alpha: 'error',
}

const primary = (version: CatalogVersion) =>
  version.files.find(file => file.primary) ?? version.files[0] ?? null
</script>

<template>
  <UiPanel class="overflow-hidden">
    <div class="hidden grid-cols-[minmax(0,1.6fr)_1fr_1fr_0.9fr_0.7fr_auto] gap-4 border-b border-raised-line px-5 py-3 text-[11px] font-bold uppercase tracking-[0.09em] text-dimmed lg:grid">
      <span>{{ t('catalog.versions') }}</span>
      <span>{{ t('catalog.version.gameVersion') }}</span>
      <span>{{ t('catalog.version.platform') }}</span>
      <span>{{ t('catalog.version.published') }}</span>
      <span class="text-right">{{ t('catalog.downloadsLabel') }}</span>
      <span class="w-28"></span>
    </div>

    <div
      v-for="version in versions"
      :key="version.id"
      class="relative grid grid-cols-1 gap-x-4 gap-y-2 border-b border-raised-line px-5 py-3.5 transition-colors last:border-b-0 hover:bg-white/5 lg:grid-cols-[minmax(0,1.6fr)_1fr_1fr_0.9fr_0.7fr_auto] lg:items-center"
    >
      <!-- The whole row opens the version, but the buttons on it are their own
           targets — so the link is an overlay rather than a wrapper, which also
           keeps it out of the buttons' HTML. -->
      <NuxtLink
        :to="localePath(versionLink(version))"
        class="absolute inset-0"
        :aria-label="version.name"
      />

      <span class="flex min-w-0 items-center gap-2.5">
        <span
          class="grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
          :class="{
            'bg-success/15 text-success': version.channel === 'release',
            'bg-warning/15 text-warning': version.channel === 'beta',
            'bg-error/15 text-error': version.channel === 'alpha',
          }"
          :title="t(`catalog.channels.${version.channel}`)"
        >{{ t(`catalog.channels.${version.channel}`).charAt(0) }}</span>
        <span class="min-w-0">
          <span class="block truncate font-semibold text-highlighted">{{ version.number }}</span>
          <span class="block truncate text-xs text-dimmed lg:hidden">{{ version.name }}</span>
        </span>
      </span>

      <span class="flex flex-wrap gap-1.5">
        <span
          v-for="game in version.gameVersions.slice(0, 2)"
          :key="game"
          class="inline-flex items-center rounded-md border border-raised-line bg-raised px-2 py-0.5 font-mono text-xs text-muted"
        >{{ game }}</span>
        <span v-if="version.gameVersions.length > 2" class="text-xs text-dimmed">
          +{{ version.gameVersions.length - 2 }}
        </span>
      </span>

      <span class="flex flex-wrap gap-1.5">
        <span
          v-for="loader in version.loaders"
          :key="loader"
          class="inline-flex items-center gap-1.5 rounded-md border border-raised-line bg-raised px-2 py-0.5 text-xs font-semibold text-muted"
        >
          <IconLoader :name="loader" />
          {{ t(`catalog.loaderNames.${loader}`, loader) }}
        </span>
      </span>

      <span class="text-xs text-dimmed">{{ when(version.created) }}</span>
      <span class="font-mono text-sm text-default lg:text-right">{{ count(version.downloads) }}</span>

      <span class="relative z-10 flex items-center justify-end gap-1">
        <UButton
          v-if="primary(version)"
          size="sm"
          color="primary"
          variant="ghost"
          icon="i-pixelarticons-download"
          :aria-label="t('catalog.download')"
          :to="`/api/catalog/download/${primary(version)!.id}`"
          external
        />
        <UButton
          v-if="canEdit"
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-pixelarticons-edit"
          :aria-label="t('catalog.version.edit')"
          :to="localePath(`/project/${projectId}/settings/versions`)"
        />
        <UDropdownMenu :items="menu(version)" :content="{ align: 'end' }">
          <UButton
            size="sm"
            color="neutral"
            variant="ghost"
            icon="i-pixelarticons-more-vertical"
            :aria-label="t('catalog.version.more')"
          />
        </UDropdownMenu>
      </span>
    </div>

    <p v-if="!versions.length" class="p-8 text-center text-sm text-dimmed">
      {{ t('catalog.noVersions') }}
    </p>
  </UiPanel>
</template>
