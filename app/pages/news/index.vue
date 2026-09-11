<script setup lang="ts">
interface Card {
  id: string
  slug: string | null
  title: string
  summary: string
  cover: string | null
  published: number | null
}

const { t, locale } = useI18n()
const localePath = useLocalePath()

const { data } = await useFetch<{ articles: Card[], total: number }>('/api/news')

const articles = computed(() => data.value?.articles ?? [])
const lead = computed(() => articles.value[0])
const rest = computed(() => articles.value.slice(1))

const when = (ms: number | null) =>
  (ms ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'long' }).format(new Date(ms)) : '')

const to = (article: Card) => localePath(`/news/${article.slug}`)

useSeoMeta({ title: () => t('news.title'), description: () => t('news.lead') })
</script>

<template>
  <UiPageShell width="max-w-6xl">
    <UiPageHeader :title="t('news.title')" :description="t('news.lead')" />

    <div v-if="articles.length" class="flex flex-col gap-4">
      <UiPanel :to="to(lead!)" class="overflow-hidden">
        <img
          v-if="lead!.cover"
          :src="lead!.cover"
          alt=""
          class="aspect-[3/1] w-full object-cover"
        >
        <div class="p-5 sm:p-7">
          <p class="text-xs font-semibold uppercase tracking-wide text-dimmed">
            {{ when(lead!.published) }}
          </p>
          <h2 class="mt-2 text-2xl font-extrabold tracking-tight text-highlighted">
            {{ lead!.title }}
          </h2>
          <p class="mt-2 max-w-2xl text-pretty text-muted">{{ lead!.summary }}</p>
        </div>
      </UiPanel>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <UiPanel
          v-for="article in rest"
          :key="article.id"
          :to="to(article)"
          class="flex flex-col overflow-hidden"
        >
          <img
            v-if="article.cover"
            :src="article.cover"
            alt=""
            class="aspect-[16/9] w-full object-cover"
          >
          <div class="flex flex-1 flex-col p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-dimmed">
              {{ when(article.published) }}
            </p>
            <h3 class="mt-1.5 font-bold text-highlighted">{{ article.title }}</h3>
            <p class="mt-1.5 line-clamp-3 text-sm text-muted">{{ article.summary }}</p>
          </div>
        </UiPanel>
      </div>
    </div>

    <UiPanel v-else class="p-12 text-center">
      <UIcon name="i-pixelarticons-article" class="mx-auto size-10 text-dimmed" />
      <p class="mt-3 text-sm text-muted">{{ t('news.empty') }}</p>
    </UiPanel>

    <NewsSubscribe class="mt-4" />
  </UiPageShell>
</template>
