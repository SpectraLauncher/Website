<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const { t } = useI18n()
</script>

<template>
  <CatalogBrowse
    type="modpack"
    prefix="pack"
    icon="i-pixelarticons-archive"
    :title="t('catalog.modpacks.title')"
    :sub="t('catalog.modpacks.sub')"
  />
</template>
