<script setup lang="ts">
interface Article {
  id: string
  title: string
  summary: string
  html: string
  cover: string | null
  published: number | null
  updated: number | null
}

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const { data } = await useFetch<{ article: Article, reactions: ReactionState }>(
  () => `/api/news/${encodeURIComponent(String(route.params.slug ?? ''))}`)

const article = computed(() => data.value?.article)

const when = (ms: number | null | undefined) =>
  (ms ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'long' }).format(new Date(ms)) : '')

useSeoMeta({
  title: () => article.value?.title ?? t('news.title'),
  description: () => article.value?.summary ?? '',
  ogImage: () => article.value?.cover ?? undefined,
  ogType: 'article',
})
</script>

<template>
  <UiPageShell width="max-w-3xl">
    <NuxtLink
      :to="localePath('/news')"
      class="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-default"
    >
      <UIcon name="i-pixelarticons-arrow-left" class="size-4" />
      {{ t('news.title') }}
    </NuxtLink>

    <article v-if="article">
      <p class="text-xs font-semibold uppercase tracking-wide text-dimmed">
        {{ when(article.published) }}
      </p>
      <h1 class="mt-2 text-3xl font-extrabold tracking-tight text-highlighted sm:text-4xl">
        {{ article.title }}
      </h1>
      <p v-if="article.summary" class="mt-3 text-pretty text-lg text-muted">
        {{ article.summary }}
      </p>

      <!-- Its own height: the cover is stored bounded to 1600px on the longer
           side and otherwise untouched, so the shape is the author's. A fixed
           box here cropped the top and bottom off everything taller than 3:1. -->
      <img
        v-if="article.cover"
        :src="article.cover"
        alt=""
        class="mt-7 h-auto w-full rounded-2xl border border-panel-line"
      >

      <!-- eslint-disable-next-line vue/no-v-html -- the server builds this from
           the stored document by an allowlist; see shared/utils/post-doc -->
      <div
        class="prose prose-invert mt-7 max-w-none break-words prose-a:text-primary"
        v-html="article.html"
      />

      <!-- After the piece, not before it: there is nothing to react to yet at
           the top of a page nobody has read. -->
      <NewsReactions
        v-if="data?.reactions"
        class="mt-8 border-t border-panel-line pt-6"
        :slug="String(route.params.slug ?? '')"
        :reactions="data.reactions"
      />
    </article>

    <NewsSubscribe class="mt-10" />
  </UiPageShell>
</template>
