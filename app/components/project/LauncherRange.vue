<script setup lang="ts">
const props = defineProps<{ meta: Record<string, unknown> | null | undefined }>()

const { t } = useI18n()

const requirement = computed(() => launcherRequirement(props.meta))
</script>

<template>
  <span
    v-if="requirement"
    class="inline-flex items-center gap-1.5 rounded-md border border-panel-line bg-panel px-2 py-0.5 font-mono text-xs text-muted"
    :title="t('catalog.launcherVersion')"
  >
    <UIcon name="i-pixelarticons-device-laptop" class="size-3.5 shrink-0" />
    {{ requirement.range ?? t('catalog.anyLauncher') }}
  </span>
</template>
