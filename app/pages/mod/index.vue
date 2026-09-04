<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const { t } = useI18n()
</script>

<template>
  <CatalogBrowse
    type="mod"
    prefix="mod"
    icon="i-lucide-puzzle"
    :title="t('catalog.mods.title')"
    :sub="t('catalog.mods.sub')"
  />
</template>
