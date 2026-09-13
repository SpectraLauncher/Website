<script setup lang="ts">
import type { AdminPost } from '~/types/post'

const props = defineProps<{ post: AdminPost, recipientCount?: number }>()
const emit = defineEmits<{ saved: [AdminPost], removed: [string] }>()

const { t, locale } = useI18n()
const toast = useToast()
const { ask } = useConfirm()

const draft = reactive({
  title: props.post.title,
  summary: props.post.summary,
  slug: props.post.slug ?? '',
  body: props.post.body,
  cover: props.post.cover,
})

const busy = ref('')
const cover = useTemplateRef<HTMLInputElement>('cover')

// An address nobody typed is the normal case: it follows the title until the
// author edits it, and then it stops moving — a published address that keeps
// rewriting itself breaks every link anybody shared.
const slugPinned = ref(Boolean(props.post.slug))

watch(() => draft.title, (title) => {
  if (!slugPinned.value) draft.slug = normalizeSlug(title.slice(0, 80))
})

const slugProblemNow = computed(() => (draft.slug ? slugProblem(draft.slug) : null))

const path = computed(() => `/api/admin/posts/${props.post.id}`)
const isArticle = computed(() => props.post.kind === 'article')

const when = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms))

async function run(key: string, fn: () => Promise<unknown>) {
  busy.value = key
  try { await fn() }
  catch (e: any) {
    toast.add({
      title: e?.data?.statusMessage || t('auth.genericError'),
      color: 'error',
      icon: 'i-pixelarticons-warning-box',
    })
  }
  finally { busy.value = '' }
}

const save = (extra: Record<string, unknown> = {}) => run('save', async () => {
  const { post } = await $fetch<{ post: AdminPost }>(path.value, {
    method: 'PATCH',
    body: { ...draft, ...extra },
  })

  emit('saved', post)
  toast.add({ title: t('posts.saved'), icon: 'i-pixelarticons-check' })
})

// The cover goes through the same endpoint as a picture in the body, so the
// store records it against this post and the old one is dropped on save.
const uploadCover = (file: File | null | undefined) => file && run('cover', async () => {
  const { url } = await $fetch<{ url: string }>(`${path.value}/image`, {
    method: 'POST',
    body: file,
    headers: { 'content-type': file.type },
  })

  draft.cover = url
  await save({ cover: url })
})

const remove = () => run('remove', async () => {
  if (!await ask({ title: t('posts.removeAsk'), body: draft.title, danger: true })) return

  await $fetch(path.value, { method: 'DELETE' })
  emit('removed', props.post.id)
})

const send = () => run('send', async () => {
  const ok = await ask({
    title: t('posts.sendAsk'),
    body: draft.title,
    confirmLabel: t('posts.send', { n: '' }).trim(),
  })
  if (!ok) return

  const { queued } = await $fetch<{ queued: number }>(
    `/api/admin/newsletter/${props.post.id}/send`, { method: 'POST' })

  toast.add({ title: t('posts.sentTo', { n: queued }), icon: 'i-pixelarticons-check' })
  emit('saved', { ...props.post, sent: Date.now(), recipients: queued })
})
</script>

<template>
  <div class="grid gap-5 xl:grid-cols-[1fr_280px] xl:items-start">
    <div class="flex min-w-0 flex-col gap-4">
    <div class="grid gap-3 sm:grid-cols-2">
      <UFormField :label="t('posts.title')">
        <UInput v-model="draft.title" size="lg" class="w-full" />
      </UFormField>

      <UFormField
        v-if="isArticle"
        :label="t('posts.address')"
        :error="slugProblemNow ? t(`catalog.slugProblems.${slugProblemNow}`) : undefined"
      >
        <!-- The prefix sits beside the field, not in its leading slot: that slot
             is sized for an icon, so "/news/" ran underneath the text. -->
        <div class="flex items-center gap-2">
          <span class="shrink-0 font-mono text-sm text-dimmed">/news/</span>
          <UInput
            v-model="draft.slug"
            size="lg"
            class="flex-1"
            :placeholder="t('posts.title').toLowerCase()"
            @update:model-value="slugPinned = true"
          />
        </div>
      </UFormField>
    </div>

    <UFormField :label="t('posts.summary')" :help="t('posts.summaryHint')">
      <UTextarea v-model="draft.summary" :rows="2" class="w-full" />
    </UFormField>

      <UFormField :label="t('posts.body')">
        <UiRichEditor v-model="draft.body" :upload-to="`${path}/image`" :rows="18" />
      </UFormField>
    </div>

    <aside class="flex flex-col gap-4 xl:sticky xl:top-24">
      <UiPanel inset class="flex flex-col gap-3 p-4">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-semibold uppercase tracking-[0.09em] text-dimmed">
            {{ t('posts.state') }}
          </span>
          <UBadge
            size="sm"
            variant="subtle"
            :color="post.status === 'published' ? 'success' : 'neutral'"
            :label="t(post.status === 'published' ? 'posts.published' : 'posts.draft')"
          />
        </div>

        <p v-if="isArticle && post.published" class="text-xs text-muted">
          {{ when(post.published) }}
        </p>

        <div class="flex flex-wrap items-center gap-2">
      <UButton
        icon="i-pixelarticons-check"
        :loading="busy === 'save'"
        :label="t('posts.save')"
        @click="save()"
      />

      <UButton
        v-if="post.status === 'draft'"
        color="neutral"
        variant="subtle"
        icon="i-pixelarticons-upload"
        :loading="busy === 'save'"
        :label="t('posts.publish')"
        @click="save({ status: 'published' })"
      />
      <UButton
        v-else
        color="neutral"
        variant="subtle"
        icon="i-pixelarticons-draft"
        :loading="busy === 'save'"
        :label="t('posts.unpublish')"
        @click="save({ status: 'draft' })"
      />

      <!-- An issue goes out once. After that the button is a record of when. -->
      <UButton
        v-if="!isArticle && !post.sent"
        color="primary"
        icon="i-pixelarticons-mail"
        :loading="busy === 'send'"
        :label="t('posts.send', { n: recipientCount ?? 0 })"
        @click="send"
      />
      <span v-else-if="!isArticle" class="text-sm text-dimmed">
        {{ t('posts.sentAlready', { date: when(post.sent!), n: post.recipients }) }}
      </span>

        </div>
      </UiPanel>

      <UFormField v-if="isArticle" :label="t('posts.cover')">
        <div class="flex flex-col gap-3">
          <img
            v-if="draft.cover"
            :src="draft.cover"
            alt=""
            class="aspect-[16/9] w-full rounded-xl border border-raised-line object-cover"
          >
          <div
            v-else
            class="grid aspect-[16/9] w-full place-items-center rounded-xl border border-dashed border-raised-line text-dimmed"
          >
            <UIcon name="i-pixelarticons-image" class="size-7" />
          </div>

          <UButton
            block
            color="neutral"
            variant="subtle"
            icon="i-pixelarticons-image-plus"
            :loading="busy === 'cover'"
            :label="t('posts.uploadCover')"
            @click="cover?.click()"
          />
          <input
            ref="cover"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="hidden"
            @change="uploadCover(($event.target as HTMLInputElement).files?.[0])"
          >
        </div>
      </UFormField>

      <UButton
        block
        color="error"
        variant="ghost"
        icon="i-pixelarticons-trash"
        :loading="busy === 'remove'"
        :label="t('posts.remove')"
        @click="remove"
      />
    </aside>
  </div>
</template>
