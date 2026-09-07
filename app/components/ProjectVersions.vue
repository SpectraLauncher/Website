<script setup lang="ts">
import type { CatalogVersion } from '~/components/CatalogProject.vue'

const props = defineProps<{ versions: CatalogVersion[] }>()

const { t, locale } = useI18n()

const when = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms))
const count = (n: number) => new Intl.NumberFormat(locale.value).format(n)

const CHANNEL_COLOR: Record<string, 'success' | 'warning' | 'error'> = {
  release: 'success',
  beta: 'warning',
  alpha: 'error',
}

const size = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const primary = (version: CatalogVersion) =>
  version.files.find(file => file.primary) ?? version.files[0] ?? null

const open = ref<string | null>(props.versions[0]?.id ?? null)
</script>

<template>
  <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
    <h2 class="mb-4 text-lg font-semibold">{{ t('catalog.versions') }}</h2>

    <ul v-if="versions.length" class="space-y-2">
      <li v-for="version in versions" :key="version.id">
        <div class="rounded-2xl border border-white/10 bg-white/5">
          <button
            class="flex w-full flex-wrap items-center gap-3 p-4 text-left"
            @click="open = open === version.id ? null : version.id"
          >
            <UBadge
              size="sm"
              variant="subtle"
              :color="CHANNEL_COLOR[version.channel] ?? 'neutral'"
              :label="t(`catalog.channels.${version.channel}`)"
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium">{{ version.name }}</span>
              <span class="block text-xs text-dimmed">
                {{ version.gameVersions.join(', ') || '—' }}
                <template v-if="version.loaders.length"> · {{ version.loaders.join(', ') }}</template>
                · {{ when(version.created) }}
                · {{ t('catalog.downloads', { n: count(version.downloads) }) }}
              </span>
            </span>

            <UButton
              v-if="primary(version)"
              size="sm"
              color="primary"
              class="rounded-xl"
              icon="i-pixelarticons-download"
              :label="t('catalog.download')"
              :to="`/api/catalog/download/${primary(version)!.id}`"
              external
              @click.stop
            />
            <UIcon
              name="i-pixelarticons-chevron-down"
              class="size-4 shrink-0 text-dimmed transition-transform"
              :class="open === version.id ? 'rotate-180' : ''"
            />
          </button>

          <div v-if="open === version.id" class="border-t border-white/10 p-4">
            <ul class="space-y-2">
              <li
                v-for="file in version.files"
                :key="file.id"
                class="flex flex-wrap items-center gap-3 text-sm"
              >
                <UIcon name="i-pixelarticons-file" class="size-4 shrink-0 text-dimmed" />
                <span class="min-w-0 flex-1 break-all font-mono text-xs">{{ file.filename }}</span>
                <span class="text-xs text-dimmed">{{ size(file.size) }}</span>
                <UBadge v-if="file.primary" size="sm" variant="subtle" :label="t('catalog.primary')" />
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-pixelarticons-download"
                  :aria-label="t('catalog.download')"
                  :to="`/api/catalog/download/${file.id}`"
                  external
                />
              </li>
            </ul>

            <p class="mt-3 break-all font-mono text-[11px] text-dimmed">
              sha1 {{ primary(version)?.hashes.sha1 }}
            </p>
          </div>
        </div>
      </li>
    </ul>

    <p v-else class="text-sm text-dimmed">{{ t('catalog.noVersions') }}</p>
  </div>
</template>
