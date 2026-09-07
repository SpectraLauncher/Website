<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()

const id = computed(() => String(route.params.id ?? ''))
const { project } = useProjectEditor(id)
</script>

<template>
  <div>
    <ProjectMembers v-if="project" :slug="project.slug" />
    <p v-else class="text-sm text-dimmed">{{ t('catalog.notFound') }}</p>
  </div>
</template>
