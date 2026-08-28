<script setup lang="ts">
const route = useRoute()
const localePath = useLocalePath()
const { t, locale } = useI18n()

interface Holder {
  username: string
  name: string | null
  image: string | null
  awarded: number
}

interface Response {
  badge: { slug: string, name: string, description: string, image: string | null }
  holders: Holder[]
}

const slug = computed(() => String(route.params.slug ?? ''))

const { data, error } = await useFetch<Response>(() => `/api/badges/${encodeURIComponent(slug.value)}`)

const when = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms))

const siteUrl = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
const pageUrl = computed(() => `${siteUrl}${localePath(`/badges/${slug.value}`)}`)
const seoTitle = computed(() =>
  data.value ? `${data.value.badge.name}` : `${t('badges.notFound')}`)
const seoDescription = computed(() => data.value?.badge.description || t('badges.sub'))

defineOgImage('Spectra', {
  title: () => data.value?.badge.name || t('badges.title'),
  description: () => seoDescription.value
})

useSeoMeta({
  title: () => seoTitle.value,
  description: () => seoDescription.value,
  ogTitle: () => seoTitle.value,
  ogDescription: () => seoDescription.value,
  ogUrl: () => pageUrl.value,
  ogImage: () => data.value?.badge.image || undefined,
  twitterTitle: () => seoTitle.value,
  twitterDescription: () => seoDescription.value,
  robots: () => (data.value ? 'index, follow' : 'noindex')
})

useSchemaOrg(computed(() => (data.value
  ? [
      defineWebPage({
        name: data.value.badge.name,
        description: seoDescription.value,
        ...(data.value.badge.image ? { primaryImageOfPage: data.value.badge.image } : {})
      }),
      defineBreadcrumb({
        itemListElement: [
          { name: 'Spectra', item: localePath('/') },
          { name: t('badges.title'), item: localePath('/badges') },
          { name: data.value.badge.name }
        ]
      })
    ]
  : [])))
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-4xl px-4 pb-24 pt-40">
        <NuxtLink :to="localePath('/badges')" class="group mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-default">
          <UIcon name="i-lucide-arrow-left" class="size-4 transition-transform duration-300 group-hover:-translate-x-1" />
          {{ t('badges.title') }}
        </NuxtLink>

        <template v-if="error || !data">
          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-10 text-center backdrop-blur-sm">
            <UIcon name="i-lucide-award" class="size-8 text-muted" />
            <h1 class="mt-4 text-2xl font-semibold tracking-tight">{{ t('badges.notFound') }}</h1>
          </div>
        </template>

        <template v-else>
          <div class="mb-4 flex flex-wrap items-center gap-6 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
            <img
              v-if="data.badge.image"
              :src="data.badge.image"
              :alt="data.badge.name"
              class="size-20 shrink-0 rounded-2xl object-contain"
            >
            <span v-else class="grid size-20 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5">
              <UIcon name="i-lucide-award" class="size-8 text-primary" />
            </span>

            <div class="min-w-0 flex-1">
              <h1 class="text-3xl font-semibold tracking-tight">{{ data.badge.name }}</h1>
              <p v-if="data.badge.description" class="mt-1 max-w-[60ch] text-sm/relaxed text-muted">
                {{ data.badge.description }}
              </p>
              <p class="mt-2 font-mono text-xs text-dimmed">{{ t('badges.holders', { n: data.holders.length }) }}</p>
            </div>
          </div>

          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
            <h2 class="mb-4 text-sm font-semibold">{{ t('badges.holdersTitle') }}</h2>

            <div v-if="data.holders.length" class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <NuxtLink
                v-for="holder in data.holders"
                :key="holder.username"
                :to="localePath(`/u/${holder.username}`)"
                class="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 transition-colors hover:border-zinc-500"
              >
                <img v-if="holder.image" :src="holder.image" alt="" class="size-9 shrink-0 rounded-full object-cover">
                <span
                  v-else
                  class="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  :style="`background:hsl(${initialsAvatar(holder.username).hue} 60% 30%)`"
                >{{ initialsAvatar(holder.username).letter }}</span>

                <div class="min-w-0">
                  <p class="truncate text-sm font-medium">{{ holder.name || holder.username }}</p>
                  <p class="truncate text-xs text-dimmed">{{ when(holder.awarded) }}</p>
                </div>
              </NuxtLink>
            </div>

            <p v-else class="text-sm text-muted">{{ t('badges.noHolders') }}</p>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>
