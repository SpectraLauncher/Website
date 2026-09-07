<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

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
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-3xl px-4 pb-24 pt-40">
        <h1 class="text-3xl font-semibold tracking-tight">{{ t('nav.account.organizations') }}</h1>
        <p class="mt-3 text-base/relaxed text-muted">{{ t('account.organizationsIntro') }}</p>

        <ul v-if="data?.organizations.length" class="mt-8 space-y-3">
          <li v-for="org in data.organizations" :key="org.id">
            <NuxtLink
              :to="localePath(`/org/${org.slug}`)"
              class="flex items-center gap-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm transition-colors hover:border-zinc-500"
            >
              <span class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
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

        <div v-else class="mt-10 rounded-3xl border border-zinc-600/50 bg-black/30 p-12 text-center backdrop-blur-sm">
          <UIcon name="i-pixelarticons-users" class="mx-auto size-10 text-dimmed" />
          <p class="mt-3 text-sm text-muted">{{ t('account.noOrganizations') }}</p>
        </div>
      </section>
    </div>
  </div>
</template>
