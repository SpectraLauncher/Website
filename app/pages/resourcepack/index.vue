<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const { t } = useI18n()
</script>

<template>
  <CatalogBrowse
    type="resourcepack"
    prefix="resourcepack"
    icon="i-lucide-image"
    :title="t('catalog.resourcepacks.title')"
    :sub="t('catalog.resourcepacks.sub')"
  />
</template>
