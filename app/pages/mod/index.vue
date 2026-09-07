<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const { t } = useI18n()
</script>

<template>
  <CatalogBrowse
    type="mod"
    prefix="mod"
    icon="i-pixelarticons-shapes"
    :title="t('catalog.mods.title')"
    :sub="t('catalog.mods.sub')"
  />
</template>
