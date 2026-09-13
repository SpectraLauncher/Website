<script setup lang="ts">
interface Card {
  id: string
  slug: string | null
  title: string
  summary: string
  cover: string | null
  published: number | null
}

// The three newest, or nothing at all: an empty band saying "no articles yet" is
// worse on a home page than no band.
const { data } = await useFetch<{ articles: Card[] }>('/api/news', {
  key: dataKeys.homeNews(),
  query: { limit: 3 },
})

const articles = computed(() => data.value?.articles ?? [])

const { t, locale } = useI18n()
const localePath = useLocalePath()

const when = (ms: number | null) =>
  (ms ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'long' }).format(new Date(ms)) : '')
</script>

<template>
  <section v-if="articles.length" class="container mx-auto px-4 py-20">
    <div v-reveal class="mb-3 flex flex-wrap items-end justify-between gap-6">
      <h2 class="text-4xl font-semibold tracking-tight">{{ t('home.newsTitle') }}</h2>
      <NuxtLink
        :to="localePath('/news')"
        class="group flex items-center gap-1.5 pb-1.5 text-sm text-muted transition-colors hover:text-default"
      >
        {{ t('home.seeAll') }}
        <UIcon name="i-pixelarticons-arrow-right" class="size-4 transition-transform duration-300 group-hover:translate-x-1" />
      </NuxtLink>
    </div>
    <p v-reveal class="mb-8 max-w-[62ch] text-muted">{{ t('home.newsSub') }}</p>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UiGlassCard
        v-for="article in articles"
        :key="article.id"
        v-reveal
        :to="localePath(`/news/${article.slug}`)"
        class="flex flex-col overflow-hidden"
      >
        <img
          v-if="article.cover"
          :src="article.cover"
          alt=""
          class="aspect-[16/9] w-full object-cover"
        >

        <div class="flex flex-1 flex-col p-6">
          <p class="mb-2 text-xs uppercase tracking-[0.12em] text-dimmed">
            {{ when(article.published) }}
          </p>
          <span class="mb-2 font-semibold tracking-tight">{{ article.title }}</span>
          <p class="line-clamp-3 flex-1 text-sm/relaxed text-muted">{{ article.summary }}</p>
        </div>
      </UiGlassCard>
    </div>
  </section>
</template>
