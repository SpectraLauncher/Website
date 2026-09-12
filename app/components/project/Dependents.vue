<script setup lang="ts">
import type { DependentProject } from '~/types/catalog'

defineProps<{ dependents: DependentProject[] }>()

const { t } = useI18n()
const localePath = useLocalePath()
const { count } = useCatalogFormat()
</script>

<template>
  <UiPanel v-if="dependents.length" class="p-5">
    <h2 class="text-[11px] font-bold uppercase tracking-[0.09em] text-dimmed">
      {{ t('catalog.dependents') }}
    </h2>
    <p class="mt-1 text-xs text-dimmed">{{ t('catalog.dependentsHint') }}</p>

    <ul class="mt-3 space-y-2">
      <li v-for="project in dependents" :key="project.id">
        <NuxtLink
          :to="localePath(projectPath(project.type, project.slug))"
          class="flex items-center gap-3 rounded-xl px-1.5 py-1 transition-colors hover:bg-white/5"
        >
          <CatalogThumb :src="project.icon" fallback="i-pixelarticons-package" class="size-8" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold text-highlighted">{{ project.title }}</span>
            <span class="block text-xs text-dimmed">
              {{ t('catalog.downloads', { n: count(project.downloads) }) }}
            </span>
          </span>
        </NuxtLink>
      </li>
    </ul>
  </UiPanel>
</template>
