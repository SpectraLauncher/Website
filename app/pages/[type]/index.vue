<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const { t } = useI18n()
const route = useRoute()

// This page answers any first segment, so an unknown one has to be refused
// rather than rendered as an empty listing.
const info = catalogTypeByPrefix(route.params.type)
if (!info) throw createError({ statusCode: 404, statusMessage: 'no such listing' })
</script>

<template>
  <CatalogBrowse
    :type="info!.type"
    :prefix="info!.prefix"
    :icon="info!.icon"
    :title="t(`catalog.${info!.key}.title`)"
    :sub="t(`catalog.${info!.key}.sub`)"
  />
</template>
