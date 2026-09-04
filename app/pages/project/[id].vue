<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

// A stable address that survives a project changing its type or its slug:
// /project/<id> resolves to whatever the typed URL is right now. The redirect is
// permanent, so search engines keep the typed URL rather than this one.
const { data, error } = await useFetch<{ project: { path: string } }>(
  () => `/api/catalog/project/${encodeURIComponent(String(route.params.id ?? ''))}`)

if (data.value?.project.path) {
  await navigateTo(localePath(data.value.project.path), { redirectCode: 301 })
}

useSeoMeta({ robots: 'noindex' })
</script>

<template>
  <div>
    <Navbar />
    <section v-if="error" class="container mx-auto max-w-2xl px-4 py-40 text-center">
      <h1 class="text-2xl font-semibold">{{ t('catalog.notFound') }}</h1>
    </section>
  </div>
</template>
