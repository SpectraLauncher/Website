<script setup lang="ts">
import type { AdminPost } from '~/types/post'

definePageMeta({ middleware: 'admin', layout: 'admin' })

const route = useRoute()
const localePath = useLocalePath()
const { t, locale } = useI18n()

// One page for both kinds: the list, the editor and the picture handling are
// the same, and ?kind is what decides whether a row has an address or a send
// button. Two pages would have been the same file twice.
const kind = computed(() => (route.query.kind === 'newsletter' ? 'newsletter' : 'article'))

const { data, refresh } = await useFetch<{ posts: AdminPost[] }>('/api/admin/posts', {
  query: computed(() => ({ kind: kind.value })),
})

const { data: list } = await useFetch<{ subscribers: Array<{ id: string }> }>(
  '/api/admin/newsletter')

const posts = computed(() => data.value?.posts ?? [])
const openId = ref<string | null>(null)
const open = computed(() => posts.value.find(post => post.id === openId.value) ?? null)

watch(kind, () => { openId.value = null })

const creating = ref(false)

async function create() {
  creating.value = true

  try {
    const { post } = await $fetch<{ post: AdminPost }>('/api/admin/posts', {
      method: 'POST',
      body: { kind: kind.value },
    })

    await refresh()
    openId.value = post.id
  }
  finally { creating.value = false }
}

function saved(post: AdminPost) {
  refresh()
  openId.value = post.id
}

function removed() {
  openId.value = null
  refresh()
}

const when = (ms: number | null) =>
  (ms ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms)) : '—')

useSeoMeta({ title: () => t(`posts.${kind.value === 'article' ? 'articles' : 'newsletter'}`), robots: 'noindex' })
</script>

<template>
  <div class="min-w-0">
    <UiPageHeader
      :title="t(kind === 'article' ? 'posts.articles' : 'posts.newsletter')"
      :description="kind === 'newsletter'
        ? t('posts.subscribers') + ': ' + (list?.subscribers.length ?? 0)
        : undefined"
    >
      <div class="flex flex-wrap gap-2 pb-1.5">
        <UButton
          size="lg"
          icon="i-pixelarticons-plus"
          :loading="creating"
          :label="t(kind === 'article' ? 'posts.newArticle' : 'posts.newIssue')"
          @click="create"
        />
      </div>
    </UiPageHeader>

    <!-- Writing gets the whole width. The list is one click away rather than a
         column permanently taking a third of the page — at 300px of editor an
         article could not be written at all. -->
    <template v-if="open">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <UButton
          color="neutral"
          variant="subtle"
          icon="i-pixelarticons-arrow-left"
          :label="t('posts.allPosts', { n: posts.length })"
          @click="openId = null"
        />

        <USelectMenu
          v-if="posts.length > 1"
          :model-value="openId"
          value-key="id"
          label-key="label"
          :items="posts.map(post => ({ id: post.id, label: post.title || t('posts.draft') }))"
          class="min-w-56"
          @update:model-value="openId = String($event)"
        />
      </div>

      <UiPanel class="p-5 sm:p-6">
        <AdminPostEditor
          :key="open.id"
          :post="open"
          :recipient-count="list?.subscribers.length ?? 0"
          @saved="saved"
          @removed="removed"
        />
      </UiPanel>
    </template>

    <template v-else>
      <div v-if="posts.length" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <UiPanel
          v-for="post in posts"
          :key="post.id"
          class="flex cursor-pointer flex-col overflow-hidden text-left transition-colors hover:border-zinc-600"
          @click="openId = post.id"
        >
          <img
            v-if="post.cover"
            :src="post.cover"
            alt=""
            class="aspect-[16/9] w-full object-cover"
          >
          <div
            v-else
            class="grid aspect-[16/9] w-full place-items-center border-b border-panel-line bg-raised text-dimmed"
          >
            <UIcon name="i-pixelarticons-article" class="size-7" />
          </div>

          <div class="flex flex-1 flex-col gap-2 p-4">
            <span class="truncate font-semibold text-highlighted">
              {{ post.title || t('posts.draft') }}
            </span>
            <p v-if="post.summary" class="line-clamp-2 text-sm text-muted">{{ post.summary }}</p>

            <span class="mt-auto flex flex-wrap items-center gap-2 pt-1 text-xs text-dimmed">
              <UBadge
                size="sm"
                variant="subtle"
                :color="post.status === 'published' ? 'success' : 'neutral'"
                :label="t(post.status === 'published' ? 'posts.published' : 'posts.draft')"
              />
              <template v-if="kind === 'newsletter'">
                {{ post.sent ? t('posts.sent', { n: post.recipients }) : t('posts.unsent') }}
              </template>
              <template v-else>{{ when(post.published) }}</template>
            </span>
          </div>
        </UiPanel>
      </div>

      <UiPanel v-else class="p-12 text-center">
        <UIcon name="i-pixelarticons-article" class="mx-auto size-10 text-dimmed" />
        <p class="mt-3 text-sm text-muted">{{ t('posts.noPosts') }}</p>
      </UiPanel>
    </template>

  </div>
</template>
