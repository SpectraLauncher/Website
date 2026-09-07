<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const { t } = useI18n()
</script>

<template>
  <CatalogBrowse
    type="schematic"
    prefix="schematic"
    icon="i-pixelarticons-blocks"
    :title="t('catalog.schematics.title')"
    :sub="t('catalog.schematics.sub')"
  />
</template>
