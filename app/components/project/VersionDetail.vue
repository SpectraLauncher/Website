<script setup lang="ts">
import type { CatalogVersion } from '~/components/catalog/Project.vue'

const props = defineProps<{
  version: CatalogVersion
  path: string
  projectTitle: string
  environment: string[]
  canEdit: boolean
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const { count, when } = useCatalogFormat()
const menu = useVersionMenu(() => ({ path: props.path, canEdit: props.canEdit }))

const CHANNEL_COLOR: Record<string, 'success' | 'warning' | 'error'> = {
  release: 'success',
  beta: 'warning',
  alpha: 'error',
}

const primary = computed(() =>
  props.version.files.find(file => file.primary) ?? props.version.files[0] ?? null)

const body = computed(() => renderMarkdown(props.version.changelog ?? ''))

function size(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <NuxtLink
      :to="localePath(`${path}/versions`)"
      class="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-highlighted"
    >
      <UIcon name="i-pixelarticons-chevron-left" class="size-4" />
      {{ t('catalog.version.allVersions') }}
    </NuxtLink>

    <UiPanel class="p-5 sm:p-6">
      <div class="flex flex-wrap items-start gap-4">
        <div class="min-w-0 flex-1 basis-64">
          <div class="flex flex-wrap items-center gap-3">
            <h2 class="text-2xl font-extrabold tracking-tight text-highlighted">{{ version.number }}</h2>
            <UBadge
              size="sm"
              variant="subtle"
              :color="CHANNEL_COLOR[version.channel] ?? 'neutral'"
              :label="t(`catalog.channels.${version.channel}`)"
            />
          </div>

          <p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-dimmed">
            <span class="text-default">{{ projectTitle }} {{ version.number }}</span>
            <span>·</span>
            <span>{{ when(version.created) }}</span>
            <span>·</span>
            <span>{{ t('catalog.downloads', { n: count(version.downloads) }) }}</span>
          </p>
        </div>

        <div class="flex items-center gap-1.5">
          <UButton
            v-if="primary"
            size="lg"
            color="primary"
            icon="i-pixelarticons-download"
            :label="t('catalog.download')"
            :to="`/api/catalog/download/${primary.id}`"
            external
          />
          <UButton
            v-if="canEdit"
            size="lg"
            color="neutral"
            variant="subtle"
            icon="i-pixelarticons-edit"
            :aria-label="t('catalog.version.edit')"
            :to="localePath(`${path}/settings/version/${version.id}`)"
          />
          <UDropdownMenu :items="menu(version)" :content="{ align: 'end' }">
            <UButton
              size="lg"
              color="neutral"
              variant="subtle"
              icon="i-pixelarticons-more-vertical"
              :aria-label="t('catalog.version.more')"
            />
          </UDropdownMenu>
        </div>
      </div>
    </UiPanel>

    <section>
      <h3 class="mb-3 text-base font-bold text-highlighted">{{ t('catalog.compatibility') }}</h3>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <UiPanel inset class="p-4">
          <p class="text-[11px] font-bold uppercase tracking-[0.09em] text-dimmed">{{ t('catalog.gameVersions') }}</p>
          <div class="mt-2.5 flex flex-wrap gap-1.5">
            <span
              v-for="game in version.gameVersions"
              :key="game"
              class="inline-flex items-center rounded-md border border-panel-line bg-panel px-2 py-0.5 font-mono text-xs text-muted"
            >{{ game }}</span>
            <span v-if="!version.gameVersions.length" class="text-sm text-dimmed">—</span>
          </div>
        </UiPanel>

        <UiPanel inset class="p-4">
          <p class="text-[11px] font-bold uppercase tracking-[0.09em] text-dimmed">{{ t('catalog.version.platform') }}</p>
          <div class="mt-2.5 flex flex-wrap gap-1.5">
            <span
              v-for="loader in version.loaders"
              :key="loader"
              class="inline-flex items-center gap-1.5 rounded-md border border-panel-line bg-panel px-2 py-0.5 text-xs font-semibold text-muted"
            >
              <IconLoader :name="loader" />
              {{ t(`catalog.loaderNames.${loader}`, loader) }}
            </span>
            <span v-if="!version.loaders.length" class="text-sm text-dimmed">—</span>
          </div>
        </UiPanel>

        <UiPanel v-if="environment.length" inset class="p-4">
          <p class="text-[11px] font-bold uppercase tracking-[0.09em] text-dimmed">{{ t('catalog.environment') }}</p>
          <div class="mt-2.5 flex flex-wrap gap-1.5">
            <span
              v-for="side in environment"
              :key="side"
              class="inline-flex items-center rounded-md border border-panel-line bg-panel px-2 py-0.5 text-xs font-semibold text-muted"
            >{{ t(`catalog.environments.${side}`, side) }}</span>
          </div>
        </UiPanel>
      </div>
    </section>

    <section v-if="version.files.length">
      <h3 class="mb-3 text-base font-bold text-highlighted">{{ t('catalog.version.files') }}</h3>
      <UiPanel class="overflow-hidden">
        <div
          v-for="file in version.files"
          :key="file.id"
          class="flex flex-wrap items-center gap-3 border-b border-raised-line px-5 py-3 last:border-b-0"
        >
          <UIcon name="i-pixelarticons-file" class="size-4 shrink-0 text-dimmed" />
          <span class="min-w-0 flex-1 break-all font-mono text-xs text-default">{{ file.filename }}</span>
          <UBadge v-if="file.primary" size="sm" variant="subtle" :label="t('catalog.primary')" />
          <span class="font-mono text-xs text-dimmed">{{ size(file.size) }}</span>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-pixelarticons-download"
            :aria-label="t('catalog.download')"
            :to="`/api/catalog/download/${file.id}`"
            external
          />
        </div>
      </UiPanel>
      <p v-if="primary" class="mt-2 break-all px-1 font-mono text-[11px] text-dimmed">
        sha1 {{ primary.hashes.sha1 }}
      </p>
    </section>

    <section>
      <h3 class="mb-3 text-base font-bold text-highlighted">{{ t('catalog.version.changes') }}</h3>
      <!-- eslint-disable-next-line vue/no-v-html -- markdown-it runs with html:false -->
      <UiPanel v-if="version.changelog">
        <article class="prose prose-invert max-w-none p-5 sm:p-6 prose-a:text-primary" v-html="body" />
      </UiPanel>
      <UiPanel v-else class="p-6 text-sm text-dimmed">
        {{ t('catalog.version.noChanges') }}
      </UiPanel>
    </section>
  </div>
</template>
