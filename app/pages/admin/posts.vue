<script setup lang="ts">
import type { AdminPost } from '~/components/admin/PostEditor.vue'

definePageMeta({ middleware: 'admin' })

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
  <UiPageShell width="max-w-6xl">
    <UiPageHeader
      :title="t(kind === 'article' ? 'posts.articles' : 'posts.newsletter')"
      :description="kind === 'newsletter'
        ? t('posts.subscribers') + ': ' + (list?.subscribers.length ?? 0)
        : undefined"
    >
      <div class="flex flex-wrap gap-2 pb-1.5">
        <UButton
          variant="subtle"
          color="neutral"
          size="lg"
          icon="i-pixelarticons-arrow-left"
          :label="t('catalog.admin.backToPanel')"
          :to="localePath('/admin')"
        />
        <UButton
          size="lg"
          icon="i-pixelarticons-plus"
          :loading="creating"
          :label="t(kind === 'article' ? 'posts.newArticle' : 'posts.newIssue')"
          @click="create"
        />
      </div>
    </UiPageHeader>

    <div class="grid gap-4 lg:grid-cols-[300px_1fr] lg:items-start">
      <UiPanel class="overflow-hidden">
        <button
          v-for="post in posts"
          :key="post.id"
          type="button"
          class="flex w-full cursor-pointer flex-col gap-1 border-b border-raised-line px-4 py-3 text-left transition-colors last:border-b-0"
          :class="openId === post.id ? 'bg-white/10' : 'hover:bg-white/5'"
          @click="openId = post.id"
        >
          <span class="truncate font-semibold text-highlighted">
            {{ post.title || t('posts.draft') }}
          </span>
          <span class="flex flex-wrap items-center gap-2 text-xs text-dimmed">
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
        </button>

        <p v-if="!posts.length" class="p-8 text-center text-sm text-dimmed">
          {{ t('posts.noPosts') }}
        </p>
      </UiPanel>

      <UiPanel v-if="open" class="p-5 sm:p-6">
        <AdminPostEditor
          :key="open.id"
          :post="open"
          :recipient-count="list?.subscribers.length ?? 0"
          @saved="saved"
          @removed="removed"
        />
      </UiPanel>

      <UiPanel v-else class="p-12 text-center">
        <UIcon name="i-pixelarticons-article" class="mx-auto size-10 text-dimmed" />
        <p class="mt-3 text-sm text-muted">{{ t('posts.noPosts') }}</p>
      </UiPanel>
    </div>
  </UiPageShell>
</template>
