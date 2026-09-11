<script setup lang="ts">
export interface AdminPost {
  id: string
  kind: 'article' | 'newsletter'
  slug: string | null
  title: string
  summary: string
  body: Record<string, any>
  cover: string | null
  status: string
  published: number | null
  sent: number | null
  recipients: number
}

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
  <div class="flex flex-col gap-4">
    <div class="grid gap-3 sm:grid-cols-2">
      <UFormField :label="t('posts.title')">
        <UInput v-model="draft.title" size="lg" class="w-full" />
      </UFormField>

      <UFormField v-if="isArticle" :label="t('posts.address')">
        <UInput v-model="draft.slug" size="lg" class="w-full" :placeholder="t('posts.title').toLowerCase()">
          <template #leading>
            <span class="font-mono text-xs text-dimmed">/news/</span>
          </template>
        </UInput>
      </UFormField>
    </div>

    <UFormField :label="t('posts.summary')" :help="t('posts.summaryHint')">
      <UTextarea v-model="draft.summary" :rows="2" class="w-full" />
    </UFormField>

    <UFormField v-if="isArticle" :label="t('posts.cover')">
      <div class="flex flex-wrap items-center gap-3">
        <img
          v-if="draft.cover"
          :src="draft.cover"
          alt=""
          class="h-20 w-36 rounded-xl border border-raised-line object-cover"
        >
        <UButton
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

    <UFormField :label="t('posts.body')">
      <UiRichEditor v-model="draft.body" :upload-to="`${path}/image`" :rows="16" />
    </UFormField>

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

      <UButton
        class="ml-auto"
        color="error"
        variant="ghost"
        icon="i-pixelarticons-trash"
        :loading="busy === 'remove'"
        :label="t('posts.remove')"
        @click="remove"
      />
    </div>
  </div>
</template>
