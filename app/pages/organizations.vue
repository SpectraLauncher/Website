<script setup lang="ts">
definePageMeta({ middleware: 'catalog', layout: 'account' })

const { t, locale } = useI18n()
const localePath = useLocalePath()

const { data } = await useFetch<{
  organizations: Array<{
    id: string
    slug: string
    name: string
    logo: string | null
    role: string
    projects: number
  }>
}>('/api/catalog/me/organizations')

useSeoMeta({ title: () => t('nav.account.organizations'), robots: 'noindex' })
</script>

<template>
  <div>
    <UiPageHeader :title="t('nav.account.organizations')" :description="t('account.organizationsIntro')" />

    <ul v-if="data?.organizations.length" class="mt-8 space-y-3">
      <li v-for="org in data.organizations" :key="org.id">
        <NuxtLink
          :to="localePath(`/org/${org.slug}`)"
          class="flex items-center gap-4 rounded-2xl border border-panel-line bg-panel p-5 transition-colors hover:border-zinc-600"
        >
          <span class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-raised-line bg-raised">
            <img v-if="org.logo" :src="org.logo" alt="" class="size-full object-cover">
            <UIcon v-else name="i-pixelarticons-users" class="size-5 text-dimmed" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold">{{ org.name }}</span>
            <span class="text-xs text-dimmed">
              {{ t('catalog.org.projectCount', { n: org.projects }) }}
            </span>
          </span>
          <UBadge variant="subtle" size="sm" :label="org.role" />
        </NuxtLink>
      </li>
    </ul>

    <div v-else class="mt-10 rounded-2xl border border-panel-line bg-panel p-12 text-center">
      <UIcon name="i-pixelarticons-users" class="mx-auto size-10 text-dimmed" />
      <p class="mt-3 text-sm text-muted">{{ t('account.noOrganizations') }}</p>
    </div>
  </div>
</template>
