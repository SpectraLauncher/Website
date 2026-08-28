<script setup lang="ts">
const localePath = useLocalePath()
const { t } = useI18n()

interface Badge {
  slug: string
  name: string
  description: string
  image: string | null
  holders: number
}

const { data: badges } = await useFetch<Badge[]>('/api/badges', { default: () => [] })

const siteUrl = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
const listUrl = computed(() => `${siteUrl}${localePath('/badges')}`)
const seoTitle = computed(() => `${t('badges.title')}`)

defineOgImage('Spectra', {
  title: () => t('badges.title'),
  description: () => t('badges.sub')
})

useSeoMeta({
  title: () => seoTitle.value,
  description: () => t('badges.sub'),
  ogTitle: () => seoTitle.value,
  ogDescription: () => t('badges.sub'),
  ogUrl: () => listUrl.value,
  twitterTitle: () => seoTitle.value,
  twitterDescription: () => t('badges.sub')
})

useSchemaOrg(computed(() => [
  defineWebPage({ '@type': 'CollectionPage' }),
  defineItemList({
    name: t('badges.title'),
    itemListElement: badges.value.map(badge => ({
      name: badge.name,
      description: badge.description,
      url: localePath(`/badges/${badge.slug}`)
    }))
  }),
  defineBreadcrumb({
    itemListElement: [
      { name: 'Spectra', item: localePath('/') },
      { name: t('badges.title') }
    ]
  })
]))
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto px-4 pb-16 pt-40">
        <h1 class="mb-3 text-5xl font-semibold tracking-tight">{{ t('badges.title') }}</h1>
        <p class="max-w-[60ch] text-lg text-muted">{{ t('badges.sub') }}</p>
      </section>
    </div>

    <section class="container mx-auto px-4 pb-24">
      <div v-if="badges.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="badge in badges"
          :key="badge.slug"
          :to="localePath(`/badges/${badge.slug}`)"
          class="flex gap-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm transition-colors hover:border-zinc-400"
        >
          <img
            v-if="badge.image"
            :src="badge.image"
            :alt="badge.name"
            class="size-14 shrink-0 rounded-2xl object-contain"
            loading="lazy"
          >
          <span v-else class="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5">
            <UIcon name="i-lucide-award" class="size-6 text-primary" />
          </span>

          <div class="min-w-0">
            <h2 class="truncate font-semibold tracking-tight">{{ badge.name }}</h2>
            <p class="mb-2 line-clamp-2 text-xs/relaxed text-muted">{{ badge.description }}</p>
            <span class="font-mono text-xs text-dimmed">{{ t('badges.holders', { n: badge.holders }) }}</span>
          </div>
        </NuxtLink>
      </div>

      <p v-else class="text-muted">{{ t('badges.empty') }}</p>
    </section>

    <DiscordCta />
  </div>
</template>
