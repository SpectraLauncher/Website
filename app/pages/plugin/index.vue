<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const { t } = useI18n()
</script>

<template>
  <CatalogBrowse
    type="plugin"
    prefix="plugin"
    icon="i-pixelarticons-plug"
    :title="t('catalog.plugins.title')"
    :sub="t('catalog.plugins.sub')"
  />
</template>
