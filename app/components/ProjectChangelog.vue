<script setup lang="ts">
import type { CatalogVersion } from '~/components/CatalogProject.vue'

const props = defineProps<{ versions: CatalogVersion[] }>()

const { t, locale } = useI18n()

const when = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms))

// A release with an empty changelog is a row that says nothing, so it is left
// out rather than shown empty.
const written = computed(() => props.versions.filter(version => version.changelog))
</script>

<template>
  <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
    <h2 class="mb-4 text-lg font-semibold">{{ t('catalog.changelog') }}</h2>

    <ol v-if="written.length" class="space-y-6">
      <li v-for="version in written" :key="version.id">
        <header class="mb-2 flex flex-wrap items-center gap-2">
          <h3 class="text-base font-semibold">{{ version.name }}</h3>
          <UBadge size="sm" variant="subtle" :label="t(`catalog.channels.${version.channel}`)" />
          <span class="text-xs text-dimmed">{{ when(version.created) }}</span>
        </header>
        <!-- eslint-disable-next-line vue/no-v-html -- markdown-it runs with html:false -->
        <div class="prose prose-invert max-w-none" v-html="renderMarkdown(version.changelog ?? '')" />
      </li>
    </ol>

    <p v-else class="text-sm text-dimmed">{{ t('catalog.noChangelog') }}</p>
  </div>
</template>
