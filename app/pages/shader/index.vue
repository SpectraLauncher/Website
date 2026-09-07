<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const { t } = useI18n()
</script>

<template>
  <CatalogBrowse
    type="shader"
    prefix="shader"
    icon="i-pixelarticons-sun"
    :title="t('catalog.shaders.title')"
    :sub="t('catalog.shaders.sub')"
  />
</template>
